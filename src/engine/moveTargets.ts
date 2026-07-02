// Faction-aware legal MOVE destinations for a legion (not attacks). Used by the UI to restrict
// which areas can be picked on the board map when relocating a legion.
//
// Rules modeled (rulebook p22-23):
//  - Ground move: to an adjacent FREE area (no enemy Units/Settlements, no Sandworms; harvesters
//    and ecological stations do not block). Impassable borders block a ground move — EXCEPT the
//    solo Harkonnen "ignore impassable borders" simplification, so Harkonnen use their expanded
//    adjacency and other factions use the standard (white-border) adjacency.
//  - Troop-Transport (Harkonnen only): using 1 ornithopter in an air zone connected to the
//    legion's starting sector, reach a free area up to 1 additional area away (jumping over the
//    intervening area — impassable border / enemy legion / sandworm).
//  - Sandriding (Atreides only): a legion adjacent to a Wormsign/Sandworm area can ride across
//    consecutive Wormsign/Sandworm areas (not crossing enemy legions) and end in an area adjacent
//    to that chain. The final area may hold a Wormsign but not a Sandworm.

import { ADJACENCY, AREAS } from "./board";
import type { GameState, Legion } from "./state";
import { unitCount } from "./state";
import { harkonnenNeighbors, canTroopTransport } from "./movement";

/** Standard ground neighbours (white borders only — areas across an impassable border are excluded). */
export function standardNeighbors(id: string): readonly string[] {
  return ADJACENCY[id] ?? [];
}

const opposite = (f: Legion["faction"]): Legion["faction"] =>
  f === "harkonnen" ? "atreides" : "harkonnen";

/** Areas a mover of `faction` may not END a move in: enemy legion, enemy settlement, or a sandworm. */
function blockedForMove(
  s: GameState,
  faction: Legion["faction"],
): (area: string) => boolean {
  const enemy = opposite(faction);
  const enemyLegions = new Set(
    s.legions
      .filter((l) => l.faction === enemy && unitCount(l) > 0)
      .map((l) => l.area),
  );
  const enemySettlements = new Set<string>();
  if (faction === "harkonnen") {
    for (const si of s.sietches)
      if (!si.destroyed) enemySettlements.add(si.area);
  } else {
    for (const st of s.settlements)
      if (!st.destroyed) enemySettlements.add(st.area);
  }
  const worms = new Set(s.sandworms.map((w) => w.area));
  return (area) =>
    enemyLegions.has(area) || enemySettlements.has(area) || worms.has(area);
}

function ornithopterZones(s: GameState): string[] {
  return s.vehicles
    .filter((v) => v.type === "ornithopter")
    .map((v) => v.location);
}

/**
 * The set of area ids a legion may legally MOVE to (attacks into enemy areas are excluded).
 * Empty for a legion with no figures.
 */
export function legalMoveDestinations(
  s: GameState,
  legion: Legion,
): Set<string> {
  const dests = new Set<string>();
  if (unitCount(legion) + legion.leaders.length === 0) return dests;

  const from = legion.area;
  const faction = legion.faction;
  const blocked = blockedForMove(s, faction);

  // 1. Ground move to an adjacent free area.
  const groundNbrs =
    faction === "harkonnen"
      ? harkonnenNeighbors(from)
      : standardNeighbors(from);
  for (const nb of groundNbrs) if (nb !== from && !blocked(nb)) dests.add(nb);

  // 2. Harkonnen troop-transport: an ornithopter connected to the legion's sector → +1 area (jump).
  if (
    faction === "harkonnen" &&
    canTroopTransport(AREAS[from].sector, ornithopterZones(s))
  ) {
    for (const m of harkonnenNeighbors(from)) {
      for (const n of harkonnenNeighbors(m)) {
        if (n !== from && !blocked(n)) dests.add(n);
      }
    }
  }

  // 3. Atreides sandriding: ride the consecutive Wormsign/Sandworm chain adjacent to the legion.
  if (faction === "atreides") {
    const wormAreas = new Set<string>([
      ...s.wormsigns.map((w) => w.area),
      ...s.sandworms.map((w) => w.area),
    ]);
    const enemyLegions = new Set(
      s.legions
        .filter((l) => l.faction === "harkonnen" && unitCount(l) > 0)
        .map((l) => l.area),
    );
    // The chain: worm areas reachable from the legion across consecutive worm areas (no enemy legions).
    const chain = new Set<string>();
    const queue: string[] = [];
    for (const nb of standardNeighbors(from)) {
      if (wormAreas.has(nb) && !enemyLegions.has(nb)) {
        chain.add(nb);
        queue.push(nb);
      }
    }
    while (queue.length) {
      const cur = queue.shift()!;
      for (const nb of standardNeighbors(cur)) {
        if (wormAreas.has(nb) && !enemyLegions.has(nb) && !chain.has(nb)) {
          chain.add(nb);
          queue.push(nb);
        }
      }
    }
    // End adjacent to the chain, in a free area (blocked already excludes sandworms + enemies).
    for (const c of chain) {
      for (const nb of standardNeighbors(c)) {
        if (nb !== from && !blocked(nb)) dests.add(nb);
      }
    }
  }

  dests.delete(from);
  return dests;
}
