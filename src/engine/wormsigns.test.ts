import { describe, it, expect } from 'vitest';
import {
  canPlaceWormsign,
  canPlaceSandworm,
  wormsignsToDiscard,
  wormsignPlacementAreas,
  placeWormsigns,
} from './wormsigns';
import { emptyLegion, type GameState, type Legion } from './state';
import { sampleState } from '../ui/sampleState';

// s1_5, s1_6, s1_7 are plain Desert; broken_land is Mountain; harg_pass is Minor Erg.
const base = (over: Partial<GameState>): GameState => ({
  ...sampleState(),
  legions: [],
  vehicles: [],
  wormsigns: [],
  sandworms: [],
  ...over,
});
const hk = (area: string): Legion => ({ ...emptyLegion('harkonnen', area), units: { regular: 1, elite: 0, special_elite: 0 } });
const at = (area: string): Legion => ({ ...emptyLegion('atreides', area), units: { regular: 1, elite: 0, special_elite: 0 } });

describe('canPlaceWormsign', () => {
  it('allows an empty Desert area, rejects non-Desert', () => {
    const s = base({});
    expect(canPlaceWormsign(s, 's1_5')).toBe(true);
    expect(canPlaceWormsign(s, 'broken_land')).toBe(false); // mountain
    expect(canPlaceWormsign(s, 'harg_pass')).toBe(false); // minor erg
  });
  it('rejects areas with a wormsign, sandworm, or Atreides legion', () => {
    expect(canPlaceWormsign(base({ wormsigns: [{ area: 's1_5' }] }), 's1_5')).toBe(false);
    expect(canPlaceWormsign(base({ sandworms: [{ area: 's1_5' }] }), 's1_5')).toBe(false);
    expect(canPlaceWormsign(base({ legions: [at('s1_5')] }), 's1_5')).toBe(false);
  });
});

describe('canPlaceSandworm', () => {
  it('requires an empty Desert area', () => {
    expect(canPlaceSandworm(base({}), 's1_5')).toBe(true);
    expect(canPlaceSandworm(base({}), 'broken_land')).toBe(false);
  });
  it('is blocked by any legion, vehicle, worm, sietch or settlement', () => {
    expect(canPlaceSandworm(base({ legions: [hk('s1_5')] }), 's1_5')).toBe(false);
    expect(canPlaceSandworm(base({ vehicles: [{ type: 'harvester', location: 's1_5' }] }), 's1_5')).toBe(false);
    expect(canPlaceSandworm(base({ wormsigns: [{ area: 's1_5' }] }), 's1_5')).toBe(false);
    // gara_kulon is a Desert sietch — occupied by its sietch token
    expect(canPlaceSandworm(base({}), 'gara_kulon')).toBe(false);
  });
});

describe('wormsignsToDiscard', () => {
  it('flags wormsigns now sharing an area with an Atreides legion or sandworm', () => {
    const s = base({
      wormsigns: [{ area: 's1_5' }, { area: 's1_6' }, { area: 's1_7' }],
      legions: [at('s1_5')],
      sandworms: [{ area: 's1_6' }],
    });
    expect(wormsignsToDiscard(s).sort()).toEqual(['s1_5', 's1_6']);
  });
});

describe('wormsignPlacementAreas', () => {
  it('targets Desert areas with a Harkonnen legion or harvester, not already occupied', () => {
    const s = base({
      legions: [hk('s1_5'), at('s1_7')],
      vehicles: [{ type: 'harvester', location: 's1_6' }],
      wormsigns: [{ area: 's1_5' }], // already has a wormsign -> skip
    });
    const areas = wormsignPlacementAreas(s);
    expect(areas).toContain('s1_6'); // harvester, empty
    expect(areas).not.toContain('s1_5'); // already a wormsign
    expect(areas).not.toContain('s1_7'); // only an Atreides legion
  });
});

describe('placeWormsigns', () => {
  it('discards then places, returning tokens to and drawing from the pool', () => {
    const s = base({
      decks: { ...sampleState().decks, wormsignPool: 10 },
      legions: [hk('s1_6'), at('s1_5')],
      wormsigns: [{ area: 's1_5' }], // discarded (Atreides legion present)
    });
    const { state, placed, discarded } = placeWormsigns(s);
    expect(discarded).toEqual(['s1_5']);
    expect(placed).toContain('s1_6');
    expect(state.wormsigns.some((w) => w.area === 's1_5')).toBe(false);
    expect(state.wormsigns.some((w) => w.area === 's1_6')).toBe(true);
    // pool: 10 + 1 discarded back − placed
    expect(state.decks.wormsignPool).toBe(10 + 1 - placed.length);
  });

  it('places no more wormsigns than the pool allows', () => {
    const s = base({
      decks: { ...sampleState().decks, wormsignPool: 1 },
      legions: [hk('s1_5'), hk('s1_6'), hk('s1_7')],
    });
    const { state, placed } = placeWormsigns(s);
    expect(placed).toHaveLength(1);
    expect(state.decks.wormsignPool).toBe(0);
  });
});
