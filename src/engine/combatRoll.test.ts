import { describe, it, expect } from 'vitest';
import { resolveCombatRoll, netHits, type RawRoll } from './combatRoll';
import type { Leader } from './state';

const generic: Leader = { kind: 'generic', faction: 'harkonnen' };
const named = (name: string): Leader => ({ kind: 'named', faction: 'harkonnen', name });
const noRoll: RawRoll = { hits: 0, shields: 0, specials: 0 };

describe('resolveCombatRoll', () => {
  it('passes plain hits/shields through when there are no specials', () => {
    expect(resolveCombatRoll({ hits: 2, shields: 1, specials: 0 }, [generic], 0)).toEqual({ hits: 2, shields: 1 });
  });

  it('a generic leader converts one special to one hit', () => {
    expect(resolveCombatRoll({ ...noRoll, specials: 1 }, [generic], 0)).toEqual({ hits: 1, shields: 0 });
  });

  it('a named leader applies its own combat strip (Feyd-Rautha: 2 hits, 1 shield)', () => {
    expect(resolveCombatRoll({ ...noRoll, specials: 1 }, [named('Feyd-Rautha')], 0)).toEqual({ hits: 2, shields: 1 });
  });

  it('converts at most one special per leader; extras are misses', () => {
    // 3 specials, 1 leader → only 1 converted, 2 wasted.
    expect(resolveCombatRoll({ ...noRoll, specials: 3 }, [generic], 0)).toEqual({ hits: 1, shields: 0 });
  });

  it('applies leaders in array order when leaders outnumber specials', () => {
    // 1 special, 2 leaders → first leader (Baron, 2 shields) used; second ignored.
    expect(resolveCombatRoll({ ...noRoll, specials: 1 }, [named('Baron Harkonnen'), generic], 0)).toEqual({
      hits: 0,
      shields: 2,
    });
  });

  it("opponent's special elites cancel specials before conversion", () => {
    // 2 specials, 2 opposing Sardaukar/Fedaykin → all cancelled, leader gets nothing.
    expect(resolveCombatRoll({ ...noRoll, specials: 2 }, [generic], 2)).toEqual({ hits: 0, shields: 0 });
    // 2 specials, 1 cancelled → 1 left for the leader.
    expect(resolveCombatRoll({ ...noRoll, specials: 2 }, [generic], 1)).toEqual({ hits: 1, shields: 0 });
  });

  it('treats an unknown named leader as a generic strip (1 hit)', () => {
    expect(resolveCombatRoll({ ...noRoll, specials: 1 }, [named('Nobody')], 0)).toEqual({ hits: 1, shields: 0 });
  });
});

describe('netHits', () => {
  it('shields cancel opponent hits, floored at zero', () => {
    // attacker 4 hits − defender 3 shields = 1 lands; defender 2 hits − attacker 1 shield = 1 lands.
    expect(netHits({ hits: 4, shields: 1 }, { hits: 2, shields: 3 })).toEqual({ onDefender: 1, onAttacker: 1 });
    // big shields floor the result at zero.
    expect(netHits({ hits: 1, shields: 0 }, { hits: 0, shields: 5 })).toEqual({ onDefender: 0, onAttacker: 0 });
  });

  it('is symmetric in the obvious way', () => {
    expect(netHits({ hits: 3, shields: 0 }, { hits: 0, shields: 1 })).toEqual({ onDefender: 2, onAttacker: 0 });
  });
});
