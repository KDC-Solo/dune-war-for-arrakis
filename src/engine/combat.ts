// Harkonnen combat resolution (deterministic parts): casualty application, dice count, and
// the "cease attack" rule. Dice *rolling* (random faces) is injected by the caller.
//
// Source: rulebook Battles / Remove Casualties (p25-26) + fan summary p9 Harkonnen combat
// criteria. Combat operates on revealed legions — Harkonnen deployment tokens are flipped to
// units at the start of a battle, so a legion in combat has deploymentTokens === 0.

import type { Legion, Leader, UnitType } from './state';
import { fineCombatPower } from './combatPower';

/** Max combat dice a legion can ever roll. */
export const MAX_COMBAT_DICE = 6;

/**
 * Combat dice rolled = units in the legion + planning cards discarded this round, plus the
 * defending settlement's rank when defending in a settlement. Never exceeds 6.
 * (Deployment tokens are revealed to units before combat, so they're included via `units`.)
 */
export function combatDiceCount(
  unitsInLegion: number,
  opts: { discards?: number; defendingSettlementRank?: number } = {},
): number {
  const n = unitsInLegion + (opts.discards ?? 0) + (opts.defendingSettlementRank ?? 0);
  return Math.min(MAX_COMBAT_DICE, Math.max(0, n));
}

/**
 * The Harkonnen cease attacking only when, at the start of a combat round, their combat power
 * is ≤ half the opponent's (individual-unit / fine combat power). They never retreat.
 * Returns true if the Harkonnen should keep attacking.
 */
export function harkonnenShouldContinueAttack(harkonnen: Legion, opponent: Legion): boolean {
  return fineCombatPower(harkonnen) > fineCombatPower(opponent) / 2;
}

export interface Casualties {
  /** Regular/elite/special-elite figures removed (return to deployment pool). */
  units: number;
  /** Generic leaders removed (return to pool). */
  genericLeaders: number;
  /** Named leaders removed (go to the regeneration tank). */
  namedLeaders: number;
}

function cloneLegion(l: Legion): Legion {
  return { ...l, units: { ...l.units }, leaders: l.leaders.map((x) => ({ ...x })) };
}

function totalUnits(units: Record<UnitType, number>): number {
  return units.regular + units.elite + units.special_elite;
}

/** Remove one leader, preferring generic (Bashar) so a named leader is kept last. */
function removeOneLeader(leaders: Leader[], cas: Casualties): void {
  const genericIdx = leaders.findIndex((l) => l.kind === 'generic');
  const idx = genericIdx >= 0 ? genericIdx : 0;
  const [removed] = leaders.splice(idx, 1);
  if (removed.kind === 'named') cas.namedLeaders++;
  else cas.genericLeaders++;
}

/**
 * Apply `hits` to a Harkonnen legion following the solo casualty priority, one hit at a time:
 *   1. Eliminate extra leaders (Bashar first) until only 1 leader remains (named if possible).
 *   2. Replace an elite unit with a regular unit.
 *   3. Replace a Sardaukar (special elite) unit with a regular unit.
 *   4. Eliminate a regular unit — but if a leader still remains and this hit would remove the
 *      last regular, eliminate that leader instead.
 * If all units are eliminated, any surviving leaders are also removed.
 * Returns the resulting legion and the casualties taken.
 */
export function applyHarkonnenHits(legion: Legion, hits: number): { legion: Legion; casualties: Casualties } {
  const l = cloneLegion(legion);
  const cas: Casualties = { units: 0, genericLeaders: 0, namedLeaders: 0 };

  for (let h = 0; h < hits; h++) {
    if (totalUnits(l.units) === 0 && l.leaders.length === 0) break; // nothing left

    if (l.leaders.length > 1) {
      removeOneLeader(l.leaders, cas); // 1. shed extra leaders
    } else if (l.units.elite > 0) {
      l.units.elite--; // 2. elite -> regular
      l.units.regular++;
    } else if (l.units.special_elite > 0) {
      l.units.special_elite--; // 3. sardaukar -> regular
      l.units.regular++;
    } else if (l.units.regular > 0) {
      // 4. remove a regular, unless a leader remains and this would clear the last regular.
      if (l.leaders.length > 0 && l.units.regular === 1) {
        removeOneLeader(l.leaders, cas);
      } else {
        l.units.regular--;
        cas.units++;
      }
    } else if (l.leaders.length > 0) {
      removeOneLeader(l.leaders, cas); // only leaders left
    }
  }

  // If no units survive, remaining leaders are also removed.
  if (totalUnits(l.units) === 0 && l.leaders.length > 0) {
    while (l.leaders.length > 0) removeOneLeader(l.leaders, cas);
  }
  return { legion: l, casualties: cas };
}

/**
 * Default casualty application for a non-Harkonnen (Atreides) legion: absorb each hit by removing
 * the cheapest figure first — a regular, then downgrade an elite, then a special elite, then a
 * leader — to preserve fighting strength. The real Atreides casualties are the player's choice;
 * this is the simulation/testing default and can be overridden via `resolveBattle`.
 */
export function applyDefaultHits(legion: Legion, hits: number): { legion: Legion; casualties: Casualties } {
  const l = cloneLegion(legion);
  const cas: Casualties = { units: 0, genericLeaders: 0, namedLeaders: 0 };
  for (let h = 0; h < hits; h++) {
    if (totalUnits(l.units) === 0 && l.leaders.length === 0) break;
    if (l.units.regular > 0) {
      l.units.regular--;
      cas.units++;
    } else if (l.units.elite > 0) {
      l.units.elite--;
      cas.units++;
    } else if (l.units.special_elite > 0) {
      l.units.special_elite--;
      cas.units++;
    } else {
      removeOneLeader(l.leaders, cas);
    }
  }
  if (totalUnits(l.units) === 0 && l.leaders.length > 0) {
    while (l.leaders.length > 0) removeOneLeader(l.leaders, cas);
  }
  return { legion: l, casualties: cas };
}

// ---------------------------------------------------------------------------
// Battle loop (dice rolling injected — RNG for tests, player input for the app)
// ---------------------------------------------------------------------------

/** Per-side outcome of one combat roll: hits scored and shields rolled (after leader/Special
 *  abilities and Sardaukar/Fedaykin cancellation, which the provider accounts for). */
export interface RollResult {
  hits: number;
  shields: number;
}

/**
 * Rolls one combat round. `attackerDice`/`defenderDice` are how many dice each side rolls;
 * returns each side's hits & shields. For the app, the player enters their physical dice; for
 * tests, inject a deterministic function.
 */
export type DiceProvider = (
  round: number,
  attackerDice: number,
  defenderDice: number,
) => { attacker: RollResult; defender: RollResult };

export interface BattleContext {
  /** Harkonnen attacking legion. */
  attacker: Legion;
  /** Atreides defending legion. */
  defender: Legion;
  /** Rank of the settlement/sietch the defender occupies (extra defender dice + continue cost). */
  defenderSettlementRank?: number;
  /** First-round surprise attack (+1 attacker die round 1). */
  surprise?: boolean;
  /** Harkonnen reinforcement cards available to discard for extra dice. */
  reinforcements?: number;
  /** Landsraad ban active → Harkonnen cannot discard reinforcements for dice. */
  landsraadBan?: boolean;
  /** Override for defender casualty choice (defaults to applyDefaultHits). */
  chooseDefenderCasualties?: (defender: Legion, hits: number) => Legion;
}

export interface BattleResult {
  attacker: Legion;
  defender: Legion;
  rounds: number;
  /** 'attacker_won' (defender eliminated), 'defender_survived' (Harkonnen ceased), or 'attacker_eliminated'. */
  outcome: 'attacker_won' | 'defender_survived' | 'attacker_eliminated';
  reinforcementsUsed: number;
}

const liveUnits = (l: Legion) => l.units.regular + l.units.elite + l.units.special_elite + l.deploymentTokens;
const eliminated = (l: Legion) => liveUnits(l) === 0 && l.leaders.length === 0;

/**
 * Resolve a full battle of the Harkonnen attacking an Atreides legion. The Harkonnen never
 * retreat and cease only when their fine combat power drops to ≤ half the defender's (checked at
 * the start of each round). Dice are produced by the injected `roll` provider. Reinforcement
 * cards are spent to bring the Harkonnen to 6 dice each round (unless the Landsraad ban is active).
 */
export function resolveBattle(ctx: BattleContext, roll: DiceProvider): BattleResult {
  let attacker = ctx.attacker;
  let defender = ctx.defender;
  const chooseDef = ctx.chooseDefenderCasualties ?? ((d: Legion, h: number) => applyDefaultHits(d, h).legion);
  let reinforcements = ctx.reinforcements ?? 0;
  let reinforcementsUsed = 0;
  let rounds = 0;

  while (true) {
    if (eliminated(defender)) return { attacker, defender, rounds, outcome: 'attacker_won', reinforcementsUsed };
    if (eliminated(attacker)) return { attacker, defender, rounds, outcome: 'attacker_eliminated', reinforcementsUsed };
    if (!harkonnenShouldContinueAttack(attacker, defender)) {
      return { attacker, defender, rounds, outcome: 'defender_survived', reinforcementsUsed };
    }

    const attUnits = liveUnits(attacker);
    const defUnits = liveUnits(defender);
    // Harkonnen discard reinforcements to reach 6 dice (unless banned).
    let discards = 0;
    if (!ctx.landsraadBan && reinforcements > 0) {
      discards = Math.max(0, Math.min(reinforcements, MAX_COMBAT_DICE - attUnits));
    }
    let attackerDice = combatDiceCount(attUnits, { discards });
    if (ctx.surprise && rounds === 0) attackerDice = Math.min(MAX_COMBAT_DICE, attackerDice + 1);
    const defenderDice = combatDiceCount(defUnits, { defendingSettlementRank: ctx.defenderSettlementRank });

    const r = roll(rounds, attackerDice, defenderDice);
    reinforcements -= discards;
    reinforcementsUsed += discards;

    const hitsOnDefender = Math.max(0, r.attacker.hits - r.defender.shields);
    const hitsOnAttacker = Math.max(0, r.defender.hits - r.attacker.shields);

    defender = chooseDef(defender, hitsOnDefender);
    attacker = applyHarkonnenHits(attacker, hitsOnAttacker).legion;

    // To continue against a defender in a settlement, the attacker takes 1 extra hit.
    if (ctx.defenderSettlementRank && !eliminated(defender) && !eliminated(attacker)) {
      attacker = applyHarkonnenHits(attacker, 1).legion;
    }
    rounds++;
  }
}
