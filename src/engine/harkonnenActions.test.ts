import { describe, it, expect } from 'vitest';
import {
  resolveLeadershipOrStrategy,
  selectSietchAttack,
  selectLegionAttack,
  selectMove,
  resolveDeployment,
  resolveMentat,
  resolveHouse,
  resolveAction,
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
    harkonnenReserve: { units: { regular: 16, elite: 8, special_elite: 8 }, deploymentTokens: 12, bashars: 2, namedLeaders: [] },
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

describe('resolveDeployment', () => {
  it('deploys 3 units + a leader into the highest-CP settlement', () => {
    const s = state({
      settlements: [
        { area: 'carthag', rank: 2, destroyed: false },
        { area: 'arrakeen', rank: 3, destroyed: false },
      ],
      legions: [hLegion('carthag', { regular: 1 }), hLegion('arrakeen', { regular: 2 })], // arrakeen stronger, has room
      harkonnenReserve: { units: { regular: 16, elite: 8, special_elite: 8 }, deploymentTokens: 12, bashars: 2, namedLeaders: ['Feyd-Rautha'] },
    });
    const a = resolveDeployment(s);
    expect(a.kind).toBe('deploy');
    if (a.kind !== 'deploy') return;
    expect(a.placements[0].settlement).toBe('arrakeen');
    const p = a.placements[0];
    expect(p.units.regular + p.units.elite + p.units.special_elite).toBe(3);
    expect(p.leader).toBe('Feyd-Rautha'); // priority named leader
  });

  it('substitutes higher-tier units when regulars run out', () => {
    const s = state({
      settlements: [{ area: 'carthag', rank: 2, destroyed: false }],
      harkonnenReserve: { units: { regular: 1, elite: 5, special_elite: 0 }, deploymentTokens: 0, bashars: 1, namedLeaders: [] },
    });
    const a = resolveDeployment(s);
    if (a.kind !== 'deploy') throw new Error('expected deploy');
    const u = a.placements[0].units;
    expect(u.regular).toBe(1);
    expect(u.elite).toBe(2); // 2 missing regulars substituted by elites
    expect(a.placements[0].leader).toBe('Bashar'); // no named -> Bashar
  });

  it('overflows into the next settlement at the stacking limit', () => {
    const s = state({
      settlements: [
        { area: 'carthag', rank: 2, destroyed: false },
        { area: 'arrakeen', rank: 3, destroyed: false },
      ],
      // carthag is the strongest (primary) but nearly full (5 units -> only 1 fits); arrakeen has room.
      legions: [hLegion('carthag', { regular: 5 }), hLegion('arrakeen', { regular: 1 })],
      harkonnenReserve: { units: { regular: 16, elite: 0, special_elite: 0 }, deploymentTokens: 0, bashars: 1, namedLeaders: [] },
    });
    const a = resolveDeployment(s);
    if (a.kind !== 'deploy') throw new Error('expected deploy');
    const total = a.placements.reduce(
      (n, p) => n + p.units.regular + p.units.elite + p.units.special_elite,
      0,
    );
    expect(total).toBe(3);
    expect(a.placements.length).toBeGreaterThanOrEqual(2); // spilled across settlements
    for (const p of a.placements) {
      const used = p.settlement === 'carthag' ? 5 : 1;
      expect(p.units.regular + used).toBeLessThanOrEqual(6);
    }
  });

  it('returns none with nothing to deploy', () => {
    const s = state({
      settlements: [{ area: 'carthag', rank: 2, destroyed: false }],
      harkonnenReserve: { units: { regular: 0, elite: 0, special_elite: 0 }, deploymentTokens: 0, bashars: 0, namedLeaders: [] },
    });
    expect(resolveDeployment(s)).toEqual({ kind: 'none', reason: 'nothing to deploy' });
  });
});

describe('resolveMentat', () => {
  it('is a draw-and-play action', () => {
    expect(resolveMentat(state())).toEqual({ kind: 'mentat' });
  });
});

describe('resolveHouse', () => {
  it('replaces regulars with elites in the legion nearest a sietch', () => {
    const s = state({
      sietches: [sietch('gara_kulon', 1)],
      legions: [hLegion('s1_11', { regular: 2 }), hLegion('carthag', { regular: 2 })], // s1_11 adjacent to gara_kulon
      harkonnenReserve: { units: { regular: 0, elite: 4, special_elite: 0 }, deploymentTokens: 0, bashars: 0, namedLeaders: [] },
    });
    const a = resolveHouse(s);
    expect(a).toEqual({ kind: 'house_replace', legion: 's1_11', count: 2 });
  });

  it('places vehicles when no elites are available', () => {
    const s = state({
      legions: [hLegion('carthag', { regular: 2 })],
      harkonnenReserve: { units: { regular: 0, elite: 0, special_elite: 0 }, deploymentTokens: 0, bashars: 0, namedLeaders: [] },
    });
    expect(resolveHouse(s)).toEqual({ kind: 'house_place_vehicles' });
  });

  it('caps the replacement at 2 / available elites / available regulars', () => {
    const s = state({
      sietches: [sietch('gara_kulon', 1)],
      legions: [hLegion('s1_11', { regular: 1 })],
      harkonnenReserve: { units: { regular: 0, elite: 4, special_elite: 0 }, deploymentTokens: 0, bashars: 0, namedLeaders: [] },
    });
    const a = resolveHouse(s);
    expect(a).toEqual({ kind: 'house_replace', legion: 's1_11', count: 1 });
  });
});

describe('resolveAction dispatch', () => {
  it('routes each die result to its resolver', () => {
    const s = state({
      legions: [hLegion('carthag')],
      settlements: [{ area: 'carthag', rank: 2, destroyed: false }],
    });
    expect(resolveAction(s, 'mentat').kind).toBe('mentat');
    expect(['house_replace', 'house_place_vehicles']).toContain(resolveAction(s, 'house').kind);
    expect(resolveAction(s, 'deployment').kind).toBe('deploy');
    expect(['attack_sietch', 'attack_legion', 'move', 'none']).toContain(resolveAction(s, 'strategy').kind);
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
