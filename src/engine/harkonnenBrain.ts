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
//
// Persistent plans (M8): `ensureBrainPlan` keeps a multi-round intention (`GameState.brainPlan`)
// — push a sietch or defend a settlement — and `decideHarkonnenAction` biases candidates toward
// it, so a brain follows through across dice instead of re-deciding from zero every roll.

import type { BrainPlan, GameState, Legion } from './state';
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

export type BrainId = 'mahdi' | 'recruit' | 'bashar' | 'baron' | 'mentat';

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
  /** How strongly candidates aligned with the current plan are favored (0 = never plans). */
  planWeight: number;
  /** Rounds a plan is kept before re-planning (0 = never plans). */
  planHorizon: number;
  /** Search: penalize candidates by the best Atreides reply on the resulting board. */
  lookahead: boolean;
}

export const BRAIN_PROFILES: readonly BrainProfile[] = [
  { id: 'recruit', label: 'Recruit — careless & erratic', temperature: 2.2, threatWeight: 0, attackCaution: 0, useOrnithopter: false, planWeight: 0, planHorizon: 0, lookahead: false },
  { id: 'bashar', label: 'Bashar — a solid opponent', temperature: 0.8, threatWeight: 1, attackCaution: 1, useOrnithopter: true, planWeight: 1, planHorizon: 2, lookahead: false },
  { id: 'baron', label: 'Baron — ruthless & watchful', temperature: 0.3, threatWeight: 2.5, attackCaution: 1, useOrnithopter: true, planWeight: 1.2, planHorizon: 3, lookahead: false },
  { id: 'mentat', label: 'Mentat — calculating & farsighted', temperature: 0.15, threatWeight: 2, attackCaution: 1, useOrnithopter: true, planWeight: 1.5, planHorizon: 4, lookahead: true },
];

export const BRAIN_LABELS: Record<BrainId, string> = {
  mahdi: 'Mahdi — the official solo bot',
  recruit: BRAIN_PROFILES[0].label,
  bashar: BRAIN_PROFILES[1].label,
  baron: BRAIN_PROFILES[2].label,
  mentat: BRAIN_PROFILES[3].label,
};

function profileOf(brain: BrainId): BrainProfile {
  return BRAIN_PROFILES.find((p) => p.id === brain) ?? BRAIN_PROFILES[1];
}

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
      score -= threatWeight * 1.5 * settlementThreat(s, st.area);
    }
  }
  return score;
}

/**
 * Visible Atreides pressure on a settlement, net of its garrison (0 when safely held).
 * Legions sitting inside a live sietch don't count — a Naib garrison is defensive furniture,
 * not an army on the march, and counting it would make watchful brains cower from round 1.
 */
function settlementThreat(s: GameState, area: string): number {
  const holder = legionAt(s, area, 'harkonnen');
  // A facedown deployment token holds 2 units the Harkonnen player knows about.
  const held = (holder ? fineCombatPower(holder) + 2 * holder.deploymentTokens : 0);
  const inLiveSietch = (a: string) => s.sietches.some((si) => si.area === a && !si.destroyed);
  const threat = atreidesLegions(s)
    .filter((l) => (l.area === area || harkonnenAreAdjacent(l.area, area)) && !inLiveSietch(l.area))
    .reduce((n, l) => n + fineCombatPower(l), 0);
  return Math.max(0, threat - held);
}

/**
 * The sharpest single Atreides reply visible on this board: the best battle it could pick
 * against a weaker Harkonnen legion, or a strike on an under-garrisoned live settlement.
 * Used by lookahead profiles to avoid moves that leave a hanging piece. Honest: reads only
 * on-board Atreides strength.
 */
export function atreidesReplyThreat(s: GameState): number {
  let worst = 0;
  const hk = harkonnenLegions(s);
  for (const l of atreidesLegions(s)) {
    const my = fineCombatPower(l);
    for (const h of hk) {
      if (!harkonnenAreAdjacent(l.area, h.area)) continue;
      const theirs = fineCombatPower(h) + 2 * h.deploymentTokens;
      if (my > theirs + 1) worst = Math.max(worst, 0.8 * theirs + 1);
    }
    for (const st of s.settlements) {
      if (st.destroyed) continue;
      if (l.area !== st.area && !harkonnenAreAdjacent(l.area, st.area)) continue;
      const holder = legionAt(s, st.area, 'harkonnen');
      const garrison = holder ? fineCombatPower(holder) + 2 * holder.deploymentTokens : 0;
      if (my > garrison) worst = Math.max(worst, 4 + 2 * st.rank);
    }
  }
  return worst;
}

// ---------------------------------------------------------------------------
// Persistent plans
// ---------------------------------------------------------------------------

function planIsValid(s: GameState, plan: BrainPlan, p: BrainProfile): boolean {
  if (plan.brain !== p.id) return false;
  if (s.round - plan.round >= p.planHorizon) return false;
  if (plan.kind === 'push') {
    return s.sietches.some((si) => si.area === plan.area && !si.destroyed);
  }
  const st = s.settlements.find((x) => x.area === plan.area && !x.destroyed);
  return !!st && settlementThreat(s, plan.area) > 0;
}

/** Deterministic plan choice: the juiciest push vs the scariest threat, per profile weights. */
function choosePlan(s: GameState, p: BrainProfile): BrainPlan | null {
  if (p.planHorizon <= 0) return null;
  let best: { kind: 'push' | 'defend'; area: string; value: number } | null = null;
  const consider = (kind: 'push' | 'defend', area: string, value: number) => {
    if (!best || value > best.value) best = { kind, area, value };
  };

  const hk = harkonnenLegions(s);
  const strongest = hk.reduce((m, l) => (fineCombatPower(l) > fineCombatPower(m ?? l) ? l : m), hk[0]);
  for (const si of s.sietches) {
    if (si.destroyed) continue;
    const dist = strongest ? Math.min(12, harkonnenDistance(strongest.area, si.area)) : 12;
    consider(
      'push',
      si.area,
      3 * assumedSietchRank(s, si.area) + (si.area === s.targetSietchId ? 4 : 0) - 0.5 * dist,
    );
  }
  if (p.threatWeight > 0) {
    for (const st of s.settlements) {
      if (st.destroyed) continue;
      const t = settlementThreat(s, st.area);
      if (t > 0) consider('defend', st.area, 1.2 * p.threatWeight * t);
    }
  }
  if (!best) return null;
  const b: { kind: 'push' | 'defend'; area: string } = best;
  return { brain: p.id, kind: b.kind, area: b.area, round: s.round };
}

/**
 * Make sure the state carries a live plan for `brain`. Returns the SAME state object when the
 * current plan is still valid (or the brain doesn't plan), else a copy with a fresh plan —
 * commit the result alongside the die spend so plans survive save/undo.
 */
export function ensureBrainPlan(s: GameState, brain: BrainId): GameState {
  if (brain === 'mahdi') return s;
  const p = profileOf(brain);
  if (p.planHorizon <= 0) return s.brainPlan ? { ...s, brainPlan: null } : s;
  if (s.brainPlan && planIsValid(s, s.brainPlan, p)) return s;
  const plan = choosePlan(s, p);
  if (!plan && !s.brainPlan) return s;
  return { ...s, brainPlan: plan };
}

/** Extra score for a candidate that serves the current plan. */
function planBonus(p: BrainProfile, plan: BrainPlan | null, a: HarkonnenAction): number {
  if (!plan || p.planWeight <= 0) return 0;
  const w = p.planWeight;
  switch (a.kind) {
    case 'attack_sietch':
      return plan.kind === 'push' && a.sietch === plan.area ? 3 * w : 0;
    case 'attack_legion':
      if (a.defender === plan.area) return 2.5 * w;
      return harkonnenAreAdjacent(a.defender, plan.area) ? w : 0; // clearing the approaches
    case 'move': {
      const from = a.path[0];
      const to = a.path[a.path.length - 1];
      const closer = harkonnenDistance(to, plan.area) < harkonnenDistance(from, plan.area);
      return closer ? (plan.kind === 'defend' ? 1.6 : 1.2) * w : 0;
    }
    case 'deploy': {
      if (plan.kind === 'defend' && a.placements.some((pl) => pl.settlement === plan.area)) return 2 * w;
      const near = a.placements.some((pl) => harkonnenDistance(pl.settlement, plan.area) <= 2);
      return near ? 0.8 * w : 0;
    }
    default:
      return 0;
  }
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
  const plan = s.brainPlan && s.brainPlan.brain === p.id ? s.brainPlan : null;
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
    // a plan-serving step, and (for watchful profiles) a defensive move toward the most
    // threatened settlement.
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
    if (plan && plan.area !== target) {
      const near = [...hk].sort((x, y) => harkonnenDistance(x.area, plan.area) - harkonnenDistance(y.area, plan.area)).slice(0, 2);
      for (const l of near) {
        const mv = stepToward(s, l, plan.area);
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
    // Deployment variants: the Mahdi drop plus profile-shaped orderings — reinforce the push
    // (closest settlements to the objective first) and shore up the most threatened settlement.
    const live = s.settlements.filter((st) => !st.destroyed).map((st) => st.area);
    const orders: (readonly string[] | undefined)[] = [undefined];
    const goal = plan?.kind === 'push' ? plan.area : effectiveTarget(s);
    if (goal) {
      orders.push([...live].sort((a, b) => harkonnenDistance(a, goal) - harkonnenDistance(b, goal)));
    }
    if (p.threatWeight > 0) {
      orders.push([...live].sort((a, b) => settlementThreat(s, b) - settlementThreat(s, a)));
    }
    if (plan?.kind === 'defend') {
      orders.push([plan.area, ...live.filter((a) => a !== plan.area)]);
    }
    for (const order of orders) {
      const d = resolveDeployment(s, order);
      if (d.kind === 'deploy') out.push({ action: d, score: scoreApplied(d) });
    }
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

  // Plan alignment bonus, then (for search profiles) the opponent's best-reply penalty.
  for (const c of out) c.score += planBonus(p, plan, c.action);
  if (p.lookahead) {
    for (const c of out) {
      let after = s;
      if (c.action.kind !== 'attack_sietch' && c.action.kind !== 'attack_legion') {
        // Battles resolve physically; approximate their reply threat on the pre-battle board.
        const res = applyHarkonnenAction(s, c.action);
        if (res.applied) after = res.state;
      }
      c.score -= 0.9 * atreidesReplyThreat(after);
    }
  }

  // Dedupe identical directives (keep the best score) so duplicates don't skew the softmax.
  const byKey = new Map<string, Candidate>();
  for (const c of out) {
    const k = JSON.stringify(c.action);
    const prev = byKey.get(k);
    if (!prev || c.score > prev.score) byKey.set(k, c);
  }
  // Sorted best-first so rng() → 0 deterministically takes the top-scored candidate.
  return [...byKey.values()].sort((a, b) => b.score - a.score);
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
 * Call `ensureBrainPlan` on the state first so planning profiles have their intention to follow.
 */
export function decideHarkonnenAction(
  s: GameState,
  face: ActionResult,
  brain: BrainId,
  rng: () => number = Math.random,
): HarkonnenAction {
  if (brain === 'mahdi') return resolveAction(s, face);
  const profile = profileOf(brain);
  const cands = candidatesFor(s, face, profile);
  return softmaxPick(cands, profile.temperature, rng).action;
}
