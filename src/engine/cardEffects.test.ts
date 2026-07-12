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
    expect(r.steps[1].auto).toBe(true); // leader chosen by the AI (deploy priority)
    expect(r.steps[1].text).toContain('Feyd-Rautha'); // sampleState reserve's named leader
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
    // Reserve drained by what was placed (units + the AI-chosen leader).
    expect(next.harkonnenReserve.units.regular).toBe(s.harkonnenReserve.units.regular - 3);
    expect(next.harkonnenReserve.units.elite).toBe(s.harkonnenReserve.units.elite - 1);
    expect(after.leaders.some((l) => l.name === 'Feyd-Rautha')).toBe(true);
    expect(next.harkonnenReserve.namedLeaders).not.toContain('Feyd-Rautha');
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
    const r = resolveCardPlay('breeding_program', s)!; // both steps manual
    expect(r.steps.every((st) => !st.auto)).toBe(true);
    expect(applyCardSteps(s, r.steps)).toEqual(s);
  });

  it('AI picks empty desert areas for Harkonnen Patrols and places the units', () => {
    const s = sampleState();
    const r = resolveCardPlay('harkonnen_patrols', s)!;
    expect(r.steps[0].auto).toBe(true);
    const areas = r.steps[0].groundLocations!;
    expect(areas).toHaveLength(3);
    const next = applyCardSteps(s, r.steps);
    for (const a of areas) {
      expect(harkAt(next, a)?.units.regular).toBe(1);
      // chosen areas were empty desert without a legion beforehand
      expect(harkAt(s, a)).toBeUndefined();
    }
    expect(next.harkonnenReserve.units.regular).toBe(s.harkonnenReserve.units.regular - 3);
  });

  it('AI places the Battle Group in a free mountain area (Bashar + 2 elites)', () => {
    const s = sampleState();
    const r = resolveCardPlay('moving_the_battle_group', s)!;
    expect(r.steps.every((st) => st.auto)).toBe(true);
    const area = r.steps[0].groundLocations![0];
    expect(harkAt(s, area)).toBeUndefined(); // was free
    const next = applyCardSteps(s, r.steps);
    const leg = harkAt(next, area)!;
    expect(leg.units.elite).toBe(2);
    expect(leg.leaders).toHaveLength(1);
    expect(leg.leaders[0].kind).toBe('generic');
    expect(next.harkonnenReserve.bashars).toBe(s.harkonnenReserve.bashars - 1);
    expect(next.harkonnenReserve.units.elite).toBe(s.harkonnenReserve.units.elite - 2);
  });

  it('AI discards the wormsigns nearest its legions for Spotter Control', () => {
    const s = sampleState();
    s.wormsigns = [{ area: 's1_10' }, { area: 's3_1' }, { area: 's4_1' }, { area: 's2_1' }];
    const r = resolveCardPlay('spotter_control', s)!;
    expect(r.steps[0].auto).toBe(true);
    const next = applyCardSteps(s, r.steps);
    expect(next.wormsigns).toHaveLength(1);
    expect(next.decks.wormsignPool).toBe(s.decks.wormsignPool + 3);
  });

  it('AI upgrades forward elites to Sardaukar for Sardaukar Disguised', () => {
    const s = sampleState();
    const r = resolveCardPlay('sardaukar_disguised', s)!;
    const next = applyCardSteps(s, r.steps);
    // sampleState has 1 elite at s1_11 (front) — swap capped by elites on the board.
    const front = harkAt(next, 's1_11')!;
    expect(front.units.special_elite).toBe(1);
    expect(front.units.elite).toBe(0);
    expect(next.harkonnenReserve.units.special_elite).toBe(s.harkonnenReserve.units.special_elite - 1);
    expect(next.harkonnenReserve.units.elite).toBe(s.harkonnenReserve.units.elite + 1);
  });

  it('AI picks a settlement for Evidence of Rebellion', () => {
    const s = sampleState();
    const r = resolveCardPlay('evidence_of_rebellion', s)!;
    expect(r.steps[0].auto).toBe(true);
    const area = r.steps[0].groundLocations![0];
    expect(s.settlements.some((st) => st.area === area && !st.destroyed)).toBe(true);
    const next = applyCardSteps(s, r.steps);
    expect(harkAt(next, area)!.units.elite).toBeGreaterThanOrEqual(2);
  });

  it('names a concrete legion and destination for "move a Legion of your choice"', () => {
    const s = sampleState();
    const r = resolveCardPlay('seek_out_the_mahdi', s)!;
    expect(r.steps[0].auto).toBe(false);
    expect(r.steps[0].text).toContain('Move the legion in');
    expect(r.steps[0].text).toContain("Mahdi's pick");
    expect(r.steps[0].groundLocations!.length).toBe(2);
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
