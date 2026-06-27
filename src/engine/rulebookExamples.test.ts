// Validation of the engine against the worked examples printed in the official rulebook
// (docs/Dune_Rulebook_2_web.pdf). Each test cites the example it reproduces.

import { describe, it, expect } from 'vitest';
import { combatDiceCount } from './combat';
import { resolveCombatRoll, netHits, type RawRoll } from './combatRoll';
import type { Leader } from './state';

const bashar: Leader = { kind: 'generic', faction: 'harkonnen' };
const baron: Leader = { kind: 'named', faction: 'harkonnen', name: 'Baron Harkonnen' };
const paul: Leader = { kind: 'named', faction: 'atreides', name: "Paul-Muad'Dib" };

describe('rulebook example — Combat dice count (p24)', () => {
  // "A Harkonnen Legion of 2 Regulars, 2 Elites, 1 Sardaukar, 1 Bashar, and Baron Harkonnen
  //  attacks an Atreides Legion of 2 Fremen Regulars, 1 Fedaykin, and Paul, protecting a rank-2
  //  Sietch. Both sides would roll 5 Combat dice each. The Harkonnen discards 1 Planning card to
  //  add 1 die, for 6 (the maximum)."
  it('rolls 5 dice per side, 6 after the Harkonnen discards a card', () => {
    const harkonnenUnits = 2 + 2 + 1; // leaders never add dice
    const atreidesUnits = 2 + 1;
    expect(combatDiceCount(harkonnenUnits)).toBe(5);
    expect(combatDiceCount(atreidesUnits, { defendingSettlementRank: 2 })).toBe(5);
    expect(combatDiceCount(harkonnenUnits, { discards: 1 })).toBe(6); // capped at 6
  });
});

describe('rulebook example — Leader combat abilities & Sardaukar/Fedaykin (p25)', () => {
  // Harkonnen roll: 3 Special, 2 Hit, 1 Shield. Leaders: Bashar + Baron Harkonnen.
  //   Bashar converts 1 Special -> 1 Hit; Baron converts 1 Special -> 2 Shields; the 3rd Special
  //   is a miss. The Atreides Fedaykin cancels 1 Harkonnen Special.
  // Atreides roll: 5 Hit. Paul would convert a Special (-> 2 Hits + 1 Shield) but none was rolled.
  //   The Harkonnen Sardaukar cancels an Atreides Special, but Atreides rolled none.
  const harkRaw: RawRoll = { hits: 2, shields: 1, specials: 3 };
  const atrRaw: RawRoll = { hits: 5, shields: 0, specials: 0 };

  it('converts the Harkonnen specials: +1 hit (Bashar), +2 shields (Baron), Fedaykin cancels 1', () => {
    // opponent special-elites = 1 (the Atreides Fedaykin)
    const hark = resolveCombatRoll(harkRaw, [bashar, baron], 1);
    expect(hark).toEqual({ hits: 3, shields: 3 }); // 2+1 hits, 1+2 shields
  });

  it('leaves the Atreides roll unchanged (no special for Paul, Sardaukar cancels nothing)', () => {
    const atr = resolveCombatRoll(atrRaw, [paul], 1); // opponent special-elites = 1 (Harkonnen Sardaukar)
    expect(atr).toEqual({ hits: 5, shields: 0 });
  });

  it('the Harkonnen score 3 Hits on the Atreides, as stated', () => {
    const hark = resolveCombatRoll(harkRaw, [bashar, baron], 1);
    const atr = resolveCombatRoll(atrRaw, [paul], 1);
    const { onDefender, onAttacker } = netHits(hark, atr);
    expect(onDefender).toBe(3); // rulebook: "the Harkonnen scored 3 Hits"
    // The Harkonnen's 3 shields (1 rolled + 2 from Baron) cancel 3 of the Atreides' 5 hits → 2 land.
    // (The rulebook's printed "Atreides 3 Hits" appears to omit the single rolled Harkonnen shield;
    // the mechanics as written net to 2.)
    expect(onAttacker).toBe(2);
  });
});
