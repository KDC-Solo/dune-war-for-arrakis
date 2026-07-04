// Harkonnen figure-budget reconciliation.
//
// The game has a fixed number of each Harkonnen unit figure, split between the board and the
// off-board reserve. The raw legion editor lets you set a legion's unit counts freely (to match
// the physical board) without touching the reserve, so board + reserve can drift past what the game
// actually contains. This tallies both sides so the UI can flag a total that exceeds the component
// count. Deployment tokens are a separate pool (their unit composition is hidden until revealed) and
// are intentionally not counted here.

import type { GameState, UnitType } from './state';

/** Total Harkonnen unit figures in the game (the physical component counts). */
export const HARKONNEN_UNIT_TOTALS: Record<UnitType, number> = { regular: 16, elite: 8, special_elite: 8 };

const UNIT_TYPES: readonly UnitType[] = ['regular', 'elite', 'special_elite'];

export interface FigureTally {
  /** Unit figures on Harkonnen legions. */
  board: Record<UnitType, number>;
  /** Unit figures in the off-board reserve. */
  reserve: Record<UnitType, number>;
  /** board + reserve. */
  total: Record<UnitType, number>;
  /** The component limit per type. */
  max: Record<UnitType, number>;
  /** Types whose total exceeds the game's figure count (impossible — a data-entry drift). */
  over: UnitType[];
}

/** Tally Harkonnen unit figures across the board and reserve, and note any type that's over budget. */
export function harkonnenFigureTally(s: GameState): FigureTally {
  const board: Record<UnitType, number> = { regular: 0, elite: 0, special_elite: 0 };
  for (const l of s.legions) {
    if (l.faction !== 'harkonnen') continue;
    board.regular += l.units.regular;
    board.elite += l.units.elite;
    board.special_elite += l.units.special_elite;
  }
  const reserve = s.harkonnenReserve.units;
  const total: Record<UnitType, number> = {
    regular: board.regular + reserve.regular,
    elite: board.elite + reserve.elite,
    special_elite: board.special_elite + reserve.special_elite,
  };
  const over = UNIT_TYPES.filter((t) => total[t] > HARKONNEN_UNIT_TOTALS[t]);
  return { board, reserve, total, max: HARKONNEN_UNIT_TOTALS, over };
}

/** Total Atreides unit figures in the game (regular/elite/Fedaykin component counts). */
export const ATREIDES_UNIT_TOTALS: Record<UnitType, number> = { regular: 16, elite: 8, special_elite: 6 };

/**
 * Tally Atreides unit figures on the board. The player's off-board pool is physical (the app
 * doesn't model an Atreides reserve), so drift here means MORE figures on the board than the
 * box contains — always a data-entry error.
 */
export function atreidesFigureTally(s: GameState): { board: Record<UnitType, number>; max: Record<UnitType, number>; over: UnitType[] } {
  const board: Record<UnitType, number> = { regular: 0, elite: 0, special_elite: 0 };
  for (const l of s.legions) {
    if (l.faction !== 'atreides') continue;
    board.regular += l.units.regular;
    board.elite += l.units.elite;
    board.special_elite += l.units.special_elite;
  }
  const over = UNIT_TYPES.filter((t) => board[t] > ATREIDES_UNIT_TOTALS[t]);
  return { board, max: ATREIDES_UNIT_TOTALS, over };
}
