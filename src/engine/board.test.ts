import { describe, it, expect } from 'vitest';
import { AREAS, AREA_IDS, ADJACENCY, IMPASSABLE, AIR_ZONES } from './board';
import { areAdjacent, isImpassable, neighbors, shortestGroundPath } from './graph';

const ids = new Set(AREA_IDS);
const EXPECTED_SECTOR_SIZES: Record<string, number> = {
  s1: 18, s2: 10, s3: 10, s4: 20, s5: 16, s6: 9, s7: 8, s8: 9, np: 1,
};

describe('areas', () => {
  it('has exactly 101 areas', () => {
    expect(AREA_IDS.length).toBe(101);
  });

  it('every area record is self-consistent (key === id) and well-typed', () => {
    for (const [key, a] of Object.entries(AREAS)) {
      expect(a.id).toBe(key);
      expect(EXPECTED_SECTOR_SIZES[a.sector]).toBeGreaterThan(0);
    }
  });

  it('sector membership matches the verified counts', () => {
    const counts: Record<string, number> = {};
    for (const a of Object.values(AREAS)) counts[a.sector] = (counts[a.sector] ?? 0) + 1;
    expect(counts).toEqual(EXPECTED_SECTOR_SIZES);
  });

  it('has the 6 settlements and 8 sietches', () => {
    const settlements = Object.values(AREAS).filter((a) => a.settlement !== null);
    expect(settlements.map((a) => a.id).sort()).toEqual(
      ['arrakeen', 'arsunt', 'carthag', 'hagga_basin', 'imperial_basin', 'north_pole'].sort(),
    );
    expect(Object.values(AREAS).filter((a) => a.sietch).length).toBe(8);
  });

  it('has the 6 ecological testing stations', () => {
    const stations = Object.values(AREAS).filter((a) => a.testingStation);
    expect(stations.map((a) => a.id).sort()).toEqual(
      ['false_wall_east', 's1_4', 's4_15', 's5_2', 's5_6', 's8_4'].sort(),
    );
  });

  it('deep flag implies desert terrain, and the 3 named deep areas are flagged', () => {
    for (const a of Object.values(AREAS)) {
      if (a.deep === true) expect(a.terrain, `${a.id} deep but not desert`).toBe('desert');
    }
    for (const id of ['rock_outcroppings', 'sihaya_ridge', 'the_great_flat']) {
      expect(AREAS[id].deep).toBe(true);
    }
  });

  it('every area is fully terrain-typed, with grand totals matching §2', () => {
    const counts: Record<string, number> = {};
    let deep = 0;
    for (const a of Object.values(AREAS)) {
      expect(a.terrain, `${a.id} has no terrain`).not.toBeNull();
      expect(a.deep, `${a.id} has null deep`).not.toBeNull();
      counts[a.terrain as string] = (counts[a.terrain as string] ?? 0) + 1;
      if (a.deep) deep++;
    }
    expect(counts).toEqual({ plateau: 12, mountain: 19, minor_erg: 5, desert: 65 });
    expect(deep).toBe(23);
  });
});

describe('adjacency graph', () => {
  it('has an entry for every area and references only valid ids', () => {
    expect(Object.keys(ADJACENCY).sort()).toEqual([...ids].sort());
    for (const [a, nbrs] of Object.entries(ADJACENCY)) {
      for (const b of nbrs) {
        expect(ids.has(b), `${a} -> unknown ${b}`).toBe(true);
        expect(b, `${a} self-loop`).not.toBe(a);
      }
      expect(new Set(nbrs).size, `${a} has duplicate neighbours`).toBe(nbrs.length);
    }
  });

  it('is symmetric (A↔B ⇒ B↔A)', () => {
    for (const [a, nbrs] of Object.entries(ADJACENCY)) {
      for (const b of nbrs) {
        expect(areAdjacent(b, a), `asymmetric ${a}-${b}`).toBe(true);
      }
    }
  });

  it('has no isolated areas', () => {
    for (const id of AREA_IDS) {
      expect(neighbors(id).length, `${id} is isolated`).toBeGreaterThan(0);
    }
  });

  it('has 265 undirected passable edges', () => {
    const total = Object.values(ADJACENCY).reduce((n, nbrs) => n + nbrs.length, 0);
    expect(total % 2).toBe(0);
    expect(total / 2).toBe(265);
  });

  it('is fully connected over ground (every area reachable from north_pole)', () => {
    for (const id of AREA_IDS) {
      expect(shortestGroundPath('north_pole', id), `${id} unreachable`).not.toBeNull();
    }
  });
});

describe('impassable borders', () => {
  it('has 11 pairs of valid, distinct ids', () => {
    expect(IMPASSABLE.length).toBe(11);
    for (const [a, b] of IMPASSABLE) {
      expect(ids.has(a) && ids.has(b)).toBe(true);
      expect(a).not.toBe(b);
    }
  });

  it('never coincides with a passable edge (red and white are disjoint)', () => {
    for (const [a, b] of IMPASSABLE) {
      expect(areAdjacent(a, b), `${a}-${b} is both passable and impassable`).toBe(false);
      expect(isImpassable(a, b)).toBe(true);
    }
  });
});

describe('air zones', () => {
  it('has 8 zones, each connecting >= 2 valid, distinct areas', () => {
    expect(AIR_ZONES.length).toBe(8);
    for (const z of AIR_ZONES) {
      expect(z.areas.length).toBeGreaterThanOrEqual(2);
      expect(new Set(z.areas).size).toBe(z.areas.length);
      for (const a of z.areas) expect(ids.has(a), `${z.id} -> unknown ${a}`).toBe(true);
    }
  });

  it('az1 bridges exactly where the ground is impassable (s1_5/s1_7 ↔ s5_5)', () => {
    const az1 = AIR_ZONES.find((z) => z.id === 'az1')!;
    expect(az1.areas).toContain('s5_5');
    expect(isImpassable('s1_5', 's5_5')).toBe(true);
    expect(isImpassable('s1_7', 's5_5')).toBe(true);
  });
});
