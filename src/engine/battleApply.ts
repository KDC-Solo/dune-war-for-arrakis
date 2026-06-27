// Commit a finished stepwise battle (combat.ts BattleSession) back into the full GameState:
// replace/remove the two legions, replenish the Harkonnen reserve from casualties, spend the
// reinforcement cards used, and destroy a sietch whose Atreides defenders were wiped out.
//
// Pure: returns a new state. Combat rules live in combat.ts; this only maps the result onto state.

import type { GameState, Legion } from './state';
import { battleReserveDelta, type BattleSession } from './combat';
import { applyReserveDelta } from './reserve';
import { areaLabel } from './describeArea';

const isEmpty = (l: Legion) =>
  l.units.regular + l.units.elite + l.units.special_elite + l.deploymentTokens === 0 && l.leaders.length === 0;

/** Replace the matching legion (same faction + area) with `next`, or drop it if `next` is empty. */
function replaceLegion(legions: Legion[], faction: Legion['faction'], area: string, next: Legion): Legion[] {
  const out: Legion[] = [];
  for (const l of legions) {
    if (l.faction === faction && l.area === area) {
      if (!isEmpty(next)) out.push(next);
    } else {
      out.push(l);
    }
  }
  return out;
}

export interface CommitBattleResult {
  state: GameState;
  note: string;
}

/**
 * Fold a resolved battle into the game state. The attacker is always Harkonnen and the defender
 * Atreides (Mahdi solo). If the defender is eliminated in a sietch, that sietch is destroyed (and
 * cleared as the current target). Reinforcement cards used are removed from the deck and the
 * Harkonnen reserve is replenished with the attacker's casualties.
 */
export function commitBattle(s: GameState, session: BattleSession): CommitBattleResult {
  const atk = session.ctx.attacker;
  const def = session.ctx.defender;

  let legions = replaceLegion(s.legions, atk.faction, atk.area, session.attacker);
  legions = replaceLegion(legions, def.faction, def.area, session.defender);

  const defenderWiped = isEmpty(session.defender);

  let sietches = s.sietches;
  let targetSietchId = s.targetSietchId;
  let destroyedSietch = false;
  if (defenderWiped) {
    sietches = s.sietches.map((si) =>
      si.area === def.area && !si.destroyed ? ((destroyedSietch = true), { ...si, destroyed: true, revealed: true }) : si,
    );
    if (destroyedSietch && targetSietchId === def.area) targetSietchId = null;
  }

  const reservedReinforcements = Math.max(0, (s.decks.reinforcements ?? 0) - session.reinforcementsUsed);
  const harkonnenReserve = applyReserveDelta(s.harkonnenReserve, battleReserveDelta(session));

  const where = areaLabel(def.area);
  const notes: string[] = [];
  if (session.status === 'attacker_won') notes.push(`Harkonnen take ${where}` + (destroyedSietch ? ' — sietch destroyed.' : '.'));
  else if (session.status === 'attacker_eliminated') notes.push(`Harkonnen attack on ${where} wiped out.`);
  else notes.push(`Harkonnen ceased the attack on ${where}.`);
  if (session.reinforcementsUsed > 0) notes.push(`${session.reinforcementsUsed} reinforcement card(s) spent.`);

  return {
    state: {
      ...s,
      legions,
      sietches,
      targetSietchId,
      decks: { ...s.decks, reinforcements: reservedReinforcements },
      harkonnenReserve,
    },
    note: notes.join(' '),
  };
}
