import { describe, it, expect } from 'vitest';
import { applyHarkonnenAction, isAutoApplied } from './applyAction';
import { emptyLegion, type GameState, type Legion } from './state';

function state(over: Partial<GameState> = {}): GameState {
  return {
    round: 1,
    phase: 'action_resolution',
    settlements: [],
    sietches: [],
    testingStations: [],
    legions: [],
    vehicles: [],
    wormsigns: [],
    sandworms: [],
    harvestingSector: 's3',
    targetSietchId: 'gara_kulon',
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
    harkonnenReserve: { units: { regular: 10, elite: 6, special_elite: 6 }, deploymentTokens: 8, bashars: 2, namedLeaders: ['Feyd-Rautha'] },
    beneGesserit: { atreides: 1, reserve: 4 },
    harkonnenUnusedDice: 0,
    atreidesUnusedDice: 0,
    ...over,
  };
}
function hLeg(area: string, units: Partial<Legion['units']>, leaders: Legion['leaders'] = []): Legion {
  return { ...emptyLegion('harkonnen', area), units: { regular: 0, elite: 0, special_elite: 0, ...units }, leaders };
}

describe('applyHarkonnenAction — move', () => {
  it('moves a legion to the destination', () => {
    const s = state({ legions: [hLeg('s1_11', { regular: 3 })] });
    const r = applyHarkonnenAction(s, { kind: 'move', legion: 's1_11', path: ['s1_11', 's1_12'] });
    expect(r.applied).toBe(true);
    expect(r.state.legions.find((l) => l.area === 's1_11')).toBeUndefined();
    expect(r.state.legions.find((l) => l.area === 's1_12')?.units.regular).toBe(3);
  });

  it('merges into a friendly legion at the destination', () => {
    const s = state({ legions: [hLeg('carthag', { regular: 2 }), hLeg('s5_2', { regular: 1 })] });
    // carthag and s5_2 may not be adjacent, but applyMove is mechanical (path endpoints given)
    const r = applyHarkonnenAction(s, { kind: 'move', legion: 's5_2', path: ['s5_2', 'carthag'] });
    expect(r.state.legions.filter((l) => l.area === 'carthag')).toHaveLength(1);
    expect(r.state.legions.find((l) => l.area === 'carthag')?.units.regular).toBe(3);
  });

  it('drops 2 deployment tokens when leaving a settlement', () => {
    const s = state({
      settlements: [{ area: 'carthag', rank: 2, destroyed: false }],
      legions: [hLeg('carthag', { regular: 3 })],
    });
    const r = applyHarkonnenAction(s, { kind: 'move', legion: 'carthag', path: ['carthag', 's5_2'] });
    const left = r.state.legions.find((l) => l.area === 'carthag');
    expect(left?.deploymentTokens).toBe(2);
    expect(r.state.harkonnenReserve.deploymentTokens).toBe(6); // 8 - 2
  });
});

describe('applyHarkonnenAction — deploy', () => {
  it('adds units + a named leader from the reserve', () => {
    const s = state({ settlements: [{ area: 'arrakeen', rank: 3, destroyed: false }] });
    const r = applyHarkonnenAction(s, {
      kind: 'deploy',
      placements: [{ settlement: 'arrakeen', units: { regular: 2, elite: 1, special_elite: 0 }, leader: 'Feyd-Rautha' }],
    });
    expect(r.applied).toBe(true);
    const leg = r.state.legions.find((l) => l.area === 'arrakeen')!;
    expect(leg.units).toEqual({ regular: 2, elite: 1, special_elite: 0 });
    expect(leg.leaders).toEqual([{ kind: 'named', faction: 'harkonnen', name: 'Feyd-Rautha' }]);
    expect(r.state.harkonnenReserve.units.regular).toBe(8); // 10 - 2
    expect(r.state.harkonnenReserve.namedLeaders).not.toContain('Feyd-Rautha');
  });
});

describe('applyHarkonnenAction — house upgrade', () => {
  it('replaces regulars with elites and swaps the reserve', () => {
    const s = state({ legions: [hLeg('carthag', { regular: 3 })] });
    const r = applyHarkonnenAction(s, { kind: 'house_replace', legion: 'carthag', count: 2 });
    const leg = r.state.legions.find((l) => l.area === 'carthag')!;
    expect(leg.units.regular).toBe(1);
    expect(leg.units.elite).toBe(2);
    expect(r.state.harkonnenReserve.units.elite).toBe(4); // 6 - 2
    expect(r.state.harkonnenReserve.units.regular).toBe(12); // 10 + 2 returned
  });
});

describe('applyHarkonnenAction — place vehicles', () => {
  it('places a harvester and an ornithopter', () => {
    const r = applyHarkonnenAction(state(), { kind: 'house_place_vehicles' });
    expect(r.applied).toBe(true);
    expect(r.state.vehicles.some((v) => v.type === 'harvester')).toBe(true);
    expect(r.state.vehicles.some((v) => v.type === 'ornithopter')).toBe(true);
  });
});

describe('applyHarkonnenAction — player-resolved actions', () => {
  it('does not auto-apply attacks, mentat, or none', () => {
    const s = state();
    for (const a of [
      { kind: 'attack_sietch', attacker: 's1_11', sietch: 'gara_kulon', useOrnithopter: false },
      { kind: 'attack_legion', attacker: 's1_11', defender: 'gara_kulon' },
      { kind: 'mentat' },
      { kind: 'none', reason: 'x' },
    ] as const) {
      const r = applyHarkonnenAction(s, a);
      expect(r.applied).toBe(false);
      expect(r.note).toBeTruthy();
      expect(r.state).toBe(s); // unchanged
    }
  });

  it('isAutoApplied flags the mechanical actions', () => {
    expect(isAutoApplied({ kind: 'move', legion: 'a', path: ['a', 'b'] })).toBe(true);
    expect(isAutoApplied({ kind: 'attack_legion', attacker: 'a', defender: 'b' })).toBe(false);
  });
});
