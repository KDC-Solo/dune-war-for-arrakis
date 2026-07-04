import { describe, it, expect } from 'vitest';
import {
  TACTICAL_CARDS,
  tacticalSectorOf,
  sameTacticalSector,
  PHASE_ORDER,
  nextPhase,
  drawTacticalCards,
  reselectTargetSietch,
  shuffle,
  setupRound,
  startNextRound,
} from './round';
import type { GameState, TacticalCard } from './state';

describe('tactical cards', () => {
  it('has exactly 8 cards, one per sietch', () => {
    expect(TACTICAL_CARDS.length).toBe(8);
    const sietches = new Set(TACTICAL_CARDS.map((c) => c.sietchId));
    expect(sietches.size).toBe(8);
  });

  it('has exactly 2 central cards (the 2 central sietches)', () => {
    const central = TACTICAL_CARDS.filter((c) => c.sector === 'central');
    expect(central.map((c) => c.sietchId).sort()).toEqual(['hobars_gap', 'windgap']);
  });

  it('maps central/pole sectors to central, outer sectors to themselves', () => {
    expect(tacticalSectorOf('s5')).toBe('central');
    expect(tacticalSectorOf('np')).toBe('central');
    expect(tacticalSectorOf('s1')).toBe('s1');
    expect(tacticalSectorOf('s4')).toBe('s4');
  });

  it('pairs each sietch with its own sector (e.g. Gara Kulon = s1/NE)', () => {
    const gara = TACTICAL_CARDS.find((c) => c.sietchId === 'gara_kulon');
    expect(gara?.sector).toBe('s1');
  });
});

describe('phase sequence', () => {
  it('runs start -> ... -> end', () => {
    expect(PHASE_ORDER[0]).toBe('start');
    expect(PHASE_ORDER[PHASE_ORDER.length - 1]).toBe('end');
    expect(nextPhase('start')).toBe('vehicle_placement');
    expect(nextPhase('spice_harvesting')).toBe('end');
    expect(nextPhase('end')).toBeNull();
  });
});

describe('sameTacticalSector', () => {
  it('treats two central cards as the same sector', () => {
    expect(sameTacticalSector('central', 'central')).toBe(true);
    expect(sameTacticalSector('s1', 's1')).toBe(true);
    expect(sameTacticalSector('s1', 's2')).toBe(false);
    expect(sameTacticalSector('central', 's1')).toBe(false);
  });
});

const card = (sietchId: string, sector: TacticalCard['sector']): TacticalCard => ({
  id: `tac_${sietchId}`,
  sietchId,
  sector,
});

describe('drawTacticalCards', () => {
  it('takes the 1st card as harvesting and the next valid card as target', () => {
    const deck = [card('sihaya_ridge', 's1'), card('tasmin_sink', 's2')];
    const d = drawTacticalCards(deck);
    expect(d.harvestingSector).toBe('s1');
    expect(d.targetSietchId).toBe('tasmin_sink');
  });

  it('skips a target candidate sharing the harvesting sector', () => {
    const deck = [
      card('gara_kulon', 's1'), // harvesting = s1
      card('sihaya_ridge', 's1'), // same sector -> skip
      card('habbanya_ridge', 's3'), // ok
    ];
    expect(drawTacticalCards(deck).targetSietchId).toBe('habbanya_ridge');
  });

  it('skips a target candidate whose sietch is destroyed', () => {
    const deck = [card('gara_kulon', 's1'), card('tasmin_sink', 's2'), card('habbanya_ridge', 's3')];
    const d = drawTacticalCards(deck, (id) => id === 'tasmin_sink');
    expect(d.targetSietchId).toBe('habbanya_ridge');
  });

  it('throws when no eligible target exists', () => {
    const deck = [card('gara_kulon', 's1'), card('sihaya_ridge', 's1')];
    expect(() => drawTacticalCards(deck)).toThrow();
  });
});

describe('shuffle', () => {
  it('keeps the same elements (permutation)', () => {
    const out = shuffle([1, 2, 3, 4, 5], () => 0.42);
    expect([...out].sort()).toEqual([1, 2, 3, 4, 5]);
  });
});

function miniState(over: Partial<GameState> = {}): GameState {
  return {
    round: 2,
    phase: 'end',
    settlements: [],
    sietches: TACTICAL_CARDS.map((c) => ({ area: c.sietchId, rank: 1 as const, revealed: false, destroyed: false })),
    testingStations: [],
    legions: [],
    vehicles: [],
    wormsigns: [],
    sandworms: [],
    harvestingSector: null,
    targetSietchId: null,
    spice: { markers: { choam: 3, spacing_guild: 3, landsraad: 3 }, activeBans: [], spiceReserve: 0 },
    tracks: { supremacy: 4, prescience: [0, 0, 0] },
    decks: {
      planning: { house_atreides: 10, fremen_ally: 10, house_harkonnen: 10, corrino_ally: 10 },
      planningDiscard: { house_atreides: 0, fremen_ally: 0, house_harkonnen: 0, corrino_ally: 0 },
      prescienceDeck: 16,
      reinforcements: 0,
      wormsignPool: 16,
      tacticalDeck: 8,
    },
    harkonnenReserve: { units: { regular: 10, elite: 6, special_elite: 6 }, deploymentTokens: 8, bashars: 2, namedLeaders: [] },
    beneGesserit: { atreides: 1, reserve: 4 },
    harkonnenUnusedDice: 0,
    atreidesUnusedDice: 0,
    ...over,
  };
}

describe('setupRound', () => {
  it('draws the harvesting sector + target and advances to vehicle placement', () => {
    const s = miniState({ round: 1, phase: 'start', tracks: { supremacy: 0, prescience: [0, 0, 0] } });
    const next = setupRound(s, () => 0);
    expect(next.phase).toBe('vehicle_placement');
    expect(next.harvestingSector).not.toBeNull();
    expect(next.targetSietchId).not.toBeNull();
  });

  it('does NOT change the round number or supremacy (start-of-round only)', () => {
    const s = miniState({ round: 1, phase: 'start', tracks: { supremacy: 0, prescience: [0, 0, 0] } });
    const next = setupRound(s, () => 0);
    expect(next.round).toBe(1);
    expect(next.tracks.supremacy).toBe(0);
  });

  it('resets the Harkonnen dice-used counter for the new round', () => {
    const s = { ...miniState({ round: 1, phase: 'start', tracks: { supremacy: 0, prescience: [0, 0, 0] } }), harkonnenDiceUsed: 5 };
    expect(setupRound(s, () => 0).harkonnenDiceUsed).toBe(0);
  });
});

describe('startNextRound', () => {
  it('advances the round and supremacy, draws harvesting + target', () => {
    const { state, harkonnenWins } = startNextRound(miniState(), () => 0);
    expect(state.round).toBe(3);
    expect(state.tracks.supremacy).toBe(5);
    expect(state.phase).toBe('vehicle_placement');
    expect(state.harvestingSector).not.toBeNull();
    expect(state.targetSietchId).not.toBeNull();
    expect(harkonnenWins).toBe(false);
  });

  it('reports a Harkonnen win when supremacy reaches 10', () => {
    const { state, harkonnenWins } = startNextRound(miniState({ tracks: { supremacy: 9, prescience: [0, 0, 0] } }), () => 0);
    expect(state.tracks.supremacy).toBe(10);
    expect(harkonnenWins).toBe(true);
  });

  it('does not draw a destroyed sietch as the target', () => {
    const s = miniState();
    const live = s.sietches.map((si) => (si.area === 'gara_kulon' ? si : { ...si, destroyed: true }));
    // only gara_kulon alive → it must be harvesting or target, never a destroyed one
    const { state } = startNextRound({ ...s, sietches: live }, () => 0);
    if (state.targetSietchId) expect(state.targetSietchId).toBe('gara_kulon');
  });
});

describe('reselectTargetSietch', () => {
  it('finds the next eligible sietch for a given harvesting sector', () => {
    const deck = [card('gara_kulon', 's1'), card('hobars_gap', 'central'), card('habbanya_ridge', 's3')];
    expect(reselectTargetSietch(deck, 's1', () => false)).toBe('hobars_gap');
  });

  it('returns null when nothing qualifies', () => {
    const deck = [card('gara_kulon', 's1')];
    expect(reselectTargetSietch(deck, 's1', () => false)).toBeNull();
  });
});
