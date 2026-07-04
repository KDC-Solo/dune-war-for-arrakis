// Human-like Harkonnen "brains" with difficulty levels (M8). The Mahdi solo bot resolves a die
// face through fixed priority tables; a brain instead GENERATES candidate directives, SCORES the
// world each one leads to, and picks with a temperature — so it forms plans, defends, and stays
// a little unpredictable, like a human opponent.
//
// Honesty rule: unlike the Mahdi bot (which the solo rules allow to know everything), brains only
// use information a human Harkonnen player could see — an unrevealed sietch rank is an ESTIMATE
// (2), facedown Atreides tokens count only as the 1 visible unit each, and the player's Secret
// Objective is never read.
//
// The chassis is unchanged: dice, directives, battles, and the UI all work exactly as with the
// Mahdi bot — only the decision inside `resolveAction` is swapped.

import type { GameState, Legion } from './state';
import type { ActionResult } from './state';
import { combatPower, fineCombatPower } from './combatPower';
import { harkonnenDistance, harkonnenNeighbors, harkonnenAreAdjacent } from './movement';
import {
  resolveAction,
  resolveDeployment,
  effectiveTarget,
  selectMove,
  harkonnenLegions,
  atreidesLegions,
  legionAt,
  blockedForHarkonnen,
  type HarkonnenAction,
} from './harkonnenActions';
import { applyHarkonnenAction } from './applyAction';

export type BrainId = 'mahdi' | 'recruit' | 'bashar' | 'baron';

export interface BrainProfile {
  id: Exclude<BrainId, 'mahdi'>;
  label: string;
  /** Softmax temperature over candidate scores — higher = more erratic. */
  temperature: number;
  /** How much it cares about threats to its settlements (defense). */
  threatWeight: number;
  /** Combat-power edge it wants before an attack looks attractive. */
  attackCaution: number;
  /** Considers ornithopter (troop-transport) sietch attacks. */
  useOrnithopter: boolean;
}

export const BRAIN_PROFILES: readonly BrainProfile[] = [
  { id: 'recruit', label: 'Recruit — careless & erratic', temperature: 2.2, threatWeight: 0, attackCaution: 0, useOrnithopter: false },
  { id: 'bashar', label: 'Bashar — a solid opponent', temperature: 0.8, threatWeight: 1, attackCaution: 1, useOrnithopter: true },
  { id: 'baron', label: 'Baron — ruthless & watchful', temperature: 0.3, threatWeight: 2.5, attackCaution: 1, useOrnithopter: true },
];

export const BRAIN_LABELS: Record<BrainId, string> = {
  mahdi: 'Mahdi — the official solo bot',
  recruit: BRAIN_PROFILES[0].label,
  bashar: BRAIN_PROFILES[1].label,
  baron: BRAIN_PROFILES[2].label,
};

// ---------------------------------------------------------------------------
// Honest views of hidden information
// ---------------------------------------------------------------------------

/** Sietch rank a human Harkonnen would assume: real if revealed, an estimate of 2 if facedown. */
function assumedSietchRank(s: GameState, area: string): number {
  const si = s.sietches.find((x) => x.area === area && !x.destroyed);
  if (!si) return 0;
  return si.revealed ? (si.rank ?? 2) : 2;
}

// ---------------------------------------------------------------------------
// Position evaluation (Harkonnen perspective; bigger = better)
// ---------------------------------------------------------------------------

function evaluate(s: GameState, threatWeight: number): number {
  let score = 6 * s.tracks.supremacy;
  score += 10 * s.sietches.filter((si) => si.destroyed).length;

  const hk = harkonnenLegions(s);
  const at = atreidesLegions(s);
  score += 1.5 * hk.reduce((n, l) => n + fineCombatPower(l), 0);
  score -= 1.2 * at.reduce((n, l) => n + fineCombatPower(l), 0);

  // Pressure on the campaign target: advance the strongest legion, mass power next to it.
  const target = effectiveTarget(s);
  if (target) {
    const strongest = hk.reduce((m, l) => (fineCombatPower(l) > fineCombatPower(m ?? l) ? l : m), hk[0]);
    if (strongest) score -= 0.8 * Math.min(12, harkonnenDistance(strongest.area, target));
    score += 2 * hk.filter((l) => harkonnenAreAdjacent(l.area, target)).reduce((n, l) => n + combatPower(l), 0) / 4;
  }

  // Defense: an Atreides stack next to a weakly-held live settlement is a liability.
  if (threatWeight > 0) {
    for (const st of s.settlements) {
      if (st.destroyed) continue;
      const holder = legionAt(s, st.area, 'harkonnen');
      const held = holder ? fineCombatPower(holder) : 0;
      const threat = at
        .filter((l) => l.area === st.area || harkonnenAreAdjacent(l.area, st.area))
        .reduce((n, l) => n + fineCombatPower(l), 0);
      score -= threatWeight * 1.5 * Math.max(0, threat - held);
    }
  }
  return score;
}

// ---------------------------------------------------------------------------
// Candidate generation per die face
// ---------------------------------------------------------------------------

interface Candidate {
  action: HarkonnenAction;
  score: number;
}

function attackScore(s: GameState, p: BrainProfile, attacker: Legion, defenderArea: string, sietch: boolean, useOrnithopter: boolean): number {
  const def = legionAt(s, defenderArea, 'atreides');
  const defCp = (def ? combatPower(def) : 0) + (sietch ? assumedSietchRank(s, defenderArea) : 0);
  const edge = combatPower(attacker) - defCp - p.attackCaution;
  let bonus = 4 * edge;
  if (sietch) {
    bonus += 3 * assumedSietchRank(s, defenderArea);
    if (defenderArea === s.targetSietchId) bonus += 5;
  }
  if (useOrnithopter) bonus -= 2;
  return evaluate(s, p.threatWeight) + bonus;
}

/** One-step move candidate for `legion` toward `goal` (null if already there / unreachable). */
function stepToward(s: GameState, legion: Legion, goal: string): HarkonnenAction | null {
  const blocked = blockedForHarkonnen(s);
  const d = harkonnenDistance(legion.area, goal, { blocked, allowBlockedTarget: true });
  if (!isFinite(d) || d <= 1) return null;
  const step = harkonnenNeighbors(legion.area).find(
    (n) => !blocked(n) && harkonnenDistance(n, goal, { blocked, allowBlockedTarget: true }) === d - 1,
  );
  return step ? { kind: 'move', legion: legion.area, path: [legion.area, step] } : null;
}

function candidatesFor(s: GameState, face: ActionResult, p: BrainProfile): Candidate[] {
  const out: Candidate[] = [];
  const hk = harkonnenLegions(s);
  const scoreApplied = (a: HarkonnenAction, kindBonus = 0): number => {
    const res = applyHarkonnenAction(s, a);
    return (res.applied ? evaluate(res.state, p.threatWeight) : evaluate(s, p.threatWeight)) + kindBonus;
  };

  if (face === 'leadership' || face === 'strategy') {
    const attackers = face === 'leadership' ? hk.filter((l) => l.leaders.length > 0) : hk;
    for (const a of attackers) {
      // Sietch assaults from adjacency (a human takes calculated risks; caution is per-profile).
      for (const si of s.sietches) {
        if (si.destroyed) continue;
        if (!harkonnenAreAdjacent(a.area, si.area)) continue;
        const def = legionAt(s, si.area, 'atreides');
        const defCp = (def ? combatPower(def) : 0) + assumedSietchRank(s, si.area);
        if (combatPower(a) <= defCp - 1) continue; // hopeless — even Recruit skips these
        out.push({
          action: { kind: 'attack_sietch', attacker: a.area, sietch: si.area, useOrnithopter: false },
          score: attackScore(s, p, a, si.area, true, false),
        });
      }
      // Field battles against adjacent legions.
      for (const t of atreidesLegions(s)) {
        if (!harkonnenAreAdjacent(a.area, t.area)) continue;
        if (combatPower(a) <= combatPower(t) - 1) continue;
        out.push({
          action: { kind: 'attack_legion', attacker: a.area, defender: t.area },
          score: attackScore(s, p, a, t.area, false, false),
        });
      }
    }
    // Moves: the Mahdi step plus one-step advances for the two legions nearest the target,
    // and (for watchful profiles) a defensive move toward the most threatened settlement.
    const mahdiMove = selectMove(s);
    if (mahdiMove) out.push({ action: mahdiMove, score: scoreApplied(mahdiMove) });
    const target = effectiveTarget(s);
    if (target) {
      const near = [...hk].sort((x, y) => harkonnenDistance(x.area, target) - harkonnenDistance(y.area, target)).slice(0, 2);
      for (const l of near) {
        const mv = stepToward(s, l, target);
        if (mv) out.push({ action: mv, score: scoreApplied(mv) });
      }
    }
    if (p.threatWeight > 0) {
      const threatened = s.settlements.filter((st) => !st.destroyed).find((st) =>
        atreidesLegions(s).some((l) => harkonnenAreAdjacent(l.area, st.area)),
      );
      if (threatened) {
        for (const l of hk.slice(0, 3)) {
          const mv = stepToward(s, l, threatened.area);
          if (mv) out.push({ action: mv, score: scoreApplied(mv, 0.5) });
        }
      }
    }
  } else if (face === 'deployment') {
    const d = resolveDeployment(s);
    out.push({ action: d, score: scoreApplied(d) });
  } else if (face === 'mentat') {
    out.push({ action: { kind: 'mentat' }, score: evaluate(s, p.threatWeight) + 1.5 });
  } else if (face === 'house') {
    const elites = s.harkonnenReserve.units.elite;
    if (elites > 0) {
      for (const l of hk.filter((x) => x.units.regular > 0).slice(0, 4)) {
        const a: HarkonnenAction = { kind: 'house_replace', legion: l.area, count: Math.min(2, l.units.regular, elites) };
        out.push({ action: a, score: scoreApplied(a) });
      }
    }
    const veh: HarkonnenAction = { kind: 'house_place_vehicles' };
    out.push({ action: veh, score: scoreApplied(veh) });
  }

  if (out.length === 0) {
    const fallback = resolveAction(s, face);
    out.push({ action: fallback, score: 0 });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Choice + dispatch
// ---------------------------------------------------------------------------

/** Softmax pick over candidate scores; temperature controls how often non-best moves happen. */
function softmaxPick(cands: Candidate[], temperature: number, rng: () => number): Candidate {
  const max = Math.max(...cands.map((c) => c.score));
  const weights = cands.map((c) => Math.exp((c.score - max) / Math.max(0.05, temperature)));
  const total = weights.reduce((a, b) => a + b, 0);
  let roll = rng() * total;
  for (let i = 0; i < cands.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return cands[i];
  }
  return cands[cands.length - 1];
}

/**
 * Resolve a rolled die face with the chosen brain. 'mahdi' delegates to the official solo bot;
 * the others generate + score candidates and pick by temperature. `rng` returns [0,1).
 */
export function decideHarkonnenAction(
  s: GameState,
  face: ActionResult,
  brain: BrainId,
  rng: () => number = Math.random,
): HarkonnenAction {
  if (brain === 'mahdi') return resolveAction(s, face);
  const profile = BRAIN_PROFILES.find((p) => p.id === brain) ?? BRAIN_PROFILES[1];
  const cands = candidatesFor(s, face, profile);
  return softmaxPick(cands, profile.temperature, rng).action;
}
