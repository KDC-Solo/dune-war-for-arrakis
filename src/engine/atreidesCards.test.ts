import { describe, it, expect } from 'vitest';
import {
  HOUSE_ATREIDES_CARDS,
  FREMEN_ALLY_CARDS,
  ATREIDES_PLANNING_CARDS,
  atreidesDeckSize,
} from './atreidesCards';

describe('Atreides planning-card catalog', () => {
  it('matches the physical deck: 36 cards, 18 per sub-deck (rulebook component list)', () => {
    const house = HOUSE_ATREIDES_CARDS.reduce((n, c) => n + (c.copies ?? 1), 0);
    const fremen = FREMEN_ALLY_CARDS.reduce((n, c) => n + (c.copies ?? 1), 0);
    expect(house).toBe(18);
    expect(fremen).toBe(18);
    expect(atreidesDeckSize()).toBe(36);
  });

  it('has unique ids and correct deck tags', () => {
    const ids = ATREIDES_PLANNING_CARDS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of HOUSE_ATREIDES_CARDS) expect(c.deck).toBe('house_atreides');
    for (const c of FREMEN_ALLY_CARDS) expect(c.deck).toBe('fremen_ally');
  });

  it('keeps the known multiples: Smugglers ×3 variants, Shai-Hulud ×3 copies', () => {
    expect(HOUSE_ATREIDES_CARDS.filter((c) => c.name === 'Smugglers')).toHaveLength(3);
    const shai = FREMEN_ALLY_CARDS.find((c) => c.name === 'Shai-Hulud');
    expect(shai?.copies).toBe(3);
  });
});
