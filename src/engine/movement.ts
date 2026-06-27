// Harkonnen ground-movement primitives (headless, pure-TS).
//
// Source: rulebook Movement/Troop-Transport (p22-23) + fan summary p9 Harkonnen movement.
// Two Harkonnen-specific facts drive these helpers:
//  1. SOLO: "The Harkonnens ignore impassable borders" when pathfinding — so their adjacency
//     adds the impassable pairs back as passable (general 2p rules require troop-transport to
//     cross them; the solo AI simplifies path counting by ignoring them outright).
//  2. Movement is to FREE areas only (no enemy settlements/units, no sandworms). Callers pass
//     a `blocked` predicate; harvesters and ecological stations do NOT block (areas with only
//     those are free for all players).
//
// Distance = "the least number of free areas to cross" (path length in edges). Ornithopter
// troop-transport (+1 reach, jumping one area) is handled in a separate pass.

import { ADJACENCY, IMPASSABLE, AREAS } from './board';

// Harkonnen adjacency = white-border neighbours ∪ impassable-border neighbours.
const harkonnenAdj: Record<string, string[]> = (() => {
  const adj: Record<string, Set<string>> = {};
  for (const id of Object.keys(AREAS)) adj[id] = new Set(ADJACENCY[id] ?? []);
  for (const [a, b] of IMPASSABLE) {
    adj[a]?.add(b);
    adj[b]?.add(a);
  }
  const out: Record<string, string[]> = {};
  for (const id of Object.keys(adj)) out[id] = [...adj[id]].sort();
  return out;
})();

/** Harkonnen ground neighbours of an area (impassable borders treated as passable). */
export function harkonnenNeighbors(id: string): readonly string[] {
  return harkonnenAdj[id] ?? [];
}

export function harkonnenAreAdjacent(a: string, b: string): boolean {
  return (harkonnenAdj[a] ?? []).includes(b);
}

export interface PathOptions {
  /** Areas the legion cannot enter (enemy-occupied / sandworm). The destination may be blocked
   *  (e.g. the sietch/legion being attacked) — pass `allowBlockedTarget` for that. */
  blocked?: (areaId: string) => boolean;
  /** When true, the `to` area is reachable even if `blocked(to)` is true (attack target). */
  allowBlockedTarget?: boolean;
}

/**
 * BFS shortest distance over Harkonnen ground adjacency, in number of areas crossed (edges).
 * Returns Infinity if unreachable. `from === to` is 0.
 */
export function harkonnenDistance(from: string, to: string, opts: PathOptions = {}): number {
  const path = harkonnenShortestPath(from, to, opts);
  return path ? path.length - 1 : Infinity;
}

/**
 * BFS shortest path (inclusive of both endpoints) over Harkonnen ground adjacency, or null if
 * unreachable. Intermediate areas must be unblocked; the target may be blocked when
 * `allowBlockedTarget` is set.
 */
export function harkonnenShortestPath(
  from: string,
  to: string,
  opts: PathOptions = {},
): string[] | null {
  if (!AREAS[from] || !AREAS[to]) throw new Error('Unknown area in path query');
  if (from === to) return [from];
  const blocked = opts.blocked ?? (() => false);
  const prev = new Map<string, string>();
  const queue: string[] = [from];
  const seen = new Set<string>([from]);
  while (queue.length) {
    const cur = queue.shift()!;
    for (const nb of harkonnenNeighbors(cur)) {
      if (seen.has(nb)) continue;
      // The target itself may be the blocked area we're attacking; intermediates may not be.
      if (nb !== to && blocked(nb)) continue;
      if (nb === to && blocked(nb) && !opts.allowBlockedTarget) continue;
      seen.add(nb);
      prev.set(nb, cur);
      if (nb === to) {
        const path = [to];
        let p = to;
        while (p !== from) {
          p = prev.get(p)!;
          path.push(p);
        }
        return path.reverse();
      }
      queue.push(nb);
    }
  }
  return null;
}

/**
 * The nearest source area(s) to a destination, by Harkonnen ground distance. Returns all
 * sources tied at the minimum distance (callers apply combat-power tie-breaks), with that
 * distance. Sources at Infinity (unreachable) are excluded.
 */
export function nearestByDistance(
  sources: readonly string[],
  to: string,
  opts: PathOptions = {},
): { sources: string[]; distance: number } {
  let best = Infinity;
  let winners: string[] = [];
  for (const s of sources) {
    const d = harkonnenDistance(s, to, opts);
    if (d < best) {
      best = d;
      winners = [s];
    } else if (d === best && d !== Infinity) {
      winners.push(s);
    }
  }
  return { sources: winners, distance: best };
}
