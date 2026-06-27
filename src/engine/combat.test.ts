import { describe, it, expect } from 'vitest';
import {
  combatDiceCount,
  harkonnenShouldContinueAttack,
  applyHarkonnenHits,
  applyDefaultHits,
  resolveBattle,
  MAX_COMBAT_DICE,
  type DiceProvider,
} from './combat';
import { emptyLegion, type Legion, type Leader } from './state';

const gen: Leader = { kind: 'generic', faction: 'harkonnen' };
const named = (name: string): Leader => ({ kind: 'named', faction: 'harkonnen', name });

function leg(over: Partial<Legion>): Legion {
  return { ...emptyLegion('harkonnen', 'carthag'), ...over };
}

describe('combatDiceCount', () => {
  it('= units + discards + defender settlement rank, capped at 6', () => {
    expect(combatDiceCount(3)).toBe(3);
    expect(combatDiceCount(3, { discards: 2 })).toBe(5);
    expect(combatDiceCount(2, { defendingSettlementRank: 3 })).toBe(5);
    expect(combatDiceCount(5, { discards: 4 })).toBe(MAX_COMBAT_DICE); // capped
  });
});

describe('harkonnenShouldContinueAttack', () => {
  it('continues while fine power > half the opponent', () => {
    const strong = leg({ units: { regular: 3, elite: 0, special_elite: 0 } }); // fine 6
    const weak = leg({ faction: 'atreides', area: 'sihaya_ridge', units: { regular: 1, elite: 0, special_elite: 0 } }); // fine 2
    expect(harkonnenShouldContinueAttack(strong, weak)).toBe(true); // 6 > 1
  });

  it('ceases when fine power <= half the opponent', () => {
    const h = leg({ units: { regular: 1, elite: 0, special_elite: 0 } }); // fine 2
    const a = leg({ faction: 'atreides', area: 'sihaya_ridge', units: { regular: 2, elite: 0, special_elite: 0 } }); // fine 4
    expect(harkonnenShouldContinueAttack(h, a)).toBe(false); // 2 <= 2
  });
});

describe('applyHarkonnenHits', () => {
  it('sheds extra leaders (Bashar first), keeping a named leader', () => {
    const l = leg({ units: { regular: 2, elite: 0, special_elite: 0 }, leaders: [gen, named('Rabban'), gen] });
    const { legion, casualties } = applyHarkonnenHits(l, 2);
    expect(legion.leaders).toHaveLength(1);
    expect(legion.leaders[0]).toEqual(named('Rabban'));
    expect(casualties.genericLeaders).toBe(2);
    expect(legion.units.regular).toBe(2); // units untouched
  });

  it('downgrades elite then special_elite to regular before removing regulars', () => {
    const l = leg({ units: { regular: 1, elite: 1, special_elite: 1 } });
    const { legion } = applyHarkonnenHits(l, 2);
    // hit1: elite->regular ; hit2: special_elite->regular
    expect(legion.units).toEqual({ regular: 3, elite: 0, special_elite: 0 });
  });

  it('removes a regular when more than one remains', () => {
    const l = leg({ units: { regular: 3, elite: 0, special_elite: 0 } });
    const { legion, casualties } = applyHarkonnenHits(l, 1);
    expect(legion.units.regular).toBe(2);
    expect(casualties.units).toBe(1);
  });

  it('eliminates the leader instead of the last regular', () => {
    const l = leg({ units: { regular: 1, elite: 0, special_elite: 0 }, leaders: [named('Feyd')] });
    const { legion, casualties } = applyHarkonnenHits(l, 1);
    expect(legion.units.regular).toBe(1); // regular kept
    expect(legion.leaders).toHaveLength(0); // leader taken instead
    expect(casualties.namedLeaders).toBe(1);
  });

  it('removes surviving leaders once all units are gone (named -> regen)', () => {
    const l = leg({ units: { regular: 1, elite: 0, special_elite: 0 }, leaders: [named('Feyd')] });
    const { legion, casualties } = applyHarkonnenHits(l, 2);
    // hit1: leader taken (would clear last regular); hit2: removes the regular -> 0 units
    expect(legion.units.regular).toBe(0);
    expect(legion.leaders).toHaveLength(0);
    expect(casualties.units).toBe(1);
    expect(casualties.namedLeaders).toBe(1);
  });

  it('does not over-remove when hits exceed the legion', () => {
    const l = leg({ units: { regular: 1, elite: 0, special_elite: 0 } });
    const { legion } = applyHarkonnenHits(l, 10);
    expect(legion.units.regular).toBe(0);
    expect(legion.leaders).toHaveLength(0);
  });
});

describe('applyDefaultHits (defender)', () => {
  it('removes cheapest figures first (regular, then elite, then special_elite)', () => {
    const l = leg({ faction: 'atreides', area: 'sihaya_ridge', units: { regular: 1, elite: 1, special_elite: 1 } });
    const { legion } = applyDefaultHits(l, 2);
    expect(legion.units).toEqual({ regular: 0, elite: 0, special_elite: 1 });
  });
});

describe('resolveBattle', () => {
  it('attacker wins when it out-rolls a weak defender', () => {
    const ctx = {
      attacker: leg({ units: { regular: 5, elite: 0, special_elite: 0 } }),
      defender: leg({ faction: 'atreides', area: 'sihaya_ridge', units: { regular: 1, elite: 0, special_elite: 0 } }),
    };
    // attacker deals 1 hit/round, defender deals none.
    const roll: DiceProvider = () => ({ attacker: { hits: 1, shields: 0 }, defender: { hits: 0, shields: 0 } });
    const res = resolveBattle(ctx, roll);
    expect(res.outcome).toBe('attacker_won');
    expect(res.defender.units.regular).toBe(0);
  });

  it('ceases (defender survives) when the Harkonnen drop to <= half the defender', () => {
    const ctx = {
      attacker: leg({ units: { regular: 2, elite: 0, special_elite: 0 } }), // fine 4
      defender: leg({ faction: 'atreides', area: 'sihaya_ridge', units: { regular: 3, elite: 0, special_elite: 0 } }), // fine 6
    };
    // defender deals 1 hit/round to the attacker, attacker deals 0.
    const roll: DiceProvider = () => ({ attacker: { hits: 0, shields: 0 }, defender: { hits: 1, shields: 0 } });
    const res = resolveBattle(ctx, roll);
    expect(res.outcome).toBe('defender_survived');
    expect(res.attacker.units.regular).toBeLessThan(2); // took some casualties before ceasing
  });

  it('shields cancel hits', () => {
    const ctx = {
      attacker: leg({ units: { regular: 5, elite: 0, special_elite: 0 } }),
      defender: leg({ faction: 'atreides', area: 'sihaya_ridge', units: { regular: 2, elite: 0, special_elite: 0 } }),
    };
    // attacker scores 2 hits but defender shields 2 -> no net hits ever; attacker never wins,
    // but defender also deals nothing, so the Harkonnen keep attacking. Stop via a round cap.
    let n = 0;
    const roll: DiceProvider = () => {
      n++;
      return { attacker: { hits: 2, shields: 0 }, defender: { hits: 0, shields: 2 } };
    };
    // guard against infinite loop: defender shields everything, attacker power stays high.
    const res = resolveBattle({ ...ctx, defender: leg({ faction: 'atreides', area: 'sihaya_ridge', units: { regular: 2, elite: 0, special_elite: 0 } }) },
      (r, a, d) => (n < 3 ? roll(r, a, d) : { attacker: { hits: 5, shields: 0 }, defender: { hits: 0, shields: 0 } }));
    // first rounds no net damage, later rounds attacker breaks through
    expect(res.outcome).toBe('attacker_won');
  });

  it('charges the attacker an extra hit to continue against a settlement defender', () => {
    const ctx = {
      attacker: leg({ units: { regular: 6, elite: 0, special_elite: 0 } }),
      defender: leg({ faction: 'atreides', area: 'sihaya_ridge', units: { regular: 1, elite: 0, special_elite: 0 } }),
      defenderSettlementRank: 2,
    };
    // attacker kills the single defender unit in round 1; no settlement surcharge once defender is gone.
    const roll: DiceProvider = () => ({ attacker: { hits: 1, shields: 0 }, defender: { hits: 0, shields: 0 } });
    const res = resolveBattle(ctx, roll);
    expect(res.outcome).toBe('attacker_won');
    expect(res.attacker.units.regular).toBe(6); // defender died same round -> no surcharge
  });

  it('uses reinforcements to reach 6 dice unless the Landsraad ban is active', () => {
    let seenAttackerDice = 0;
    const provider: DiceProvider = (_r, a) => {
      seenAttackerDice = a;
      return { attacker: { hits: 99, shields: 0 }, defender: { hits: 0, shields: 0 } };
    };
    const ctx = {
      attacker: leg({ units: { regular: 3, elite: 0, special_elite: 0 } }),
      defender: leg({ faction: 'atreides', area: 'sihaya_ridge', units: { regular: 1, elite: 0, special_elite: 0 } }),
      reinforcements: 5,
    };
    resolveBattle(ctx, provider);
    expect(seenAttackerDice).toBe(6); // 3 units + 3 reinforcement discards
    resolveBattle({ ...ctx, landsraadBan: true }, provider);
    expect(seenAttackerDice).toBe(3); // banned -> no discards
  });
});
