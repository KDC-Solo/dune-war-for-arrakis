// Apply a resolved Harkonnen action to the game state (the start of the round driver).
// Pure: returns a new state. Only the unambiguous, non-dice actions are auto-applied
// (move, deploy, house upgrade, place vehicles); attacks and card draws are left to the player
// (`applied: false`) because they involve physical dice / the card subsystem.

import type { GameState, Legion, UnitType } from "./state";
import { emptyLegion, unitCount } from "./state";
import type { DeployPlacement, HarkonnenAction } from "./harkonnenActions";
import { placeHarvesters, placeOrnithopters } from "./vehiclePlacement";
import { stackingLimit, stackingLimitFor } from "./imperiumBans";

export interface ApplyResult {
  state: GameState;
  /** True if the engine mutated state; false if the player must resolve it manually. */
  applied: boolean;
  /** Explanation when not auto-applied, or a summary of what changed. */
  note?: string;
}

const clamp0 = (n: number) => Math.max(0, n);

/**
 * Solo rule (fan p9): if deployment tokens must be placed but the pool is short, the player
 * reveals tokens of their choice on the board first (placing their units), which frees the
 * tokens for the required placement. The app can't flip physical tokens, so it surfaces this
 * as an instruction whenever a garrison drop comes up short.
 */
export function tokenPoolShortNote(shortfall: number): string {
  return (
    `Token pool exhausted — reveal ${shortfall} deployment token${shortfall === 1 ? '' : 's'} of ` +
    `your choice on the board (replace each with its unit via the area sheet), then add the freed ` +
    `token${shortfall === 1 ? '' : 's'} here.`
  );
}

/** Note for a Harkonnen legion entering a wormsign area — the reveal happens physically. */
export const WORMSIGN_ENTRY_NOTE =
  'The legion enters a Wormsign — reveal and resolve it physically, then record the outcome ' +
  'with the area-sheet worm tools.';

function mergeInto(target: Legion, src: Legion): Legion {
  return {
    ...target,
    units: {
      regular: target.units.regular + src.units.regular,
      elite: target.units.elite + src.units.elite,
      special_elite: target.units.special_elite + src.units.special_elite,
    },
    deploymentTokens: target.deploymentTokens + src.deploymentTokens,
    leaders: [...target.leaders, ...src.leaders],
  };
}

/** Add a legion to the list, merging into an existing same-faction legion in that area. */
export function upsertLegion(legions: Legion[], legion: Legion): Legion[] {
  const i = legions.findIndex(
    (l) => l.faction === legion.faction && l.area === legion.area,
  );
  if (i < 0) return [...legions, legion];
  return legions.map((l, idx) => (idx === i ? mergeInto(l, legion) : l));
}

function harkonnenAt(s: GameState, area: string): Legion | undefined {
  return s.legions.find((l) => l.faction === "harkonnen" && l.area === area);
}

// --- move ------------------------------------------------------------------

function applyMove(s: GameState, from: string, to: string): ApplyResult {
  const mover = harkonnenAt(s, from);
  if (!mover)
    return { state: s, applied: false, note: "no Harkonnen legion to move" };

  // Respect the stacking limit at the destination: move units up to the remaining capacity,
  // starting with the highest combat power (Sardaukar → elite → regular → tokens), plus ALL
  // leaders (leaders don't count toward the limit). Any units that don't fit stay behind.
  const limit = stackingLimit(s.spice.activeBans);
  const dest = harkonnenAt(s, to);
  const capacity = Math.max(0, limit - (dest ? unitCount(dest) : 0));
  let room = capacity;
  const take = (have: number) => {
    const n = Math.min(have, room);
    room -= n;
    return n;
  };
  const movedSE = take(mover.units.special_elite);
  const movedE = take(mover.units.elite);
  const movedR = take(mover.units.regular);
  const movedTokens = take(mover.deploymentTokens);
  const movedUnitCount = movedSE + movedE + movedR + movedTokens;
  // A leader cannot travel alone, so leaders only ride along when at least 1 unit/token moves.
  const movedLeaders = movedUnitCount > 0 ? mover.leaders : [];

  if (movedUnitCount === 0) {
    return {
      state: s,
      applied: false,
      note: "destination is at its stacking limit — nothing can move there.",
    };
  }

  const remainder: Legion = {
    ...mover,
    units: {
      regular: mover.units.regular - movedR,
      elite: mover.units.elite - movedE,
      special_elite: mover.units.special_elite - movedSE,
    },
    deploymentTokens: mover.deploymentTokens - movedTokens,
    leaders: movedLeaders.length > 0 ? [] : mover.leaders,
  };
  const remainderEmpty = unitCount(remainder) + remainder.leaders.length === 0;

  let legions = s.legions.filter((l) => l !== mover);
  if (!remainderEmpty) legions = [...legions, remainder];
  legions = upsertLegion(legions, {
    ...emptyLegion("harkonnen", to),
    units: { regular: movedR, elite: movedE, special_elite: movedSE },
    deploymentTokens: movedTokens,
    leaders: movedLeaders,
  });

  let reserve = s.harkonnenReserve;
  // When a Harkonnen legion fully leaves a settlement, drop 2 deployment tokens there (from the pool).
  const leftSettlement =
    remainderEmpty &&
    s.settlements.some((st) => st.area === from && !st.destroyed);
  let droppedTokens = 0;
  if (leftSettlement) {
    droppedTokens = Math.min(2, reserve.deploymentTokens);
    if (droppedTokens > 0) {
      legions = upsertLegion(legions, {
        ...emptyLegion("harkonnen", from),
        deploymentTokens: droppedTokens,
      });
      reserve = {
        ...reserve,
        deploymentTokens: reserve.deploymentTokens - droppedTokens,
      };
    }
  }
  const split = !remainderEmpty;
  const notes: string[] = [
    split
      ? `Moved ${movedUnitCount} (stacking limit ${limit}); rest stayed behind.`
      : "Legion moved.",
  ];
  if (droppedTokens > 0)
    notes.push(`${droppedTokens} deployment token${droppedTokens === 1 ? "" : "s"} left in the settlement.`);
  if (leftSettlement && droppedTokens < 2) notes.push(tokenPoolShortNote(2 - droppedTokens));
  if (s.wormsigns.some((w) => w.area === to)) notes.push(WORMSIGN_ENTRY_NOTE);
  return {
    state: { ...s, legions, harkonnenReserve: reserve },
    applied: true,
    note: notes.join(" "),
  };
}

// --- deploy ----------------------------------------------------------------

function applyDeploy(
  s: GameState,
  placements: Extract<HarkonnenAction, { kind: "deploy" }>["placements"],
): ApplyResult {
  let legions = [...s.legions];
  let units = { ...s.harkonnenReserve.units };
  let bashars = s.harkonnenReserve.bashars;
  let namedLeaders = [...s.harkonnenReserve.namedLeaders];

  for (const p of placements) {
    const add = emptyLegion("harkonnen", p.settlement);
    (Object.keys(p.units) as UnitType[]).forEach((t) => {
      const n = Math.min(p.units[t], units[t]);
      add.units[t] = n;
      units[t] = clamp0(units[t] - n);
    });
    if (p.leader === "Bashar" && bashars > 0) {
      add.leaders.push({ kind: "generic", faction: "harkonnen" });
      bashars -= 1;
    } else if (p.leader && namedLeaders.includes(p.leader)) {
      add.leaders.push({ kind: "named", faction: "harkonnen", name: p.leader });
      namedLeaders = namedLeaders.filter((n) => n !== p.leader);
    }
    legions = upsertLegion(legions, add);
  }
  return {
    state: {
      ...s,
      legions,
      harkonnenReserve: { ...s.harkonnenReserve, units, bashars, namedLeaders },
    },
    applied: true,
    note: "Units deployed from the reserve.",
  };
}

/**
 * Manually deploy one placement — units plus an optional leader — from the Harkonnen reserve to
 * the target area's legion (merging into an existing one), drawing from the reserve pools clamped
 * to what's actually available. Keeps board + reserve totals conserved so the two never drift.
 */
export function deployFromReserve(
  s: GameState,
  placement: DeployPlacement,
): GameState {
  return applyDeploy(s, [placement]).state;
}

/**
 * Areas the deploy-from-reserve form may target: a live Harkonnen settlement or any area already
 * holding a Harkonnen legion — excluding areas with an Atreides legion (can't deploy onto the
 * enemy) and areas whose Harkonnen legion is already at the stacking limit (no room).
 */
export function reserveDeployAreas(s: GameState): Set<string> {
  const limit = stackingLimit(s.spice.activeBans);
  const atreides = new Set(
    s.legions
      .filter((l) => l.faction === "atreides" && unitCount(l) + l.leaders.length > 0)
      .map((l) => l.area),
  );
  const out = new Set<string>();
  for (const st of s.settlements) if (!st.destroyed) out.add(st.area);
  for (const l of s.legions) if (l.faction === "harkonnen") out.add(l.area);
  for (const id of [...out]) {
    const h = s.legions.find((l) => l.faction === "harkonnen" && l.area === id);
    if (atreides.has(id) || (h && unitCount(h) >= limit)) out.delete(id);
  }
  return out;
}

// --- manual legion move / split -------------------------------------------

/** A subset of a legion's figures to move (the rest stay behind). Leaders are given by index. */
export interface MoveUnits {
  units: Record<UnitType, number>;
  deploymentTokens: number;
  /** Indices into the source legion's `leaders` array to move. */
  leaderIndices: number[];
}

const legionEmpty = (l: Legion) =>
  l.units.regular +
    l.units.elite +
    l.units.special_elite +
    l.deploymentTokens +
    l.leaders.length ===
  0;

/**
 * Move some (or all) of a legion's figures from `from` to `to`, for either faction. Both factions
 * may split a legion (rulebook: "It is not mandatory to move all figures"). The moved subset merges
 * into any same-faction legion already at `to`; the remainder stays behind (removed if now empty).
 * Counts are clamped to what's present AND to the room left under the destination's stacking limit
 * (highest-value units kept first, like the AI move); leaders don't count toward the limit but
 * can't travel without a unit/token. A no-op if there's no such legion, no room, or from === to.
 */
export function moveLegionUnits(
  s: GameState,
  faction: Legion["faction"],
  from: string,
  to: string,
  move: MoveUnits,
): GameState {
  if (from === to) return s;
  const src = s.legions.find((l) => l.faction === faction && l.area === from);
  if (!src) return s;

  const cap = (n: number, max: number) =>
    Math.max(0, Math.min(Math.floor(n) || 0, max));
  const dest = s.legions.find((l) => l.faction === faction && l.area === to);
  const limit = stackingLimitFor(faction, s.spice.activeBans);
  let room = Math.max(0, limit - (dest ? unitCount(dest) : 0));
  const fit = (n: number, max: number) => {
    const k = Math.min(cap(n, max), room);
    room -= k;
    return k;
  };
  const moved = {
    special_elite: fit(move.units.special_elite, src.units.special_elite),
    elite: fit(move.units.elite, src.units.elite),
    regular: fit(move.units.regular, src.units.regular),
  };
  const movedTokens = fit(move.deploymentTokens, src.deploymentTokens);
  const movedUnitCount =
    moved.regular + moved.elite + moved.special_elite + movedTokens;
  const idx = new Set(move.leaderIndices);
  // Leaders can't travel alone — they only ride along when at least 1 unit/token moves.
  const movedLeaders =
    movedUnitCount > 0 ? src.leaders.filter((_, i) => idx.has(i)) : [];
  const keptLeaders =
    movedUnitCount > 0 ? src.leaders.filter((_, i) => !idx.has(i)) : src.leaders;

  const remainder: Legion = {
    ...src,
    units: {
      regular: src.units.regular - moved.regular,
      elite: src.units.elite - moved.elite,
      special_elite: src.units.special_elite - moved.special_elite,
    },
    deploymentTokens: src.deploymentTokens - movedTokens,
    leaders: keptLeaders,
  };
  const movedLegion: Legion = {
    faction,
    area: to,
    units: {
      regular: moved.regular,
      elite: moved.elite,
      special_elite: moved.special_elite,
    },
    deploymentTokens: movedTokens,
    leaders: movedLeaders,
  };
  if (legionEmpty(movedLegion)) return s; // nothing selected to move

  let legions = s.legions.filter((l) => l !== src);
  if (!legionEmpty(remainder)) legions = [...legions, remainder];
  legions = upsertLegion(legions, movedLegion);

  // Solo garrison rule (fan-summary p9): when a Harkonnen legion fully leaves a live settlement,
  // place 2 deployment tokens there from the pool (mirrors the AI move in applyMove).
  let reserve = s.harkonnenReserve;
  if (
    faction === "harkonnen" &&
    legionEmpty(remainder) &&
    s.settlements.some((st) => st.area === from && !st.destroyed)
  ) {
    const dropped = Math.min(2, reserve.deploymentTokens);
    if (dropped > 0) {
      legions = upsertLegion(legions, {
        ...emptyLegion("harkonnen", from),
        deploymentTokens: dropped,
      });
      reserve = { ...reserve, deploymentTokens: reserve.deploymentTokens - dropped };
    }
  }
  return { ...s, legions, harkonnenReserve: reserve };
}

// --- house: replace regulars with elites -----------------------------------

function applyHouseReplace(
  s: GameState,
  area: string,
  count: number,
): ApplyResult {
  const leg = harkonnenAt(s, area);
  if (!leg) return { state: s, applied: false, note: "no legion to upgrade" };
  const n = Math.min(count, leg.units.regular, s.harkonnenReserve.units.elite);
  if (n <= 0)
    return {
      state: s,
      applied: false,
      note: "no elites available / no regulars to replace",
    };

  const legions = s.legions.map((l) =>
    l === leg
      ? {
          ...l,
          units: {
            ...l.units,
            regular: l.units.regular - n,
            elite: l.units.elite + n,
          },
        }
      : l,
  );
  const units = {
    ...s.harkonnenReserve.units,
    regular: s.harkonnenReserve.units.regular + n, // freed regulars return to the pool
    elite: clamp0(s.harkonnenReserve.units.elite - n),
  };
  return {
    state: {
      ...s,
      legions,
      harkonnenReserve: { ...s.harkonnenReserve, units },
    },
    applied: true,
    note: `Upgraded ${n} regular${n === 1 ? "" : "s"} to elite.`,
  };
}

// --- house: place vehicles (1 harvester + 1 ornithopter) -------------------

function applyPlaceVehicles(s: GameState): ApplyResult {
  const harvester = placeHarvesters(s, 1)[0];
  const ornithopter = placeOrnithopters(s, 1)[0];
  const vehicles = [...s.vehicles];
  if (harvester) vehicles.push({ type: "harvester", location: harvester });
  if (ornithopter)
    vehicles.push({ type: "ornithopter", location: ornithopter });
  if (vehicles.length === s.vehicles.length) {
    return {
      state: s,
      applied: false,
      note: "no legal vehicle placement available",
    };
  }
  return {
    state: { ...s, vehicles },
    applied: true,
    note: "Placed 1 harvester + 1 ornithopter.",
  };
}

// --- dispatch --------------------------------------------------------------

/** Apply a Harkonnen action to the state where unambiguous; otherwise report it's player-resolved. */
export function applyHarkonnenAction(
  s: GameState,
  a: HarkonnenAction,
): ApplyResult {
  switch (a.kind) {
    case "move":
      return applyMove(s, a.path[0], a.path[a.path.length - 1]);
    case "deploy":
      return applyDeploy(s, a.placements);
    case "house_replace":
      return applyHouseReplace(s, a.legion, a.count);
    case "house_place_vehicles":
      return applyPlaceVehicles(s);
    case "attack_sietch":
      return {
        state: s,
        applied: false,
        note: "Resolve the battle on the board (roll combat dice).",
      };
    case "attack_legion":
      return {
        state: s,
        applied: false,
        note: "Resolve the battle on the board (roll combat dice).",
      };
    case "mentat":
      return {
        state: s,
        applied: false,
        note: "Draw 2 planning cards and play them (card rules).",
      };
    case "none":
      return { state: s, applied: false, note: a.reason };
  }
}

/** Whether an action kind is auto-applied by the engine (vs player-resolved). */
export function isAutoApplied(a: HarkonnenAction): boolean {
  return (
    a.kind === "move" ||
    a.kind === "deploy" ||
    a.kind === "house_replace" ||
    a.kind === "house_place_vehicles"
  );
}
