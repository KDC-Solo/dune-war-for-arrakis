import { describe, it, expect } from 'vitest';
import {
  harkonnenNeighbors,
  harkonnenAreAdjacent,
  harkonnenDistance,
  harkonnenShortestPath,
  nearestByDistance,
  airZoneSectors,
  airZonesConnectedToSector,
  canTroopTransport,
  withinAttackReach,
} from './movement';
import { ADJACENCY, IMPASSABLE, AIR_ZONES } from './board';

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

describe('air zones & troop-transport', () => {
  it('derives each air zone sectors matching the verified straddles', () => {
    // az1 straddles s1<->s5 (board §5)
    expect(airZoneSectors('az1').sort()).toEqual(['s1', 's5']);
    expect(airZoneSectors('az4').sort()).toEqual(['s5', 's6']);
  });

  it('every air zone connects exactly the 2 sectors of its member areas', () => {
    for (const z of AIR_ZONES) {
      const secs = airZoneSectors(z.id);
      expect(secs.length).toBe(2);
      for (const s of secs) expect(airZonesConnectedToSector(s)).toContain(z.id);
    }
  });

  it('canTroopTransport requires an ornithopter zone connected to the start sector', () => {
    // az1 connects s1 & s5.
    expect(canTroopTransport('s1', ['az1'])).toBe(true);
    expect(canTroopTransport('s5', ['az1'])).toBe(true);
    expect(canTroopTransport('s2', ['az1'])).toBe(false);
    expect(canTroopTransport('s1', [])).toBe(false);
  });
});

describe('withinAttackReach', () => {
  it('adjacent targets are always reachable', () => {
    const from = 'carthag';
    const adj = harkonnenNeighbors(from)[0];
    expect(withinAttackReach(from, adj, false)).toBe(true);
  });

  it('distance-2 targets need troop-transport', () => {
    const from = 'carthag';
    const one = harkonnenNeighbors(from)[0];
    // a neighbour of `one` that is not adjacent to `from` and isn't `from`
    const two = harkonnenNeighbors(one).find(
      (a) => a !== from && !harkonnenAreAdjacent(from, a),
    )!;
    expect(two).toBeDefined();
    expect(withinAttackReach(from, two, false)).toBe(false);
    expect(withinAttackReach(from, two, true)).toBe(true);
  });
});
