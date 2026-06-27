import { describe, it, expect } from 'vitest';
import {
  placeHarvesters,
  areasInSector,
  sectorsAdjacentTo,
  placeCarryalls,
  placeOrnithopters,
  placeVehicles,
} from './vehiclePlacement';
import { AREAS } from './board';
import { airZoneSectors } from './movement';
import { emptyLegion, type GameState, type Legion, type SietchState } from './state';

function state(over: Partial<GameState> = {}): GameState {
  return {
    round: 1,
    phase: 'vehicle_placement',
    settlements: [],
    sietches: [],
    testingStations: [],
    legions: [],
    vehicles: [],
    wormsigns: [],
    sandworms: [],
    harvestingSector: 's3',
    targetSietchId: null,
    spice: { markers: { choam: 3, spacing_guild: 3, landsraad: 3 }, activeBans: [], spiceReserve: 0 },
    tracks: { supremacy: 0, prescience: [0, 0, 0] },
    decks: {
      planning: { house_atreides: 10, fremen_ally: 10, house_harkonnen: 10, corrino_ally: 10 },
      planningDiscard: { house_atreides: 0, fremen_ally: 0, house_harkonnen: 0, corrino_ally: 0 },
      prescienceDeck: 16,
      reinforcements: 0,
      wormsignPool: 16,
      tacticalDeck: 8,
    },
    harkonnenReserve: { units: { regular: 16, elite: 8, special_elite: 8 }, deploymentTokens: 12, bashars: 2, namedLeaders: [] },
    beneGesserit: { atreides: 1, reserve: 4 },
    harkonnenUnusedDice: 0,
    atreidesUnusedDice: 0,
    ...over,
  };
}

const aLegion = (area: string): Legion => ({ ...emptyLegion('atreides', area), units: { regular: 1, elite: 0, special_elite: 0 } });
const sietch = (area: string): SietchState => ({ area, rank: 1, revealed: false, destroyed: false });

describe('areasInSector', () => {
  it('central selection spans all 4 central sectors', () => {
    const areas = areasInSector('central');
    const sectors = new Set(areas.map((a) => AREAS[a].sector));
    expect(sectors).toEqual(new Set(['s5', 's6', 's7', 's8']));
  });
  it('an outer selection is just that sector', () => {
    expect(areasInSector('s3').every((a) => AREAS[a].sector === 's3')).toBe(true);
  });
});

describe('sectorsAdjacentTo', () => {
  it('returns real neighbouring sectors (never np, never itself)', () => {
    const adj = sectorsAdjacentTo('s3');
    expect(adj).not.toContain('s3');
    expect(adj).not.toContain('np');
    expect(adj.length).toBeGreaterThan(0);
  });
});

describe('placeHarvesters', () => {
  it('places nothing when count is 0 or no harvesting sector', () => {
    expect(placeHarvesters(state(), 0)).toEqual([]);
    expect(placeHarvesters(state({ harvestingSector: null }), 3)).toEqual([]);
  });

  it('prefers empty deep desert, then empty shallow desert', () => {
    // s3 deep: s3_1,4,6,7,9 ; shallow: s3_2,3,5
    const got = placeHarvesters(state(), 5);
    expect(got).toHaveLength(5);
    // first 5 should all be deep desert (5 available)
    expect(got.every((a) => AREAS[a].deep === true)).toBe(true);
  });

  it('falls to shallow desert once deep is used up', () => {
    const got = placeHarvesters(state(), 7); // 5 deep + 2 shallow
    expect(got).toHaveLength(7);
    const deep = got.filter((a) => AREAS[a].deep);
    const shallow = got.filter((a) => !AREAS[a].deep);
    expect(deep).toHaveLength(5);
    expect(shallow).toHaveLength(2);
  });

  it('demotes areas adjacent to an Atreides legion/sietch to the lower (free) tiers', () => {
    // Put a sietch at habbanya_ridge (adjacent to s3_1..s3_6). Then s3_1 (deep) is adjacent ->
    // it should not be chosen in tier 1, but s3_7/s3_9 (deep, not adjacent) come first.
    const s = state({ sietches: [sietch('habbanya_ridge')] });
    const got = placeHarvesters(s, 2);
    // habbanya_ridge neighbours (s3_1..s3_6) are adjacent; s3_7 and s3_9 are the non-adjacent deep ones.
    expect(got).toEqual(['s3_7', 's3_9']);
  });

  it('never places on an Atreides-occupied or sandworm area', () => {
    const s = state({ legions: [aLegion('s3_7')], sandworms: [{ area: 's3_9' }] });
    const got = placeHarvesters(s, 8);
    expect(got).not.toContain('s3_7');
    expect(got).not.toContain('s3_9');
  });

  it('overflows into an adjacent sector when the harvesting sector is exhausted', () => {
    const got = placeHarvesters(state(), 12); // s3 has 8 desert; rest spill over
    expect(got.length).toBeGreaterThan(8);
    const outside = got.filter((a) => AREAS[a].sector !== 's3');
    expect(outside.length).toBeGreaterThan(0);
  });
});

describe('placeCarryalls', () => {
  it('picks the unoccupied zones protecting the most harvesters', () => {
    // az5 members: false_wall_south, hobars_gap, s2_8 ; az6: s6_4, s7_5, s7_6
    const harvesters = ['hobars_gap', 's2_8', 's7_6']; // az5 protects 2, az6 protects 1
    const got = placeCarryalls(state(), 1, harvesters);
    expect(got).toEqual(['az5']);
  });

  it('skips zones protecting no harvesters and respects count', () => {
    const got = placeCarryalls(state(), 5, ['hobars_gap']); // only az5 protects any
    expect(got).toEqual(['az5']);
  });

  it('does not reuse an already-occupied zone', () => {
    const s = state({ vehicles: [{ type: 'carryall', location: 'az5' }] });
    const got = placeCarryalls(s, 1, ['hobars_gap', 's2_8']);
    expect(got).not.toContain('az5');
  });
});

describe('placeOrnithopters', () => {
  it('covers the target sietch sector when no 2-away threats exist', () => {
    const s = state({ harvestingSector: 's3', targetSietchId: 'gara_kulon' }); // gara_kulon in s1
    const got = placeOrnithopters(s, 1);
    expect(got.length).toBe(1);
    // chosen zone must connect to s1 (the target's sector)
    expect(airZoneSectors(got[0])).toContain('s1');
  });

  it('returns nothing for count 0', () => {
    expect(placeOrnithopters(state(), 0)).toEqual([]);
  });
});

describe('placeVehicles orchestrator', () => {
  it('places harvesters, then carryalls over them, then ornithopters', () => {
    const s = state({ harvestingSector: 's3', targetSietchId: 'gara_kulon' });
    const out = placeVehicles(s, { harvesters: 5, carryalls: 1, ornithopters: 1 });
    expect(out.harvesters).toHaveLength(5);
    // carryall (if any) and ornithopter must not collide on the same zone
    for (const c of out.carryalls) expect(out.ornithopters).not.toContain(c);
  });
});
