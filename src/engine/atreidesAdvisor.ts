// The player Advisor: an optional "suggested move" for the Atreides side, in the spirit of the
// Harkonnen brains (harkonnenBrain.ts) — generate candidate actions, score them, pick the best —
// but deterministic (no temperature) and explained: every suggestion carries a WHY the player can
// learn from. It advises only the ACTION phase (attacks and moves); planning cards and battle
// decisions stay the player's own.
//
// Honesty: GameState only ever holds what the player can see on their own table (their facedown
// sietch ranks are stored as null, testing-station values aren't stored at all), so the advisor
// is honest by construction. Where a rank is unknown it estimates 2 — the same guess the brains
// make about us.

import type { GameState, Legion } from './state';
import { unitCount } from './state';
import { combatPower } from './combatPower';
import { standardNeighbors, legalMoveDestinations } from './moveTargets';
import { harkonnenAreAdjacent } from './movement';
import { legionAt, atreidesLegions, harkonnenLegions } from './harkonnenActions';
import { areaLabel } from './describeArea';

export type AtreidesSuggestion =
  /** Assault the Harkonnen settlement in `area` from the legion in `from`. */
  | { kind: 'assault_settlement'; from: string; area: string; rank: 1 | 2 | 3 }
  /** Attack the Harkonnen field legion in `area` from the legion in `from`. */
  | { kind: 'attack_legion'; from: string; area: string }
  /** Move the legion `from` → `to`, in service of `goalArea`. */
  | { kind: 'move'; from: string; to: string; goal: 'testing_station' | 'defend_sietch' | 'advance'; goalArea: string };

export interface AdvisorAdvice {
  suggestion: AtreidesSuggestion;
  /** One teaching line: the dominant reason this move scored highest. */
  why: string;
  score: number;
}

// ---------------------------------------------------------------------------
// Board reading (Atreides perspective — standard white-border adjacency)
// ---------------------------------------------------------------------------

/** BFS hop-count over standard adjacency, ignoring blockers (a guidance heuristic, not a mover). */
function distance(from: string, to: string): number {
  if (from === to) return 0;
  const seen = new Set([from]);
  let frontier = [from];
  for (let d = 1; frontier.length > 0 && d <= 30; d++) {
    const next: string[] = [];
    for (const cur of frontier) {
      for (const nb of standardNeighbors(cur)) {
        if (seen.has(nb)) continue;
        if (nb === to) return d;
        seen.add(nb);
        next.push(nb);
      }
    }
    frontier = next;
  }
  return Infinity;
}

/** Our sietch rank as the player knows it: real if revealed, else the standard estimate of 2. */
function ownSietchRank(s: GameState, area: string): number {
  const si = s.sietches.find((x) => x.area === area && !x.destroyed);
  if (!si) return 0;
  return si.revealed ? (si.rank ?? 2) : 2;
}

/** Harkonnen combat power that can fall on `area` next turn (expanded solo adjacency + on it). */
function harkonnenPressure(s: GameState, area: string): number {
  return harkonnenLegions(s)
    .filter((l) => unitCount(l) > 0 && (l.area === area || harkonnenAreAdjacent(l.area, area)))
    .reduce((n, l) => n + combatPower(l), 0);
}

// ---------------------------------------------------------------------------
// Candidate generation + scoring
// ---------------------------------------------------------------------------

interface Candidate extends AdvisorAdvice {}

function candidates(s: GameState): Candidate[] {
  const out: Candidate[] = [];
  const mine = atreidesLegions(s)
    .filter((l) => unitCount(l) > 0)
    .sort((a, b) => a.area.localeCompare(b.area)); // deterministic order → deterministic tie-breaks

  const liveSettlements = s.settlements.filter((st) => !st.destroyed);
  const settlementAreas = new Set(liveSettlements.map((st) => st.area));
  const stations = s.testingStations.filter((t) => !t.revealed).map((t) => t.area);

  // The sietch most worth defending: the Harkonnen's current target first, else the most
  // outmatched live sietch. `deficit` = pressure the garrison cannot answer.
  const sietchDeficit = (area: string): number =>
    Math.max(0, harkonnenPressure(s, area) - ((legionAt(s, area, 'atreides') ? combatPower(legionAt(s, area, 'atreides')!) : 0) + ownSietchRank(s, area)));
  const defendable = s.sietches
    .filter((si) => !si.destroyed && sietchDeficit(si.area) > 0)
    .sort((a, b) => (b.area === s.targetSietchId ? 1 : 0) - (a.area === s.targetSietchId ? 1 : 0) || sietchDeficit(b.area) - sietchDeficit(a.area));
  const guard = defendable[0] ?? null;

  const strongest = mine.reduce<Legion | null>((m, l) => (m === null || combatPower(l) > combatPower(m) ? l : m), null);

  for (const legion of mine) {
    const myCp = combatPower(legion);

    // 1. Assault an adjacent settlement — the prescience engine (ALL markers +rank on a kill).
    for (const st of liveSettlements) {
      if (!standardNeighbors(legion.area).includes(st.area)) continue;
      const garrison = legionAt(s, st.area, 'harkonnen');
      const defCp = (garrison ? combatPower(garrison) : 0) + st.rank;
      const edge = myCp - defCp;
      if (edge < 1) continue; // the advisor teaches favorable fights, not coin flips
      out.push({
        suggestion: { kind: 'assault_settlement', from: legion.area, area: st.area, rank: st.rank },
        score: 10 + 6 * st.rank + 2 * edge,
        why: `Destroying ${areaLabel(st.area)} advances every prescience marker by ${st.rank}, and you outmatch its defense ${myCp} to ${defCp}.`,
      });
    }

    // 2. Field battle against an adjacent Harkonnen legion (settlement areas are assaults above).
    for (const enemy of harkonnenLegions(s)) {
      if (unitCount(enemy) === 0 || settlementAreas.has(enemy.area)) continue;
      if (!standardNeighbors(legion.area).includes(enemy.area)) continue;
      const edge = myCp - combatPower(enemy);
      if (edge < 1) continue;
      const relieves = guard !== null && (enemy.area === guard.area || harkonnenAreAdjacent(enemy.area, guard.area));
      out.push({
        suggestion: { kind: 'attack_legion', from: legion.area, area: enemy.area },
        score: 2 + 2 * edge + (relieves ? 8 : 0),
        why: relieves
          ? `That legion is bearing down on your sietch at ${areaLabel(guard!.area)} — destroy it before it strikes (you outmatch it ${myCp} to ${combatPower(enemy)}).`
          : `You outmatch it ${myCp} to ${combatPower(enemy)} — thin the Harkonnen while the odds are yours.`,
      });
    }

    // 3. Moves (already rule-legal: ground + sandriding, stacking respected).
    const dests = legalMoveDestinations(s, legion);

    //    3a. Claim an ecological testing station — a free prescience point on entry.
    for (const st of stations) {
      if (!dests.has(st)) continue;
      out.push({
        suggestion: { kind: 'move', from: legion.area, to: st, goal: 'testing_station', goalArea: st },
        score: 12,
        why: `Entering ${areaLabel(st)} claims its ecological testing station — a free prescience point.`,
      });
    }

    //    3b. Reinforce the hunted / outmatched sietch: the step that gets closest to it.
    if (guard && legion.area !== guard.area) {
      const now = distance(legion.area, guard.area);
      let best: string | null = null;
      let bestD = now;
      for (const d of dests) {
        const dd = distance(d, guard.area);
        if (dd < bestD) {
          bestD = dd;
          best = d;
        }
      }
      if (best) {
        const deficit = sietchDeficit(guard.area);
        out.push({
          suggestion: { kind: 'move', from: legion.area, to: best, goal: 'defend_sietch', goalArea: guard.area },
          score: (guard.area === s.targetSietchId ? 6 : 4) + 1.5 * Math.min(6, deficit) - 0.5 * bestD,
          why:
            guard.area === s.targetSietchId
              ? `The Harkonnen are hunting the sietch at ${areaLabel(guard.area)} and its defenders are outmatched by ${deficit} — move to reinforce it.`
              : `Your sietch at ${areaLabel(guard.area)} is outmatched by ${deficit} — move to reinforce it.`,
        });
      }
    }

    //    3c. Advance the strongest legion on the nearest settlement it can hope to crack.
    if (legion === strongest && myCp >= 4) {
      const reachable = liveSettlements
        .map((st) => ({ st, d: distance(legion.area, st.area) }))
        .filter((x) => isFinite(x.d) && x.d >= 2)
        .sort((a, b) => a.d - b.d)[0];
      if (reachable) {
        let best: string | null = null;
        let bestD = reachable.d;
        for (const d of dests) {
          const dd = distance(d, reachable.st.area);
          if (dd < bestD) {
            bestD = dd;
            best = d;
          }
        }
        if (best) {
          out.push({
            suggestion: { kind: 'move', from: legion.area, to: best, goal: 'advance', goalArea: reachable.st.area },
            score: 1 + 0.5 * Math.max(0, 6 - bestD),
            why: `March your strongest legion on ${areaLabel(reachable.st.area)} — destroyed settlements advance every prescience marker, and this one is nearest.`,
          });
        }
      }
    }
  }

  return out;
}

/**
 * The advisor's one suggested move for the current state, or null when it has nothing worth
 * saying (no legions, or no candidate clears its bar). Deterministic: same state, same advice.
 */
export function adviseAtreides(s: GameState): AdvisorAdvice | null {
  const cands = candidates(s);
  let best: Candidate | null = null;
  for (const c of cands) if (best === null || c.score > best.score) best = c;
  return best;
}
