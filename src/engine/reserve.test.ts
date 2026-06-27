import { describe, it, expect } from 'vitest';
import { emptyLegion, type HarkonnenReserve, type Legion } from './state';
import {
  reserveDeltaFromCasualties,
  applyReserveDelta,
  addReserveDelta,
  emptyReserveDelta,
} from './reserve';
import { applyHarkonnenHits } from './combat';

function legion(units: Partial<Legion['units']>, leaders: Legion['leaders'] = []): Legion {
  return { ...emptyLegion('harkonnen', 'x'), units: { regular: 0, elite: 0, special_elite: 0, ...units }, leaders };
}

const reserve = (over: Partial<HarkonnenReserve> = {}): HarkonnenReserve => ({
  units: { regular: 0, elite: 0, special_elite: 0 },
  deploymentTokens: 0,
  bashars: 0,
  namedLeaders: [],
  ...over,
});

describe('reserveDeltaFromCasualties', () => {
  it('returns eliminated regulars to the pool', () => {
    const before = legion({ regular: 3 });
    const { legion: after } = applyHarkonnenHits(before, 2); // 2 regulars eliminated
    const d = reserveDeltaFromCasualties(before, after);
    expect(d.units).toEqual({ regular: 2, elite: 0, special_elite: 0 });
  });

  it('demotion swaps an elite for a regular (elite +1, regular -1)', () => {
    const before = legion({ regular: 0, elite: 2 });
    const { legion: after } = applyHarkonnenHits(before, 1); // one elite -> regular
    expect(after.units).toEqual({ regular: 1, elite: 1, special_elite: 0 });
    const d = reserveDeltaFromCasualties(before, after);
    // elite figure returned, a regular drawn out to replace it
    expect(d.units).toEqual({ regular: -1, elite: 1, special_elite: 0 });
  });

  it('handles mixed demotions and eliminations and conserves figures', () => {
    const before = legion({ regular: 3, elite: 2 });
    const { legion: after } = applyHarkonnenHits(before, 5); // demote 2 elites, then eliminate 3 regulars
    expect(after.units).toEqual({ regular: 2, elite: 0, special_elite: 0 });
    const d = reserveDeltaFromCasualties(before, after);
    // elite +2 returned, regular net +1 (3 eliminated - 2 drawn for demotion)
    expect(d.units).toEqual({ regular: 1, elite: 2, special_elite: 0 });
    // total figures returned to pool == figures lost from the board
    const boardLost =
      before.units.regular + before.units.elite + before.units.special_elite -
      (after.units.regular + after.units.elite + after.units.special_elite);
    const poolGained = d.units.regular + d.units.elite + d.units.special_elite;
    expect(poolGained).toBe(boardLost);
  });

  it('returns generic leaders to bashars and named leaders to the tank', () => {
    const before = legion({ regular: 1 }, [
      { kind: 'generic', faction: 'harkonnen' },
      { kind: 'named', faction: 'harkonnen', name: 'Beast Rabban' },
    ]);
    // 2 hits: shed the extra (generic) leader, then the lone regular would clear -> named leader dies
    const { legion: after } = applyHarkonnenHits(before, 2);
    const d = reserveDeltaFromCasualties(before, after);
    expect(d.bashars).toBe(1);
    expect(d.namedLeaders).toEqual(['Beast Rabban']);
  });
});

describe('applyReserveDelta', () => {
  it('adds units and bashars, appends named leaders to the tank, clamps at 0', () => {
    const next = applyReserveDelta(reserve({ units: { regular: 5, elite: 1, special_elite: 0 }, bashars: 1 }), {
      units: { regular: -2, elite: 1, special_elite: 0 },
      bashars: 1,
      namedLeaders: ['Baron Harkonnen'],
    });
    expect(next.units).toEqual({ regular: 3, elite: 2, special_elite: 0 });
    expect(next.bashars).toBe(2);
    expect(next.regenerationTank).toEqual(['Baron Harkonnen']);
  });

  it('never drives a unit pool negative', () => {
    const next = applyReserveDelta(reserve({ units: { regular: 1, elite: 0, special_elite: 0 } }), {
      units: { regular: -5, elite: 0, special_elite: 0 },
      bashars: 0,
      namedLeaders: [],
    });
    expect(next.units.regular).toBe(0);
  });

  it('preserves an existing tank when appending', () => {
    const next = applyReserveDelta(reserve({ regenerationTank: ['Feyd-Rautha'] }), {
      units: { regular: 0, elite: 0, special_elite: 0 },
      bashars: 0,
      namedLeaders: ['Thufir Hawat'],
    });
    expect(next.regenerationTank).toEqual(['Feyd-Rautha', 'Thufir Hawat']);
  });
});

describe('addReserveDelta', () => {
  it('combines two deltas', () => {
    const a = { units: { regular: 1, elite: 2, special_elite: 0 }, bashars: 1, namedLeaders: ['A'] };
    const b = { units: { regular: 3, elite: 0, special_elite: 1 }, bashars: 0, namedLeaders: ['B'] };
    expect(addReserveDelta(a, b)).toEqual({
      units: { regular: 4, elite: 2, special_elite: 1 },
      bashars: 1,
      namedLeaders: ['A', 'B'],
    });
  });

  it('emptyReserveDelta is an identity', () => {
    const a = { units: { regular: 2, elite: 0, special_elite: 0 }, bashars: 0, namedLeaders: [] };
    expect(addReserveDelta(a, emptyReserveDelta())).toEqual(a);
  });
});
