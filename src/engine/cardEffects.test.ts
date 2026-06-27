import { describe, it, expect } from 'vitest';
import { resolveCardPlay, applyCardSteps, hasCardEncoding } from './cardEffects';
import { sampleState } from '../ui/sampleState';
import { HARKONNEN_PLANNING_CARDS } from './planningCards';
import type { GameState, Legion } from './state';

function harkAt(s: GameState, area: string): Legion | undefined {
  return s.legions.find((l) => l.faction === 'harkonnen' && l.area === area);
}

describe('resolveCardPlay', () => {
  it('returns null for an unknown card id', () => {
    expect(resolveCardPlay('not_a_card', sampleState())).toBeNull();
  });

  it('encodes a fixed-placement card as ordered steps', () => {
    const r = resolveCardPlay('carthag_the_former_capital', sampleState())!;
    expect(r.name).toBe('Carthag, the Former Capital');
    expect(r.steps).toHaveLength(2);
    expect(r.steps[0].auto).toBe(true); // place 3 reg + 1 elite in Carthag
    expect(r.steps[1].auto).toBe(false); // leader choice is player's
  });

  it('has a structured encoding for every Harkonnen planning card', () => {
    const s = sampleState();
    for (const card of HARKONNEN_PLANNING_CARDS) {
      expect(hasCardEncoding(card.id)).toBe(true);
      const r = resolveCardPlay(card.id, s)!;
      expect(r.steps.length).toBeGreaterThan(0);
      expect(r.steps.every((st) => st.text.length > 0)).toBe(true);
      // applying the steps must never throw and must return a valid-looking state.
      expect(() => applyCardSteps(s, r.steps)).not.toThrow();
    }
  });
});

describe('applyCardSteps', () => {
  it('places fixed units from the reserve into the named area', () => {
    const s = sampleState();
    const before = harkAt(s, 'carthag')!;
    const r = resolveCardPlay('carthag_the_former_capital', s)!;
    const next = applyCardSteps(s, r.steps);
    const after = harkAt(next, 'carthag')!;
    expect(after.units.regular).toBe(before.units.regular + 3);
    expect(after.units.elite).toBe(before.units.elite + 1);
    // Reserve drained by what was placed.
    expect(next.harkonnenReserve.units.regular).toBe(s.harkonnenReserve.units.regular - 3);
    expect(next.harkonnenReserve.units.elite).toBe(s.harkonnenReserve.units.elite - 1);
  });

  it('places one unit in each of several fixed areas', () => {
    const s = sampleState();
    const r = resolveCardPlay('hard_times_and_oppression', s)!;
    const next = applyCardSteps(s, r.steps);
    for (const v of ['arsunt', 'hagga_basin', 'imperial_basin', 'north_pole']) {
      expect(harkAt(next, v)?.units.regular).toBe(1);
    }
    // Carthag already had 2 regulars; the card adds 1 elite there.
    expect(harkAt(next, 'carthag')?.units.elite).toBe(1);
    expect(harkAt(next, 'arrakeen')?.units.elite).toBe(1);
  });

  it('draws cards by decrementing the planning pile', () => {
    const s = sampleState();
    const r = resolveCardPlay('spotter_control', s)!; // discard wormsigns (manual) + draw 2 (auto)
    const next = applyCardSteps(s, r.steps);
    expect(next.decks.planning.house_harkonnen).toBe(s.decks.planning.house_harkonnen - 2);
  });

  it('places vehicles via the placement engine', () => {
    const s = sampleState();
    const r = resolveCardPlay('sandmasters', s)!; // 3 harvesters + draw 1
    const next = applyCardSteps(s, r.steps);
    expect(next.vehicles.filter((v) => v.type === 'harvester').length).toBeGreaterThan(0);
    expect(next.decks.planning.house_harkonnen).toBe(s.decks.planning.house_harkonnen - 1);
  });

  it('leaves manual steps unapplied (no state change from them)', () => {
    const s = sampleState();
    const r = resolveCardPlay('harkonnen_patrols', s)!; // single manual step
    expect(r.steps.every((st) => !st.auto)).toBe(true);
    expect(applyCardSteps(s, r.steps)).toEqual(s);
  });

  it('never overdraws units beyond the reserve', () => {
    const s = sampleState();
    s.harkonnenReserve.units.elite = 0; // exhaust elites
    const r = resolveCardPlay('carthag_the_former_capital', s)!;
    const next = applyCardSteps(s, r.steps);
    expect(harkAt(next, 'carthag')!.units.elite).toBe(harkAt(s, 'carthag')!.units.elite); // no elite added
    expect(next.harkonnenReserve.units.elite).toBe(0);
  });
});
