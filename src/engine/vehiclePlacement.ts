// Harkonnen vehicle placement (round phase 1), Mahdi solo. Pure & deterministic.
//
// Source: rulebook p38 + fan summary p9. Harvesters fill the round's harvesting sector by a
// 4-tier priority; carryalls protect the most harvesters; ornithopters threaten sietches and
// cover the target sector. This module covers HARVESTERS first (the intricate part); carryalls
// and ornithopters follow.

import { AREAS, ADJACENCY, AIR_ZONES, type SectorId } from "./board";
import type { GameState, TacticalSector } from "./state";
import { combatPower } from "./combatPower";
import {
  harkonnenDistance,
  airZonesConnectedToSector,
  airZoneSectors,
} from "./movement";

const CENTRAL: SectorId[] = ["s5", "s6", "s7", "s8"];

/** Areas belonging to a tactical-sector selection ('central' = all 4 central sectors). */
export function areasInSector(sel: TacticalSector): string[] {
  const inSel = (s: SectorId) =>
    sel === "central" ? CENTRAL.includes(s) : s === sel;
  return Object.values(AREAS)
    .filter((a) => inSel(a.sector))
    .map((a) => a.id);
}

/** Sectors ground-adjacent to a selection (some area in one borders an area in the other). */
export function sectorsAdjacentTo(sel: TacticalSector): SectorId[] {
  const selSectors = new Set<SectorId>(sel === "central" ? CENTRAL : [sel]);
  const out = new Set<SectorId>();
  for (const a of Object.keys(ADJACENCY)) {
    if (!selSectors.has(AREAS[a].sector)) continue;
    for (const n of ADJACENCY[a]) {
      const ns = AREAS[n].sector;
      if (!selSectors.has(ns) && ns !== "np") out.add(ns);
    }
  }
  return [...out];
}

// --- area predicates -------------------------------------------------------

interface PlacementCtx {
  atreidesAreas: Set<string>; // areas with an Atreides legion
  sietchAreas: Set<string>; // live sietch areas (Atreides settlements)
  sandwormAreas: Set<string>;
  occupied: Set<string>; // any figure/token present (for "empty")
}

function buildCtx(s: GameState): PlacementCtx {
  const atreidesAreas = new Set(
    s.legions.filter((l) => l.faction === "atreides").map((l) => l.area),
  );
  const sietchAreas = new Set(
    s.sietches.filter((si) => !si.destroyed).map((si) => si.area),
  );
  const sandwormAreas = new Set(s.sandworms.map((w) => w.area));
  const occupied = new Set<string>();
  for (const l of s.legions) occupied.add(l.area);
  for (const v of s.vehicles) occupied.add(v.location);
  for (const w of s.wormsigns) occupied.add(w.area);
  for (const w of s.sandworms) occupied.add(w.area);
  for (const st of s.settlements) if (!st.destroyed) occupied.add(st.area);
  for (const si of s.sietches) if (!si.destroyed) occupied.add(si.area);
  for (const t of s.testingStations) occupied.add(t.area);
  return { atreidesAreas, sietchAreas, sandwormAreas, occupied };
}

const isDesert = (a: string) => AREAS[a].terrain === "desert";
const isDeep = (a: string) => AREAS[a].deep === true;

/** Free for the Harkonnen: no Atreides legion, no sietch, no sandworm. */
function isFree(ctx: PlacementCtx, a: string): boolean {
  return (
    !ctx.atreidesAreas.has(a) &&
    !ctx.sietchAreas.has(a) &&
    !ctx.sandwormAreas.has(a)
  );
}

/** Empty: nothing of any kind present. */
function isEmpty(ctx: PlacementCtx, a: string): boolean {
  return !ctx.occupied.has(a);
}

/** Adjacent (normal ground) to an Atreides legion or a sietch. */
function adjacentToAtreides(ctx: PlacementCtx, a: string): boolean {
  return (ADJACENCY[a] ?? []).some(
    (n) => ctx.atreidesAreas.has(n) || ctx.sietchAreas.has(n),
  );
}

// --- harvester placement ---------------------------------------------------

/**
 * Decide where the Harkonnen place `count` harvesters. Harvesters go in desert areas of the
 * harvesting sector by priority:
 *   1. empty deep desert not adjacent to an Atreides legion/sietch
 *   2. empty desert not adjacent to an Atreides legion/sietch
 *   3. remaining free deep desert
 *   4. remaining free desert
 * 1 per area. If the harvesting sector runs out, overflow into an adjacent sector (never the
 * target sietch's sector), same priority. Returns the chosen area ids in placement order.
 */
export function placeHarvesters(s: GameState, count: number): string[] {
  if (count <= 0 || !s.harvestingSector) return [];
  const ctx = buildCtx(s);
  const placed: string[] = [];
  // Seed with existing harvester locations so tiers 3-4 never re-pick an occupied area.
  const used = new Set<string>(
    s.vehicles.filter((v) => v.type === "harvester").map((v) => v.location),
  );

  const tiers = (areas: string[]): string[][] => {
    const desert = areas.filter(isDesert);
    return [
      desert.filter(
        (a) => isDeep(a) && isEmpty(ctx, a) && !adjacentToAtreides(ctx, a),
      ),
      desert.filter(
        (a) => !isDeep(a) && isEmpty(ctx, a) && !adjacentToAtreides(ctx, a),
      ),
      desert.filter((a) => isDeep(a) && isFree(ctx, a)),
      desert.filter((a) => !isDeep(a) && isFree(ctx, a)),
    ];
  };

  const fillFrom = (areas: string[]) => {
    for (const tier of tiers(areas)) {
      for (const a of tier.sort()) {
        if (placed.length >= count) return;
        if (used.has(a)) continue;
        used.add(a);
        placed.push(a);
      }
    }
  };

  fillFrom(areasInSector(s.harvestingSector));
  if (placed.length < count) {
    const targetSector = s.targetSietchId
      ? AREAS[s.targetSietchId].sector
      : null;
    const overflow = sectorsAdjacentTo(s.harvestingSector)
      .filter((sec) => sec !== targetSector)
      .flatMap((sec) => areasInSector(sec));
    fillFrom(overflow);
  }
  return placed;
}

// --- carryall placement ----------------------------------------------------

/** Air-zone ids already holding a vehicle (carryall/ornithopter). */
function occupiedZones(s: GameState): Set<string> {
  return new Set(
    s.vehicles.filter((v) => v.type !== "harvester").map((v) => v.location),
  );
}

/**
 * How many harvesters an air zone protects. An air zone straddles 2 Sectors and is "connected to
 * all Areas within both Sectors" (rulebook), so a carryall there can save any harvester in either
 * bordering Sector — not just the zone's few member Areas.
 */
function harvestersProtected(
  zoneId: string,
  harvesterAreas: Set<string>,
): number {
  const covered = new Set(
    airZoneSectors(zoneId).flatMap((sec) => areasInSector(sec)),
  );
  let n = 0;
  for (const a of covered) if (harvesterAreas.has(a)) n++;
  return n;
}

/**
 * Place `count` carryalls in the unoccupied air zones that protect the most harvesters (1 per
 * zone). `harvesterAreas` are the harvesters on the board this round. Zones protecting 0
 * harvesters are skipped in the primary ranking but used as fallback so a carryall is always
 * placed when one is requested (e.g. from a card effect).
 */
export function placeCarryalls(
  s: GameState,
  count: number,
  harvesterAreas: string[],
): string[] {
  if (count <= 0) return [];
  const hset = new Set(harvesterAreas);
  const taken = occupiedZones(s);
  const free = AIR_ZONES.map((z) => z.id).filter((id) => !taken.has(id));
  // Primary: zones that protect at least 1 harvester, ranked by coverage.
  const primary = free
    .map((id) => ({ id, n: harvestersProtected(id, hset) }))
    .filter((z) => z.n > 0)
    .sort((a, b) => (b.n !== a.n ? b.n - a.n : a.id.localeCompare(b.id)))
    .map((z) => z.id);
  // Fallback: any remaining free zone — only used when no harvester-protecting zone exists
  // (e.g. a card places a carryall before any harvesters are on the board).
  const candidates = primary.length > 0 ? primary : free.sort();
  return candidates.slice(0, count);
}

// --- ornithopter placement -------------------------------------------------

/** Combat power of the Atreides legion defending a sietch area (0 if none). */
function sietchDefenderCP(s: GameState, area: string): number {
  const def = s.legions.find(
    (l) => l.faction === "atreides" && l.area === area,
  );
  return def ? combatPower(def) : 0;
}

/**
 * Place `count` ornithopters, per priority:
 *   1. For each Harkonnen legion exactly 2 areas from a sietch it could attack (combat power >
 *      defender), place 1 ornithopter in each unoccupied air zone connected to that legion's
 *      sector, until exhausted.
 *   2. Remaining ornithopters go to unoccupied air zones connected to the target sietch's sector,
 *      then to zones connecting sectors adjacent to the target (central↔central first).
 * Returns the chosen air-zone ids in placement order.
 */
export function placeOrnithopters(s: GameState, count: number): string[] {
  if (count <= 0) return [];
  const taken = occupiedZones(s);
  const chosen: string[] = [];
  const take = (zoneId: string) => {
    if (chosen.length >= count) return;
    if (taken.has(zoneId) || chosen.includes(zoneId)) return;
    chosen.push(zoneId);
  };

  // 1. Threaten sietches a legion is exactly 2 areas from and could beat.
  const liveSietches = s.sietches.filter((si) => !si.destroyed);
  const threatSectors: SectorId[] = [];
  for (const l of s.legions.filter((x) => x.faction === "harkonnen")) {
    const canThreaten = liveSietches.some(
      (si) =>
        harkonnenDistance(l.area, si.area) === 2 &&
        combatPower(l) > sietchDefenderCP(s, si.area),
    );
    if (canThreaten) threatSectors.push(AREAS[l.area].sector);
  }
  for (const sec of threatSectors)
    for (const z of airZonesConnectedToSector(sec)) take(z);

  // 2. Cover the target sietch's sector, then adjacent sectors (central↔central first).
  if (chosen.length < count && s.targetSietchId) {
    const targetSector = AREAS[s.targetSietchId].sector;
    for (const z of airZonesConnectedToSector(targetSector)) take(z);
    if (chosen.length < count) {
      const adj = sectorsAdjacentTo(targetSector);
      const zonesByCentrality = AIR_ZONES.map((z) => z.id)
        .filter((id) => airZoneSectors(id).some((sec) => adj.includes(sec)))
        .sort(
          (a, b) => centralLinks(b) - centralLinks(a) || a.localeCompare(b),
        );
      for (const z of zonesByCentrality) take(z);
    }
  }
  return chosen;
}

const CENTRAL_SET = new Set<SectorId>(["s5", "s6", "s7", "s8"]);
/** How many of an air zone's sectors are central (2 = a central↔central link). */
function centralLinks(zoneId: string): number {
  return airZoneSectors(zoneId).filter((s) => CENTRAL_SET.has(s)).length;
}

// --- orchestrator ----------------------------------------------------------

export interface VehiclePlacement {
  harvesters: string[]; // area ids
  carryalls: string[]; // air-zone ids
  ornithopters: string[]; // air-zone ids
}

/** Place all available vehicles for the round in the proper order: harvesters → carryalls → ornithopters. */
export function placeVehicles(
  s: GameState,
  available: { harvesters: number; carryalls: number; ornithopters: number },
): VehiclePlacement {
  const harvesters = placeHarvesters(s, available.harvesters);
  const carryalls = placeCarryalls(s, available.carryalls, harvesters);
  // Reflect carryalls as occupying zones before ornithopters choose.
  const withCarryalls: GameState = {
    ...s,
    vehicles: [
      ...s.vehicles,
      ...carryalls.map((location) => ({ type: "carryall" as const, location })),
    ],
  };
  const ornithopters = placeOrnithopters(withCarryalls, available.ornithopters);
  return { harvesters, carryalls, ornithopters };
}

// ---------------------------------------------------------------------------
// Vehicle consumption (troop transport / carryall rescue)
// ---------------------------------------------------------------------------

/** Index of a vehicle of `type` in an air zone connected to `sector` (first by zone id), or -1. */
function connectedVehicleIndex(
  s: GameState,
  type: "carryall" | "ornithopter",
  sector: SectorId,
): number {
  const zones = new Set(airZonesConnectedToSector(sector));
  let best = -1;
  for (let i = 0; i < s.vehicles.length; i++) {
    const v = s.vehicles[i];
    if (v.type !== type || !zones.has(v.location)) continue;
    if (best < 0 || v.location < s.vehicles[best].location) best = i;
  }
  return best;
}

/**
 * Remove 1 ornithopter used for troop transport by a legion starting in `sector` (rulebook:
 * "Remove the ornithopter and either move or attack with the legion up to 1 additional area
 * away"). Prefers a zone connected to the starting sector; falls back to any ornithopter so a
 * transport that already happened is always paid for. Null when none is on the board.
 */
export function removeOrnithopterForSector(
  s: GameState,
  sector: SectorId,
): GameState | null {
  let i = connectedVehicleIndex(s, "ornithopter", sector);
  if (i < 0) i = s.vehicles.findIndex((v) => v.type === "ornithopter");
  if (i < 0) return null;
  return { ...s, vehicles: s.vehicles.filter((_, k) => k !== i) };
}

/** Whether a carryall sits in an air zone connected to `sector` (it could rescue a harvester there). */
export function hasCarryallForSector(s: GameState, sector: SectorId): boolean {
  return connectedVehicleIndex(s, "carryall", sector) >= 0;
}

/**
 * Remove 1 carryall from an air zone connected to `sector` — the Desert Hazards rescue: "the
 * Harkonnen player can remove a carryall from a connected air zone instead; the harvester is
 * not removed". Null when no connected carryall exists.
 */
export function removeCarryallForSector(
  s: GameState,
  sector: SectorId,
): GameState | null {
  const i = connectedVehicleIndex(s, "carryall", sector);
  if (i < 0) return null;
  return { ...s, vehicles: s.vehicles.filter((_, k) => k !== i) };
}
