// Harkonnen combat resolution (deterministic parts): casualty application, dice count, and
// the "cease attack" rule. Dice *rolling* (random faces) is injected by the caller.
//
// Source: rulebook Battles / Remove Casualties (p25-26) + fan summary p9 Harkonnen combat
// criteria. Combat operates on revealed legions — Harkonnen deployment tokens are flipped to
// units at the start of a battle, so a legion in combat has deploymentTokens === 0.

import type { Legion, Leader, UnitType } from './state';
import { fineCombatPower } from './combatPower';
import { reserveDeltaFromCasualties, type ReserveDelta } from './reserve';

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
  /** Harkonnen casualties to fold back into the reserve (units/bashars returned, named → tank). */
  harkonnenReserveDelta: ReserveDelta;
}

const liveUnits = (l: Legion) => l.units.regular + l.units.elite + l.units.special_elite + l.deploymentTokens;
const eliminated = (l: Legion) => liveUnits(l) === 0 && l.leaders.length === 0;

// ---------------------------------------------------------------------------
// Stepwise battle (drives one round at a time — for an interactive UI). The whole-battle
// `resolveBattle` below is a thin loop over these, so both share one set of combat rules.
// ---------------------------------------------------------------------------

export type BattleStatus = 'ongoing' | 'attacker_won' | 'defender_survived' | 'attacker_eliminated';

/** A battle paused between rounds. Pure data — every helper returns a new session. */
export interface BattleSession {
  ctx: BattleContext;
  attacker: Legion;
  defender: Legion;
  rounds: number;
  /** Reinforcement cards still available to discard. */
  reinforcements: number;
  reinforcementsUsed: number;
  status: BattleStatus;
}

/** Dice each side rolls in the upcoming round (plus what the Harkonnen are spending). */
export interface RoundSetup {
  attackerDice: number;
  defenderDice: number;
  /** Reinforcement cards the Harkonnen discard this round to reach 6 dice. */
  discards: number;
  /** First-round surprise bonus is in effect. */
  surprise: boolean;
}

/** Outcome once the defender is eliminated: 'attacker_won', etc. (the cease check runs each round). */
function evalStatus(attacker: Legion, defender: Legion): BattleStatus {
  if (eliminated(defender)) return 'attacker_won';
  if (eliminated(attacker)) return 'attacker_eliminated';
  if (!harkonnenShouldContinueAttack(attacker, defender)) return 'defender_survived';
  return 'ongoing';
}

/** Open a battle. The status reflects an immediate decision (e.g. the Harkonnen never engage). */
export function beginBattle(ctx: BattleContext): BattleSession {
  return {
    ctx,
    attacker: ctx.attacker,
    defender: ctx.defender,
    rounds: 0,
    reinforcements: ctx.reinforcements ?? 0,
    reinforcementsUsed: 0,
    status: evalStatus(ctx.attacker, ctx.defender),
  };
}

/** How many dice each side rolls in `session`'s next round (and the Harkonnen discard plan). */
export function battleRoundSetup(session: BattleSession): RoundSetup {
  const { ctx } = session;
  const attUnits = liveUnits(session.attacker);
  const defUnits = liveUnits(session.defender);
  let discards = 0;
  if (!ctx.landsraadBan && session.reinforcements > 0) {
    discards = Math.max(0, Math.min(session.reinforcements, MAX_COMBAT_DICE - attUnits));
  }
  const surprise = !!ctx.surprise && session.rounds === 0;
  let attackerDice = combatDiceCount(attUnits, { discards });
  if (surprise) attackerDice = Math.min(MAX_COMBAT_DICE, attackerDice + 1);
  const defenderDice = combatDiceCount(defUnits, { defendingSettlementRank: ctx.defenderSettlementRank });
  return { attackerDice, defenderDice, discards, surprise };
}

/**
 * Apply one round's roll (post-shield-cancellation hits per side) and return the next session.
 * No-op once the battle is over. Defender casualties default to `applyDefaultHits` (override via
 * `ctx.chooseDefenderCasualties`); the attacker takes the Harkonnen casualty priority plus the
 * +1 settlement-assault hit when continuing against a defended settlement.
 */
export function resolveBattleRound(session: BattleSession, r: RollOutcome): BattleSession {
  if (session.status !== 'ongoing') return session;
  const chooseDef = session.ctx.chooseDefenderCasualties ?? ((d: Legion, h: number) => applyDefaultHits(d, h).legion);
  const { discards } = battleRoundSetup(session);

  const hitsOnDefender = Math.max(0, r.attacker.hits - r.defender.shields);
  const hitsOnAttacker = Math.max(0, r.defender.hits - r.attacker.shields);

  let defender = chooseDef(session.defender, hitsOnDefender);
  let attacker = applyHarkonnenHits(session.attacker, hitsOnAttacker).legion;
  if (session.ctx.defenderSettlementRank && !eliminated(defender) && !eliminated(attacker)) {
    attacker = applyHarkonnenHits(attacker, 1).legion;
  }

  return {
    ...session,
    attacker,
    defender,
    rounds: session.rounds + 1,
    reinforcements: session.reinforcements - discards,
    reinforcementsUsed: session.reinforcementsUsed + discards,
    status: evalStatus(attacker, defender),
  };
}

/** The Harkonnen reserve replenishment for the casualties taken so far in `session`. */
export function battleReserveDelta(session: BattleSession): ReserveDelta {
  return reserveDeltaFromCasualties(session.ctx.attacker, session.attacker);
}

/** Per-round roll once shields/leaders are resolved (see combatRoll.resolveCombatRoll). */
interface RollOutcome {
  attacker: RollResult;
  defender: RollResult;
}

/**
 * Resolve a full battle of the Harkonnen attacking an Atreides legion. The Harkonnen never
 * retreat and cease only when their fine combat power drops to ≤ half the defender's (checked at
 * the start of each round). Dice are produced by the injected `roll` provider. Reinforcement
 * cards are spent to bring the Harkonnen to 6 dice each round (unless the Landsraad ban is active).
 */
export function resolveBattle(ctx: BattleContext, roll: DiceProvider): BattleResult {
  let session = beginBattle(ctx);
  while (session.status === 'ongoing') {
    const setup = battleRoundSetup(session);
    const r = roll(session.rounds, setup.attackerDice, setup.defenderDice);
    session = resolveBattleRound(session, r);
  }
  return {
    attacker: session.attacker,
    defender: session.defender,
    rounds: session.rounds,
    outcome: session.status as BattleResult['outcome'],
    reinforcementsUsed: session.reinforcementsUsed,
    harkonnenReserveDelta: battleReserveDelta(session),
  };
}
