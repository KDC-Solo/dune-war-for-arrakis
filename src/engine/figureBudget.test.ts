import { describe, it, expect } from 'vitest';
import { harkonnenFigureTally, HARKONNEN_UNIT_TOTALS } from './figureBudget';
import { newGameState } from './newGame';
import { emptyLegion, type GameState } from './state';

describe('harkonnenFigureTally', () => {
  it('a fresh game balances exactly to the component totals (all figures in reserve)', () => {
    const t = harkonnenFigureTally(newGameState());
    expect(t.board).toEqual({ regular: 0, elite: 0, special_elite: 0 });
    expect(t.total).toEqual(HARKONNEN_UNIT_TOTALS);
    expect(t.over).toEqual([]);
  });

  it('counts only Harkonnen legions on the board', () => {
    const s = newGameState(); // starts with Atreides naibs on sietches (0 units) + reserve 16/8/8
    const withHark: GameState = {
      ...s,
      legions: [...s.legions, { ...emptyLegion('harkonnen', 'carthag'), units: { regular: 3, elite: 1, special_elite: 0 } }],
    };
    const t = harkonnenFigureTally(withHark);
    expect(t.board).toEqual({ regular: 3, elite: 1, special_elite: 0 });
    // board + reserve now exceeds the totals because the raw edit didn't draw from reserve
    expect(t.total.regular).toBe(19);
    expect(t.over).toEqual(['regular', 'elite']);
  });

  it('is not over budget when board + reserve stays within the limits', () => {
    const s = newGameState();
    const balanced: GameState = {
      ...s,
      legions: [...s.legions, { ...emptyLegion('harkonnen', 'carthag'), units: { regular: 4, elite: 0, special_elite: 0 } }],
      harkonnenReserve: { ...s.harkonnenReserve, units: { regular: 12, elite: 8, special_elite: 8 } },
    };
    const t = harkonnenFigureTally(balanced);
    expect(t.total).toEqual(HARKONNEN_UNIT_TOTALS);
    expect(t.over).toEqual([]);
  });
});

describe('atreidesFigureTally', () => {
  it('flags board counts above the component totals', async () => {
    const { atreidesFigureTally, ATREIDES_UNIT_TOTALS } = await import('./figureBudget');
    const s = newGameState();
    expect(atreidesFigureTally(s).over).toEqual([]);
    s.legions = [
      ...s.legions,
      {
        faction: 'atreides',
        area: 's1_11',
        units: { regular: ATREIDES_UNIT_TOTALS.regular + 1, elite: 0, special_elite: 0 },
        deploymentTokens: 0,
        leaders: [],
      },
    ];
    expect(atreidesFigureTally(s).over).toContain('regular');
  });
});
