import { describe, it, expect } from 'vitest';
import {
  STORM_EXEMPT_PLATEAUS,
  isStormVulnerable,
  specialHitValue,
  stormHits,
  stormTargets,
  resolveCoriolisStorms,
} from './storms';
import { AREAS, AREA_IDS } from './board';
import { emptyLegion, type GameState, type Legion } from './state';
import { sampleState } from '../ui/sampleState';

function legion(area: string, units: Partial<Legion['units']>, faction: Legion['faction'] = 'harkonnen'): Legion {
  return { ...emptyLegion(faction, area), units: { regular: 0, elite: 0, special_elite: 0, ...units } };
}

function stateWith(legions: Legion[]): GameState {
  return { ...sampleState(), legions };
}

describe('storm-exempt plateaus', () => {
  it('is exactly the 5 central plateaus encircled by mountains', () => {
    expect([...STORM_EXEMPT_PLATEAUS].sort()).toEqual(
      ['arrakeen', 'arsunt', 'carthag', 'hagga_basin', 'imperial_basin'].sort(),
    );
  });

  it('only contains plateau areas', () => {
    for (const id of STORM_EXEMPT_PLATEAUS) expect(AREAS[id].terrain).toBe('plateau');
  });
});

describe('isStormVulnerable', () => {
  it('exempts mountains and the central plateaus', () => {
    expect(isStormVulnerable('arrakeen')).toBe(false); // central plateau
    expect(isStormVulnerable('broken_land')).toBe(false); // mountain
  });

  it('exposes desert, deep desert, minor erg and peripheral plateaus', () => {
    const desert = AREA_IDS.find((id) => AREAS[id].terrain === 'desert' && !AREAS[id].deep)!;
    const deep = AREA_IDS.find((id) => AREAS[id].terrain === 'desert' && AREAS[id].deep)!;
    const erg = AREA_IDS.find((id) => AREAS[id].terrain === 'minor_erg')!;
    const peripheralPlateau = AREA_IDS.find(
      (id) => AREAS[id].terrain === 'plateau' && !STORM_EXEMPT_PLATEAUS.has(id),
    )!;
    expect(isStormVulnerable(desert)).toBe(true);
    expect(isStormVulnerable(deep)).toBe(true);
    expect(isStormVulnerable(erg)).toBe(true);
    expect(isStormVulnerable(peripheralPlateau)).toBe(true);
  });
});

describe('specialHitValue / stormHits', () => {
  const deep = AREA_IDS.find((id) => AREAS[id].terrain === 'desert' && AREAS[id].deep)!;
  const desert = AREA_IDS.find((id) => AREAS[id].terrain === 'desert' && !AREAS[id].deep)!;
  const erg = AREA_IDS.find((id) => AREAS[id].terrain === 'minor_erg')!;

  it('scores specials by terrain (deep 2 / desert 1 / erg 0)', () => {
    expect(specialHitValue(deep)).toBe(2);
    expect(specialHitValue(desert)).toBe(1);
    expect(specialHitValue(erg)).toBe(0);
  });

  it('always counts swords plus terrain-scaled specials', () => {
    expect(stormHits(deep, { swords: 1, specials: 2 })).toBe(1 + 2 * 2); // 5
    expect(stormHits(desert, { swords: 2, specials: 1 })).toBe(2 + 1); // 3
    expect(stormHits(erg, { swords: 1, specials: 2 })).toBe(1); // specials worthless on erg
  });
});

describe('stormTargets', () => {
  it('lists only Harkonnen legions in vulnerable areas', () => {
    const deepArea = AREA_IDS.find((id) => AREAS[id].terrain === 'desert' && AREAS[id].deep)!;
    const s = stateWith([
      legion('arrakeen', { regular: 2 }), // exempt central plateau → skipped
      legion(deepArea, { regular: 2 }), // exposed
      legion(deepArea, { regular: 1 }, 'atreides'), // Atreides immune → skipped
    ]);
    const targets = stormTargets(s);
    expect(targets).toHaveLength(1);
    expect(targets[0].area).toBe(deepArea);
    expect(targets[0].specialHitValue).toBe(2);
  });
});

describe('resolveCoriolisStorms', () => {
  it('applies hits and removes casualties for each exposed legion', () => {
    const desert = AREA_IDS.find((id) => AREAS[id].terrain === 'desert' && !AREAS[id].deep)!;
    const s = stateWith([legion(desert, { regular: 3, elite: 1 })]);
    const { state, outcomes } = resolveCoriolisStorms(s, () => ({ swords: 1, specials: 1 })); // 2 hits
    expect(outcomes[0].hits).toBe(2);
    // 2 hits on (3 reg + 1 elite): elite→regular, then a regular removed.
    const after = state.legions[0];
    expect(after.units.elite).toBe(0);
    expect(after.units.regular).toBe(3); // 3 -> 4 (downgrade) -> 3 (one removed)
    expect(outcomes[0].casualties.units).toBe(1);
    expect(outcomes[0].eliminated).toBe(false);
    // reserve replenishment: the demoted elite returns (+1); the regular swap nets 0.
    expect(state.harkonnenReserve.units.elite).toBe(s.harkonnenReserve.units.elite + 1);
    expect(state.harkonnenReserve.units.regular).toBe(s.harkonnenReserve.units.regular);
  });

  it('returns a wiped-out legion entirely to the reserve', () => {
    const deep = AREA_IDS.find((id) => AREAS[id].terrain === 'desert' && AREAS[id].deep)!;
    const s = stateWith([legion(deep, { regular: 1, elite: 1 })]);
    const { state } = resolveCoriolisStorms(s, () => ({ swords: 0, specials: 2 })); // 4 hits, wipes legion
    expect(state.legions).toHaveLength(0);
    // both figures end up back in the pool (elite returned, regular returned)
    expect(state.harkonnenReserve.units.elite).toBe(s.harkonnenReserve.units.elite + 1);
    expect(state.harkonnenReserve.units.regular).toBe(s.harkonnenReserve.units.regular + 1);
  });

  it('drops a wiped-out legion from state and flags it eliminated', () => {
    const deep = AREA_IDS.find((id) => AREAS[id].terrain === 'desert' && AREAS[id].deep)!;
    const s = stateWith([legion(deep, { regular: 1 })]);
    const { state, outcomes } = resolveCoriolisStorms(s, () => ({ swords: 0, specials: 2 })); // 4 hits
    expect(outcomes[0].eliminated).toBe(true);
    expect(state.legions).toHaveLength(0);
  });

  it('is a no-op when nobody is exposed (and does not mutate input)', () => {
    const s = stateWith([legion('arrakeen', { regular: 2 })]);
    const { state, outcomes } = resolveCoriolisStorms(s, () => ({ swords: 2, specials: 2 }));
    expect(outcomes).toEqual([]);
    expect(state).toBe(s);
  });

  it('leaves Atreides legions untouched', () => {
    const desert = AREA_IDS.find((id) => AREAS[id].terrain === 'desert' && !AREAS[id].deep)!;
    const s = stateWith([legion(desert, { regular: 2 }, 'atreides')]);
    const { state, outcomes } = resolveCoriolisStorms(s, () => ({ swords: 2, specials: 0 }));
    expect(outcomes).toEqual([]);
    expect(state.legions[0].units.regular).toBe(2);
  });
});
