import { describe, it, expect } from 'vitest';
import {
  harkonnenNeighbors,
  harkonnenAreAdjacent,
  harkonnenDistance,
  harkonnenShortestPath,
  nearestByDistance,
} from './movement';
import { ADJACENCY, IMPASSABLE } from './board';

describe('harkonnen adjacency (ignores impassable borders)', () => {
  it('includes every white-border neighbour', () => {
    for (const [id, nbrs] of Object.entries(ADJACENCY)) {
      for (const n of nbrs) expect(harkonnenAreAdjacent(id, n)).toBe(true);
    }
  });

  it('adds impassable pairs back as passable', () => {
    expect(IMPASSABLE.length).toBeGreaterThan(0);
    for (const [a, b] of IMPASSABLE) {
      expect(harkonnenAreAdjacent(a, b)).toBe(true);
      expect(harkonnenAreAdjacent(b, a)).toBe(true);
      // and they are NOT in the normal passable adjacency
      expect((ADJACENCY[a] ?? []).includes(b)).toBe(false);
    }
  });

  it('is symmetric', () => {
    for (const [a, b] of IMPASSABLE) {
      expect(harkonnenNeighbors(a)).toContain(b);
      expect(harkonnenNeighbors(b)).toContain(a);
    }
  });
});

describe('harkonnenDistance / shortestPath', () => {
  it('is 0 to self', () => {
    expect(harkonnenDistance('carthag', 'carthag')).toBe(0);
  });

  it('is 1 for adjacent areas', () => {
    const a = 'carthag';
    const b = harkonnenNeighbors(a)[0];
    expect(harkonnenDistance(a, b)).toBe(1);
    expect(harkonnenShortestPath(a, b)).toEqual([a, b]);
  });

  it('path endpoints are correct and length matches distance', () => {
    const path = harkonnenShortestPath('arrakeen', 'habbanya_ridge');
    expect(path).not.toBeNull();
    expect(path![0]).toBe('arrakeen');
    expect(path![path!.length - 1]).toBe('habbanya_ridge');
    expect(harkonnenDistance('arrakeen', 'habbanya_ridge')).toBe(path!.length - 1);
  });

  it('a blocked intermediate forces a detour (longer or equal path)', () => {
    const from = 'arrakeen';
    const to = 'habbanya_ridge';
    const direct = harkonnenShortestPath(from, to)!;
    // Block the first step of the direct path.
    const blockedArea = direct[1];
    const detour = harkonnenShortestPath(from, to, { blocked: (a) => a === blockedArea });
    expect(detour).not.toBeNull();
    expect(detour!).not.toContain(blockedArea);
    expect(detour!.length).toBeGreaterThanOrEqual(direct.length);
  });

  it('cannot reach a blocked target unless allowBlockedTarget is set', () => {
    const from = 'carthag';
    const to = harkonnenNeighbors(from)[0];
    expect(harkonnenShortestPath(from, to, { blocked: (a) => a === to })).toBeNull();
    expect(harkonnenShortestPath(from, to, { blocked: (a) => a === to, allowBlockedTarget: true })).toEqual([
      from,
      to,
    ]);
  });
});

describe('nearestByDistance', () => {
  it('returns the closest source(s) and the distance', () => {
    const to = 'carthag';
    const adj = harkonnenNeighbors(to)[0]; // distance 1
    const r = nearestByDistance([adj, 'habbanya_ridge'], to);
    expect(r.sources).toContain(adj);
    expect(r.distance).toBe(1);
  });

  it('ties return all sources at the min distance', () => {
    const to = 'carthag';
    const nbrs = harkonnenNeighbors(to).slice(0, 2); // both distance 1
    const r = nearestByDistance([...nbrs], to);
    expect(r.distance).toBe(1);
    expect(r.sources.sort()).toEqual([...nbrs].sort());
  });
});
