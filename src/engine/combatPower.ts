// Combat power scoring (Mahdi solo, fan summary p9).
//
// Two measures the AI uses:
//  - combatPower:     coarse legion strength, compared for attack/move/deploy decisions.
//  - fineCombatPower: tie-break / per-unit value, used "on a tie (or if you need to
//                     consider the combat power of individual units)".

import type { Legion, UnitType } from './state';

/**
 * Coarse legion combat power:
 *   1 per unit + 2 per deployment token + 1 per leader (generic or named).
 * Every unit tier counts as 1 here (tiers only matter for fineCombatPower).
 */
export function combatPower(l: Legion): number {
  const units = l.units.regular + l.units.elite + l.units.special_elite;
  return units + 2 * l.deploymentTokens + l.leaders.length;
}

/** Per-unit value for tie-breaks. */
const FINE_UNIT: Record<UnitType, number> = {
  regular: 2,
  elite: 3,
  special_elite: 4, // Sardaukar / Fedaykin
};

/**
 * Fine combat power (tie-break):
 *   generic leader 1 · regular unit OR named leader 2 · elite unit 3 ·
 *   Sardaukar/Fedaykin 4 · deployment token 2.
 */
export function fineCombatPower(l: Legion): number {
  let total =
    l.units.regular * FINE_UNIT.regular +
    l.units.elite * FINE_UNIT.elite +
    l.units.special_elite * FINE_UNIT.special_elite +
    l.deploymentTokens * 2;
  for (const leader of l.leaders) total += leader.kind === 'named' ? 2 : 1;
  return total;
}

/**
 * Combat-power difference (attacker − defender), the AI's "greatest combat power difference"
 * comparator. Uses the coarse measure; callers fall back to fineCombatPower on ties.
 */
export function combatPowerDiff(attacker: Legion, defender: Legion): number {
  return combatPower(attacker) - combatPower(defender);
}
