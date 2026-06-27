// Harkonnen action resolver (Mahdi solo). Given the game state and a rolled action-die result,
// decide what the Harkonnen do, per the fan-summary p9 priority cascades. Pure & deterministic:
// returns a described decision the player executes on the physical board.
//
// This module covers the LEADERSHIP/STRATEGY cascade (attack a sietch → attack a legion → move)
// and its supporting state accessors. MENTAT/DEPLOYMENT/HOUSE and the full movement tie-breakers
// build on these primitives in later passes.

import type { GameState, Legion, UnitType, ActionResult } from './state';
import { combatPower } from './combatPower';
import { unitCount } from './state';
import {
  harkonnenAreAdjacent,
  harkonnenNeighbors,
  withinAttackReach,
  canTroopTransport,
  harkonnenDistance,
  nearestByDistance,
} from './movement';
import { AREAS } from './board';

// ---------------------------------------------------------------------------
// State accessors
// ---------------------------------------------------------------------------

export function harkonnenLegions(s: GameState): Legion[] {
  return s.legions.filter((l) => l.faction === 'harkonnen');
}

export function atreidesLegions(s: GameState): Legion[] {
  return s.legions.filter((l) => l.faction === 'atreides');
}

export function legionAt(s: GameState, area: string, faction: Legion['faction']): Legion | undefined {
  return s.legions.find((l) => l.faction === faction && l.area === area);
}

/** Air-zone ids currently holding an ornithopter. */
export function ornithopterZones(s: GameState): string[] {
  return s.vehicles.filter((v) => v.type === 'ornithopter').map((v) => v.location);
}

/** Areas a legion cannot move *through* (enemy-occupied or sandworm). Harvesters/stations don't block. */
export function blockedForHarkonnen(s: GameState): (area: string) => boolean {
  const enemy = new Set(atreidesLegions(s).map((l) => l.area));
  const settlements = new Set<string>(); // Atreides settlements = sietches
  for (const si of s.sietches) if (!si.destroyed) settlements.add(si.area);
  const worms = new Set(s.sandworms.map((w) => w.area));
  return (area: string) => enemy.has(area) || settlements.has(area) || worms.has(area);
}

function leaderRank(l: Legion): number {
  return l.leaders.some((x) => x.kind === 'named') ? 1 : 0;
}

function sietchRank(s: GameState, area: string): number {
  const si = s.sietches.find((x) => x.area === area);
  return si?.rank ?? 0; // solo player knows ranks even when unrevealed; 0 if unknown
}

/** The Atreides legion defending a sietch area (empty legion if none present). */
function sietchDefender(s: GameState, area: string): Legion {
  return (
    legionAt(s, area, 'atreides') ?? {
      faction: 'atreides',
      area,
      units: { regular: 0, elite: 0, special_elite: 0 },
      deploymentTokens: 0,
      leaders: [],
    }
  );
}

// ---------------------------------------------------------------------------
// Decision output
// ---------------------------------------------------------------------------

export interface DeployPlacement {
  settlement: string;
  units: Record<UnitType, number>;
  /** Leader deployed here (named or 'Bashar'), if any. */
  leader: string | null;
}

export type HarkonnenAction =
  | { kind: 'attack_sietch'; attacker: string; sietch: string; useOrnithopter: boolean }
  | { kind: 'attack_legion'; attacker: string; defender: string }
  | { kind: 'move'; legion: string; path: string[] }
  | { kind: 'deploy'; placements: DeployPlacement[] }
  | { kind: 'mentat' } // draw 2 planning cards (alternating Harkonnen/Corrino) and play immediately
  | { kind: 'house_replace'; legion: string; count: number } // replace `count` regulars with elites
  | { kind: 'house_place_vehicles' } // place 1 harvester + 1 ornithopter (per vehicle rules)
  | { kind: 'none'; reason: string };

// ---------------------------------------------------------------------------
// 1. Attack a sietch
// ---------------------------------------------------------------------------

interface SietchAttackOption {
  attacker: Legion;
  sietchArea: string;
  rank: number;
  cpDiff: number;
  useOrnithopter: boolean;
}

/**
 * Choose a sietch attack, or null if none is possible. A Harkonnen legion can attack a sietch it
 * can reach (adjacent, or distance-2 via one ornithopter "only if necessary") when its combat
 * power exceeds the defending Atreides legion's. Selection priority (fan p9):
 *   1. highest sietch rank · 2. greatest combat-power difference · 3. no ornithopter needed ·
 *   4. the round's target sietch.
 */
export function selectSietchAttack(s: GameState, requireLeader = false): HarkonnenAction | null {
  const attackers = harkonnenLegions(s).filter((l) => (requireLeader ? l.leaders.length > 0 : true));
  const options: SietchAttackOption[] = [];

  for (const attacker of attackers) {
    const transport = canTroopTransport(AREAS[attacker.area].sector, ornithopterZones(s));
    for (const si of s.sietches) {
      if (si.destroyed) continue;
      const adjacent = harkonnenAreAdjacent(attacker.area, si.area);
      const reachable = adjacent || (transport && withinAttackReach(attacker.area, si.area, true));
      if (!reachable) continue;
      const defender = sietchDefender(s, si.area);
      const cpDiff = combatPower(attacker) - combatPower(defender);
      if (cpDiff <= 0) continue; // attacker must be strictly stronger
      options.push({
        attacker,
        sietchArea: si.area,
        rank: sietchRank(s, si.area),
        cpDiff,
        useOrnithopter: !adjacent,
      });
    }
  }
  if (options.length === 0) return null;

  options.sort((a, b) => {
    if (a.rank !== b.rank) return b.rank - a.rank; // 1. highest rank
    if (a.cpDiff !== b.cpDiff) return b.cpDiff - a.cpDiff; // 2. greatest CP diff
    if (a.useOrnithopter !== b.useOrnithopter) return a.useOrnithopter ? 1 : -1; // 3. no ornithopter
    const at = a.sietchArea === s.targetSietchId ? 0 : 1; // 4. target sietch
    const bt = b.sietchArea === s.targetSietchId ? 0 : 1;
    return at - bt;
  });

  const best = options[0];
  return {
    kind: 'attack_sietch',
    attacker: best.attacker.area,
    sietch: best.sietchArea,
    useOrnithopter: best.useOrnithopter,
  };
}

// ---------------------------------------------------------------------------
// 2. Attack a legion
// ---------------------------------------------------------------------------

/**
 * Choose an attack on an adjacent Atreides legion, or null. Ornithopters cannot attack legions
 * in solo, so only ground-adjacent targets count, and the attacker must be strictly stronger.
 * Target priority: 1. highest combat power · 2. contains a named leader.
 */
export function selectLegionAttack(s: GameState, requireLeader = false): HarkonnenAction | null {
  const attackers = harkonnenLegions(s).filter((l) => (requireLeader ? l.leaders.length > 0 : true));
  const targets = atreidesLegions(s);

  let bestTarget: Legion | null = null;
  let bestAttacker: Legion | null = null;
  for (const target of targets) {
    const eligible = attackers.filter(
      (a) => harkonnenAreAdjacent(a.area, target.area) && combatPower(a) > combatPower(target),
    );
    if (eligible.length === 0) continue;
    if (
      !bestTarget ||
      combatPower(target) > combatPower(bestTarget) ||
      (combatPower(target) === combatPower(bestTarget) && leaderRank(target) > leaderRank(bestTarget))
    ) {
      bestTarget = target;
      // attacker = strongest eligible (any on tie)
      bestAttacker = eligible.reduce((m, a) => (combatPower(a) > combatPower(m) ? a : m));
    }
  }
  if (!bestTarget || !bestAttacker) return null;
  return { kind: 'attack_legion', attacker: bestAttacker.area, defender: bestTarget.area };
}

// ---------------------------------------------------------------------------
// 3. Move (basic policy: nearest legion advances toward the target sietch)
// ---------------------------------------------------------------------------

/**
 * The sietch the Harkonnen move toward this turn. Normally the round's target sietch, but if no
 * Harkonnen legion can beat its defender, a temporary target is chosen (a beatable live sietch
 * closest to the real target, then highest rank). Null if no sietch is a valid movement goal.
 */
export function effectiveTarget(s: GameState): string | null {
  const t = s.targetSietchId;
  if (!t) return null;
  const legs = harkonnenLegions(s);
  const beatable = (area: string) => legs.some((l) => combatPower(l) > combatPower(sietchDefender(s, area)));
  if (beatable(t)) return t;
  const cands = s.sietches
    .filter((si) => !si.destroyed && si.area !== t && beatable(si.area))
    .sort(
      (a, b) =>
        harkonnenDistance(a.area, t) - harkonnenDistance(b.area, t) ||
        sietchRank(s, b.area) - sietchRank(s, a.area),
    );
  return cands.length > 0 ? cands[0].area : null;
}

/** Choose the next step from `from` toward `target` along a shortest path, by the 5 tie-breakers. */
function pickNextStep(s: GameState, from: string, target: string): string | null {
  const blocked = blockedForHarkonnen(s);
  const d = harkonnenDistance(from, target, { blocked, allowBlockedTarget: true });
  if (!isFinite(d) || d <= 0) return null;
  const worms = new Set(s.wormsigns.map((w) => w.area));
  const hByArea = new Map(harkonnenLegions(s).map((l) => [l.area, l] as const));

  const cands = harkonnenNeighbors(from).filter(
    (n) =>
      n !== target && // entering the target is an attack, not a move
      !blocked(n) &&
      harkonnenDistance(n, target, { blocked, allowBlockedTarget: true }) === d - 1,
  );
  if (cands.length === 0) return null;

  // Tie-break key: 1. merge w/ a non-full Harkonnen legion · 2. closest to a sietch ·
  // 3. mountain · 4. plateau/minor_erg · 5. desert without wormsign.
  const key = (n: string): number[] => {
    const here = hByArea.get(n);
    const merge = here && unitCount(here) < STACKING_LIMIT ? 0 : 1;
    const sietchDist = distanceToNearestSietch(s, n).dist;
    const terr = AREAS[n].terrain;
    const terrainRank = terr === 'mountain' ? 0 : terr === 'plateau' || terr === 'minor_erg' ? 1 : 2;
    const wormPenalty = terr === 'desert' && worms.has(n) ? 1 : 0;
    return [merge, sietchDist, terrainRank, wormPenalty];
  };
  cands.sort((a, b) => {
    const ka = key(a);
    const kb = key(b);
    for (let i = 0; i < ka.length; i++) if (ka[i] !== kb[i]) return ka[i] - kb[i];
    return a.localeCompare(b);
  });
  return cands[0];
}

/**
 * Harkonnen movement: move the legion nearest the (effective) target sietch one area along the
 * shortest impassable-ignoring path, choosing the step by the 5 tie-breakers. A legion adjacent to
 * the target is not moved unless it is also adjacent to another Harkonnen legion, in which case it
 * merges into the adjacent legion nearest the target. Returns null if no legion should move.
 */
export function selectMove(s: GameState): HarkonnenAction | null {
  const target = effectiveTarget(s);
  if (!target) return null;
  const blocked = blockedForHarkonnen(s);
  const hAreas = new Set(harkonnenLegions(s).map((l) => l.area));

  const movable = harkonnenLegions(s).filter((l) => {
    if (l.area === target || unitCount(l) === 0) return false;
    const d = harkonnenDistance(l.area, target, { blocked, allowBlockedTarget: true });
    if (!isFinite(d) || d === 0) return false;
    if (harkonnenAreAdjacent(l.area, target)) {
      // adjacent to target: only move (to merge) if adjacent to another Harkonnen legion
      return harkonnenNeighbors(l.area).some((n) => hAreas.has(n));
    }
    return true;
  });
  if (movable.length === 0) return null;

  const { sources } = nearestByDistance(movable.map((l) => l.area), target, {
    blocked,
    allowBlockedTarget: true,
  });
  const chosen = sources
    .map((a) => legionAt(s, a, 'harkonnen')!)
    .reduce((m, l) => (combatPower(l) > combatPower(m) ? l : m));

  // Merge case: a legion adjacent to the target moves into the adjacent Harkonnen legion
  // (nearest the target) to combine forces.
  if (harkonnenAreAdjacent(chosen.area, target)) {
    const mergeInto = harkonnenNeighbors(chosen.area)
      .filter((n) => hAreas.has(n) && n !== target)
      .sort(
        (a, b) =>
          harkonnenDistance(a, target, { blocked, allowBlockedTarget: true }) -
          harkonnenDistance(b, target, { blocked, allowBlockedTarget: true }),
      );
    if (mergeInto.length === 0) return null;
    return { kind: 'move', legion: chosen.area, path: [chosen.area, mergeInto[0]] };
  }

  const next = pickNextStep(s, chosen.area, target);
  if (!next) return null;
  return { kind: 'move', legion: chosen.area, path: [chosen.area, next] };
}

// ---------------------------------------------------------------------------
// DEPLOYMENT action
// ---------------------------------------------------------------------------

/** A standard Harkonnen deployment places 3 units + 1 leader. */
export const DEPLOY_UNITS = 3;
/** Max units per area. */
export const STACKING_LIMIT = 6;

/** Named leaders that must be deployed before any other named leader. */
const PRIORITY_NAMED = ['Beast Rabban', 'Feyd-Rautha'];

/** Pick the leader to deploy: priority named first, then any named, then a Bashar, else null. */
function chooseDeployLeader(s: GameState): string | null {
  const named = s.harkonnenReserve.namedLeaders;
  for (const p of PRIORITY_NAMED) if (named.includes(p)) return p;
  if (named.length > 0) return named[0];
  if (s.harkonnenReserve.bashars > 0) return 'Bashar';
  return null;
}

/**
 * Pick `count` units from the reserve, substituting a missing tier with the next-higher combat
 * power (regular→elite→special_elite); nothing is lower than regular. Mutates a working copy.
 */
function pickUnits(reserve: Record<UnitType, number>, count: number): Record<UnitType, number> {
  const out: Record<UnitType, number> = { regular: 0, elite: 0, special_elite: 0 };
  const order: UnitType[] = ['regular', 'elite', 'special_elite'];
  let need = count;
  for (const t of order) {
    if (need <= 0) break;
    const take = Math.min(need, reserve[t]);
    out[t] += take;
    reserve[t] -= take;
    need -= take;
  }
  return out;
}

/**
 * Resolve a DEPLOYMENT action: deploy 3 units + 1 leader into Harkonnen settlement(s), choosing
 * by priority — the settlement whose legion has the highest combat power, then the settlement
 * closest to the target sietch. Units overflow into the next settlement when the stacking limit
 * (6 units/area) is reached. Returns a `none` action if there is nothing to deploy.
 */
export function resolveDeployment(s: GameState): HarkonnenAction {
  const reserve = { ...s.harkonnenReserve.units };
  const leader = chooseDeployLeader(s);
  const totalAvail = reserve.regular + reserve.elite + reserve.special_elite;
  if (totalAvail === 0 && !leader) return { kind: 'none', reason: 'nothing to deploy' };

  // Ordered settlements: highest-CP legion first, then closest to the target sietch.
  const settlements = s.settlements
    .filter((st) => !st.destroyed)
    .map((st) => {
      const leg = legionAt(s, st.area, 'harkonnen');
      const dist = s.targetSietchId ? harkonnenDistance(st.area, s.targetSietchId) : Infinity;
      return { area: st.area, cp: leg ? combatPower(leg) : 0, dist, used: leg ? unitCount(leg) : 0 };
    })
    .sort((a, b) => (b.cp !== a.cp ? b.cp - a.cp : a.dist - b.dist));

  if (settlements.length === 0) return { kind: 'none', reason: 'no settlements to deploy into' };

  const placements: DeployPlacement[] = [];
  let toPlace = Math.min(DEPLOY_UNITS, totalAvail);
  let leaderPlaced = false;

  for (const st of settlements) {
    if (toPlace <= 0 && (leaderPlaced || !leader)) break;
    const capacity = STACKING_LIMIT - st.used;
    if (capacity <= 0) continue;
    const units = pickUnits(reserve, Math.min(toPlace, capacity));
    const n = units.regular + units.elite + units.special_elite;
    const placeLeaderHere = !leaderPlaced && leader !== null && (n > 0 || placements.length === 0);
    if (n === 0 && !placeLeaderHere) continue;
    placements.push({ settlement: st.area, units, leader: placeLeaderHere ? leader : null });
    toPlace -= n;
    if (placeLeaderHere) leaderPlaced = true;
  }

  if (placements.length === 0) return { kind: 'none', reason: 'no capacity to deploy' };
  return { kind: 'deploy', placements };
}

// ---------------------------------------------------------------------------
// LEADERSHIP / STRATEGY cascade
// ---------------------------------------------------------------------------

/**
 * Resolve a LEADERSHIP or STRATEGY result: attack a sietch, else attack a legion, else move.
 * LEADERSHIP only considers legions containing at least one leader.
 */
export function resolveLeadershipOrStrategy(
  s: GameState,
  result: 'leadership' | 'strategy',
): HarkonnenAction {
  const requireLeader = result === 'leadership';
  return (
    selectSietchAttack(s, requireLeader) ??
    selectLegionAttack(s, requireLeader) ??
    selectMove(s) ?? { kind: 'none', reason: 'no sietch/legion attack and no move available' }
  );
}

// ---------------------------------------------------------------------------
// MENTAT action
// ---------------------------------------------------------------------------

/** Resolve MENTAT: draw 2 planning cards (alternating Harkonnen/Corrino) and play them at once. */
export function resolveMentat(_s: GameState): HarkonnenAction {
  return { kind: 'mentat' };
}

// ---------------------------------------------------------------------------
// HOUSE action
// ---------------------------------------------------------------------------

/** Distance from an area to the nearest live sietch (Infinity if none reachable). */
function distanceToNearestSietch(s: GameState, area: string): { dist: number; sietch: string | null } {
  let best = Infinity;
  let which: string | null = null;
  for (const si of s.sietches) {
    if (si.destroyed) continue;
    const d = harkonnenDistance(area, si.area);
    if (d < best) {
      best = d;
      which = si.area;
    }
  }
  return { dist: best, sietch: which };
}

/**
 * Resolve HOUSE: prefer "replace 2 regular units with 2 elite units", choosing the legion by
 * priority — closest to a sietch, then highest combat power relative to that sietch's defender,
 * then closest to the target sietch. If no replacement is possible, place vehicles instead
 * (1 harvester + 1 ornithopter, per the vehicle rules).
 */
export function resolveHouse(s: GameState): HarkonnenAction {
  const elitesAvail = s.harkonnenReserve.units.elite;
  const candidates = harkonnenLegions(s).filter((l) => l.units.regular > 0);

  if (elitesAvail > 0 && candidates.length > 0) {
    const ranked = candidates
      .map((l) => {
        const near = distanceToNearestSietch(s, l.area);
        const defCp = near.sietch ? combatPower(sietchDefender(s, near.sietch)) : 0;
        const targetDist = s.targetSietchId ? harkonnenDistance(l.area, s.targetSietchId) : Infinity;
        return { legion: l, nearDist: near.dist, cpDiff: combatPower(l) - defCp, targetDist };
      })
      .sort(
        (a, b) =>
          a.nearDist - b.nearDist || b.cpDiff - a.cpDiff || a.targetDist - b.targetDist,
      );
    const best = ranked[0];
    const count = Math.min(2, best.legion.units.regular, elitesAvail);
    return { kind: 'house_replace', legion: best.legion.area, count };
  }
  return { kind: 'house_place_vehicles' };
}

// ---------------------------------------------------------------------------
// Top-level dispatch
// ---------------------------------------------------------------------------

/** Resolve a rolled Harkonnen action-die result into a concrete decision. */
export function resolveAction(s: GameState, result: ActionResult): HarkonnenAction {
  switch (result) {
    case 'leadership':
    case 'strategy':
      return resolveLeadershipOrStrategy(s, result);
    case 'deployment':
      return resolveDeployment(s);
    case 'mentat':
      return resolveMentat(s);
    case 'house':
      return resolveHouse(s);
  }
}
