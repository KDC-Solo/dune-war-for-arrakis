import { describe, it, expect } from 'vitest';
import { combatPower, fineCombatPower, combatPowerDiff } from './combatPower';
import { emptyLegion, type Legion } from './state';

function legion(over: Partial<Legion>): Legion {
  return { ...emptyLegion('harkonnen', 'carthag'), ...over };
}

describe('combatPower (coarse)', () => {
  it('counts 1 per unit, 2 per deployment token, 1 per leader', () => {
    const l = legion({
      units: { regular: 2, elite: 1, special_elite: 1 }, // 4 units -> 4
      deploymentTokens: 2, // -> 4
      leaders: [
        { kind: 'generic', faction: 'harkonnen' },
        { kind: 'named', faction: 'harkonnen', name: 'Beast Rabban' },
      ], // -> 2
    });
    expect(combatPower(l)).toBe(10);
  });

  it('treats every unit tier as 1 (tier-blind)', () => {
    const a = legion({ units: { regular: 3, elite: 0, special_elite: 0 } });
    const b = legion({ units: { regular: 0, elite: 0, special_elite: 3 } });
    expect(combatPower(a)).toBe(combatPower(b));
    expect(combatPower(a)).toBe(3);
  });

  it('is 0 for an empty legion', () => {
    expect(combatPower(emptyLegion('atreides', 'arrakeen'))).toBe(0);
  });
});

describe('fineCombatPower (tie-break)', () => {
  it('scores regular 2 / elite 3 / special_elite 4 / deploy token 2', () => {
    const l = legion({
      units: { regular: 1, elite: 1, special_elite: 1 }, // 2+3+4 = 9
      deploymentTokens: 1, // +2
    });
    expect(fineCombatPower(l)).toBe(11);
  });

  it('scores generic leader 1, named leader 2', () => {
    const l = legion({
      leaders: [
        { kind: 'generic', faction: 'harkonnen' },
        { kind: 'named', faction: 'harkonnen', name: 'Feyd-Rautha' },
      ],
    });
    expect(fineCombatPower(l)).toBe(3);
  });

  it('distinguishes legions that tie on coarse power', () => {
    const elites = legion({ units: { regular: 0, elite: 2, special_elite: 0 } });
    const regulars = legion({ units: { regular: 2, elite: 0, special_elite: 0 } });
    expect(combatPower(elites)).toBe(combatPower(regulars)); // both 2
    expect(fineCombatPower(elites)).toBeGreaterThan(fineCombatPower(regulars)); // 6 > 4
  });
});

describe('combatPowerDiff', () => {
  it('is attacker minus defender (coarse)', () => {
    const attacker = legion({ units: { regular: 4, elite: 0, special_elite: 0 } });
    const defender = legion({ faction: 'atreides', area: 'sihaya_ridge', units: { regular: 1, elite: 0, special_elite: 0 } });
    expect(combatPowerDiff(attacker, defender)).toBe(3);
  });
});
