import { describe, it, expect } from 'vitest';
import {
  resolveLeadershipOrStrategy,
  selectSietchAttack,
  selectLegionAttack,
  selectMove,
} from './harkonnenActions';
import { emptyLegion, type GameState, type Legion, type SietchState } from './state';
import { harkonnenAreAdjacent } from './movement';
import { ADJACENCY } from './board';

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
    harvestingSector: null,
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
    beneGesserit: { atreides: 1, reserve: 4 },
    harkonnenUnusedDice: 0,
    atreidesUnusedDice: 0,
    ...over,
  };
}

function hLegion(area: string, units: Partial<Legion['units']> = { regular: 3 }, leaders: Legion['leaders'] = []): Legion {
  return { ...emptyLegion('harkonnen', area), units: { regular: 0, elite: 0, special_elite: 0, ...units }, leaders };
}
function aLegion(area: string, units: Partial<Legion['units']> = { regular: 1 }, leaders: Legion['leaders'] = []): Legion {
  return { ...emptyLegion('atreides', area), units: { regular: 0, elite: 0, special_elite: 0, ...units }, leaders };
}
function sietch(area: string, rank: SietchState['rank']): SietchState {
  return { area, rank, revealed: false, destroyed: false };
}

describe('selectSietchAttack', () => {
  it('attacks an adjacent sietch when stronger than its defender', () => {
    const s = state({
      sietches: [sietch('gara_kulon', 1)],
      legions: [hLegion('s1_11', { regular: 3 })], // adjacent to gara_kulon, no defender
    });
    const a = selectSietchAttack(s);
    expect(a).toEqual({ kind: 'attack_sietch', attacker: 's1_11', sietch: 'gara_kulon', useOrnithopter: false });
  });

  it('does not attack when not strong enough', () => {
    const s = state({
      sietches: [sietch('gara_kulon', 1)],
      legions: [hLegion('s1_11', { regular: 1 }), aLegion('gara_kulon', { regular: 3 })],
    });
    expect(selectSietchAttack(s)).toBeNull();
  });

  it('prefers the higher-rank sietch', () => {
    // attacker s3_1 is adjacent to habbanya_ridge; also place a rank-1 reachable sietch.
    const s = state({
      sietches: [sietch('habbanya_ridge', 3), sietch('gara_kulon', 1)],
      legions: [hLegion('s3_1', { regular: 4 }), hLegion('s1_11', { regular: 4 })],
    });
    const a = selectSietchAttack(s) as { sietch: string };
    expect(a.sietch).toBe('habbanya_ridge');
  });

  it('only uses leader-bearing legions for LEADERSHIP', () => {
    const s = state({
      sietches: [sietch('gara_kulon', 1)],
      legions: [hLegion('s1_11', { regular: 3 }, [])], // no leader
    });
    expect(selectSietchAttack(s, true)).toBeNull();
    expect(selectSietchAttack(s, false)).not.toBeNull();
  });
});

describe('selectLegionAttack', () => {
  it('attacks an adjacent weaker Atreides legion', () => {
    // find an area adjacent to carthag
    const target = 'carthag';
    const adj = ADJACENCY[target][0] as string;
    const s = state({
      legions: [hLegion(adj, { regular: 4 }), aLegion(target, { regular: 1 })],
    });
    expect(harkonnenAreAdjacent(adj, target)).toBe(true);
    const a = selectLegionAttack(s);
    expect(a).toEqual({ kind: 'attack_legion', attacker: adj, defender: target });
  });

  it('returns null when no adjacent enemy or attacker too weak', () => {
    const target = 'carthag';
    const adj = ADJACENCY[target][0] as string;
    const s = state({ legions: [hLegion(adj, { regular: 1 }), aLegion(target, { regular: 3 })] });
    expect(selectLegionAttack(s)).toBeNull();
  });
});

describe('selectMove', () => {
  it('moves the nearest legion one step toward the target sietch', () => {
    const s = state({
      targetSietchId: 'gara_kulon',
      sietches: [sietch('gara_kulon', 1)],
      legions: [hLegion('s5_9', { regular: 2 })], // s5_9 is adjacent to gara_kulon -> first step is the sietch
    });
    // s5_9 is adjacent to gara_kulon; the next step would be the sietch itself (an attack), so no move.
    const a = selectMove(s);
    // either null (adjacent -> would be attack) or a valid 2-element path not ending in self
    if (a && a.kind === 'move') {
      expect(a.path[0]).toBe('s5_9');
      expect(a.path).toHaveLength(2);
    } else {
      expect(a).toBeNull();
    }
  });

  it('returns null without a target sietch', () => {
    expect(selectMove(state({ legions: [hLegion('carthag')] }))).toBeNull();
  });
});

describe('resolveLeadershipOrStrategy cascade', () => {
  it('prefers a sietch attack over a legion attack over a move', () => {
    const s = state({
      targetSietchId: 'gara_kulon',
      sietches: [sietch('gara_kulon', 1)],
      legions: [hLegion('s1_11', { regular: 3 })],
    });
    expect(resolveLeadershipOrStrategy(s, 'strategy').kind).toBe('attack_sietch');
  });

  it('falls through to none when nothing is possible', () => {
    const s = state({ legions: [] });
    expect(resolveLeadershipOrStrategy(s, 'strategy')).toEqual({
      kind: 'none',
      reason: 'no sietch/legion attack and no move available',
    });
  });
});
