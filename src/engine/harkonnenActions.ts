// Harkonnen action resolver (Mahdi solo). Given the game state and a rolled action-die result,
// decide what the Harkonnen do, per the fan-summary p9 priority cascades. Pure & deterministic:
// returns a described decision the player executes on the physical board.
//
// This module covers the LEADERSHIP/STRATEGY cascade (attack a sietch → attack a legion → move)
// and its supporting state accessors. MENTAT/DEPLOYMENT/HOUSE and the full movement tie-breakers
// build on these primitives in later passes.

import type { GameState, Legion } from './state';
import { combatPower } from './combatPower';
import {
  harkonnenAreAdjacent,
  withinAttackReach,
  canTroopTransport,
  harkonnenShortestPath,
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

export type HarkonnenAction =
  | { kind: 'attack_sietch'; attacker: string; sietch: string; useOrnithopter: boolean }
  | { kind: 'attack_legion'; attacker: string; defender: string }
  | { kind: 'move'; legion: string; path: string[] }
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
 * Basic Harkonnen movement: move the legion nearest the target sietch one step along the shortest
 * (impassable-ignoring) path toward it. Returns null if there is no target or no legion can move.
 * NOTE: the 5 shortest-path tie-breakers and merge rules are not yet applied (follow-up).
 */
export function selectMove(s: GameState): HarkonnenAction | null {
  if (!s.targetSietchId) return null;
  const target = s.targetSietchId;
  const blocked = blockedForHarkonnen(s);
  const legions = harkonnenLegions(s).filter((l) => l.area !== target);
  if (legions.length === 0) return null;

  const { sources, distance } = nearestByDistance(
    legions.map((l) => l.area),
    target,
    { blocked, allowBlockedTarget: true },
  );
  if (sources.length === 0 || distance === Infinity || distance === 0) return null;

  // Tie-break the nearest legions by combat power (move the strongest first).
  const chosen = sources
    .map((area) => legionAt(s, area, 'harkonnen')!)
    .reduce((m, l) => (combatPower(l) > combatPower(m) ? l : m));

  const path = harkonnenShortestPath(chosen.area, target, { blocked, allowBlockedTarget: true });
  if (!path || path.length < 2) return null;
  // Advance 1 area this turn (stop before entering the sietch area itself, which is an attack).
  const next = path[1] === target ? chosen.area : path[1];
  if (next === chosen.area) return null;
  return { kind: 'move', legion: chosen.area, path: [chosen.area, next] };
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
