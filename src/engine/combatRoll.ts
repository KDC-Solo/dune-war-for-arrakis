// Resolving raw combat dice into final hits & shields, accounting for leader combat abilities
// and Sardaukar/Fedaykin special-cancellation (rulebook "Combat Roll" / "Leader Combat Abilities" /
// "Sardaukar and Fedaykin Units", p24-25).
//
// This is the piece `resolveBattle` previously delegated to its DiceProvider. Kept separate so
// combat.ts stays leader-data-free (no circular import with leaders.ts).

import type { Leader } from './state';
import type { RollResult } from './combat';
import { leaderByName, GENERIC_LEADER_COMBAT } from './leaders';
import { atreidesLeaderByName } from './atreidesLeaders';

/** Raw faces from a combat roll: plain hits, plain shields, and special results. */
export interface RawRoll {
  hits: number;
  shields: number;
  specials: number;
}

/** The combat ability a leader applies when it converts one Special result. */
function leaderAbility(leader: Leader): { hits: number; shields: number } {
  if (leader.kind === 'named' && leader.name) {
    return (
      leaderByName(leader.name)?.combatAbility ??
      atreidesLeaderByName(leader.name)?.combatAbility ??
      GENERIC_LEADER_COMBAT
    );
  }
  return GENERIC_LEADER_COMBAT; // generic Bashar / Naib
}

/**
 * Resolve one side's raw roll into final {hits, shields}:
 *   1. The opponent's Sardaukar/Fedaykin units each cancel 1 of this side's Special results.
 *   2. Each Leader converts 1 remaining Special via its combat ability (named → its strip,
 *      generic → 1 hit). Specials beyond the number of leaders are misses.
 * Leaders are applied in array order (callers wanting the optimal pick can pre-sort).
 */
export function resolveCombatRoll(raw: RawRoll, leaders: Leader[], opponentSpecialElites: number): RollResult {
  let specials = Math.max(0, raw.specials - Math.max(0, opponentSpecialElites));
  let hits = raw.hits;
  let shields = raw.shields;

  for (const leader of leaders) {
    if (specials <= 0) break;
    specials--;
    const ability = leaderAbility(leader);
    hits += ability.hits;
    shields += ability.shields;
  }
  return { hits, shields };
}

/**
 * Net hits landed by each side once shields cancel opponent hits.
 * `attacker`/`defender` are the post-`resolveCombatRoll` results.
 */
export function netHits(
  attacker: RollResult,
  defender: RollResult,
): { onDefender: number; onAttacker: number } {
  return {
    onDefender: Math.max(0, attacker.hits - defender.shields),
    onAttacker: Math.max(0, defender.hits - attacker.shields),
  };
}
