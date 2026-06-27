import { describe, it, expect } from 'vitest';
import {
  HOUSE_HARKONNEN_CARDS,
  CORRINO_ALLY_CARDS,
  HARKONNEN_PLANNING_CARDS,
  deckSize,
  cardById,
} from './planningCards';

describe('planning card catalog', () => {
  it('House Harkonnen deck = 18 cards (16 distinct, Hawat\'s Scheming x3)', () => {
    expect(deckSize(HOUSE_HARKONNEN_CARDS)).toBe(18);
    expect(HOUSE_HARKONNEN_CARDS).toHaveLength(16);
    expect(cardById('hawats_scheming')?.copies).toBe(3);
  });

  it('Corrino Ally deck = 18 cards (3 Rage Overcame Shaddam IV variants)', () => {
    expect(deckSize(CORRINO_ALLY_CARDS)).toBe(18);
    const rage = CORRINO_ALLY_CARDS.filter((c) => c.name === 'Rage Overcame Shaddam IV');
    expect(rage).toHaveLength(3);
  });

  it('every card has a unique id, a deck, and non-empty text', () => {
    const ids = new Set<string>();
    for (const c of HARKONNEN_PLANNING_CARDS) {
      expect(c.id).toBeTruthy();
      expect(ids.has(c.id), `dup id ${c.id}`).toBe(false);
      ids.add(c.id);
      expect(['house_harkonnen', 'corrino_ally']).toContain(c.deck);
      expect(c.text.length).toBeGreaterThan(10);
    }
    expect(ids.size).toBe(34); // 16 + 18 distinct entries
  });

  it('total Harkonnen-side cards = 36', () => {
    expect(deckSize(HARKONNEN_PLANNING_CARDS)).toBe(36);
  });
});
