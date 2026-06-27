import { describe, it, expect } from 'vitest';
import {
  TACTICAL_CARDS,
  tacticalSectorOf,
  sameTacticalSector,
  PHASE_ORDER,
  nextPhase,
  drawTacticalCards,
  reselectTargetSietch,
} from './round';
import type { TacticalCard } from './state';

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
