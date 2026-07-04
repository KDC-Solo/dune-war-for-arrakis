// Commit a finished stepwise battle (combat.ts BattleSession) back into the full GameState:
// replace/remove the two legions, replenish the Harkonnen reserve from casualties, spend the
// reinforcement cards used, and destroy a sietch whose Atreides defenders were wiped out.
//
// Pure: returns a new state. Combat rules live in combat.ts; this only maps the result onto state.

import type { GameState, Legion } from './state';
import { emptyLegion } from './state';
import { battleReserveDelta, type BattleSession } from './combat';
import { applyReserveDelta } from './reserve';
import { upsertLegion, tokenPoolShortNote } from './applyAction';
import { areaLabel } from './describeArea';
import { SUPREMACY_WIN } from './round';

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
  const hkAttacking = atk.faction === 'harkonnen';

  let legions = replaceLegion(s.legions, atk.faction, atk.area, session.attacker);
  legions = replaceLegion(legions, def.faction, def.area, session.defender);

  const defenderWiped = isEmpty(session.defender);

  // Battles are fought from adjacent areas (rulebook p26): on a cease, "the surviving figures of
  // both players remain in the Areas where they were at the start of the battle" — the attacker
  // only ADVANCES into the defender's area after a victory. (When ctx areas are equal — legacy
  // co-located flows — the advance is a no-op.)
  const advanceNotes: string[] = [];
  let vehicles = s.vehicles;
  let advanced = false;
  if (session.status === 'attacker_won' && atk.area !== def.area && !isEmpty(session.attacker)) {
    advanced = true;
    // Merge with any friendly legion already in the taken area (legacy saves / manual edits) —
    // one legion per faction per area is a state invariant.
    const advancing = legions.find((l) => l.faction === atk.faction && l.area === atk.area);
    if (advancing) {
      legions = upsertLegion(
        legions.filter((l) => l !== advancing),
        { ...advancing, area: def.area },
      );
    }
    // Solo garrison rule (Harkonnen only): fully leaving a live settlement drops 2 tokens there.
    if (hkAttacking && s.settlements.some((st) => st.area === atk.area && !st.destroyed)) {
      const dropped = Math.min(2, s.harkonnenReserve.deploymentTokens);
      if (dropped > 0) {
        legions = [...legions, { ...emptyLegion(atk.faction, atk.area), deploymentTokens: dropped }];
        advanceNotes.push(`${dropped} garrison token${dropped === 1 ? '' : 's'} left in ${areaLabel(atk.area)}.`);
      }
      if (dropped < 2) advanceNotes.push(tokenPoolShortNote(2 - dropped));
    }
    if (hkAttacking && s.wormsigns.some((w) => w.area === def.area)) {
      advanceNotes.push('The advance enters a Wormsign — reveal and resolve it.');
    }
    // A victorious Atreides legion advancing into an area with a harvester removes it (rulebook).
    if (!hkAttacking && vehicles.some((v) => v.type === 'harvester' && v.location === def.area)) {
      vehicles = vehicles.filter((v) => !(v.type === 'harvester' && v.location === def.area));
      advanceNotes.push(`The harvester in ${areaLabel(def.area)} is destroyed.`);
    }
  }

  let sietches = s.sietches;
  let targetSietchId = s.targetSietchId;
  let tracks = s.tracks;
  let destroyedSietch = false;
  let destroyedSietchRank = 0;
  if (defenderWiped && def.faction === 'atreides') {
    sietches = s.sietches.map((si) =>
      si.area === def.area && !si.destroyed
        ? ((destroyedSietch = true), (destroyedSietchRank = si.rank ?? 0), { ...si, destroyed: true, revealed: true })
        : si,
    );
    if (destroyedSietch && targetSietchId === def.area) targetSietchId = null;
    // A destroyed sietch immediately scores supremacy equal to its rank (rulebook p27).
    if (destroyedSietch && destroyedSietchRank > 0) {
      tracks = { ...tracks, supremacy: Math.min(SUPREMACY_WIN, tracks.supremacy + destroyedSietchRank) };
    }
  }
  // An Atreides victor advancing into a settlement destroys it — prescience advances by its rank.
  let settlements = s.settlements;
  if (!hkAttacking && advanced) {
    const st = s.settlements.find((x) => x.area === def.area && !x.destroyed);
    if (st) {
      settlements = s.settlements.map((x) => (x.area === def.area ? { ...x, destroyed: true } : x));
      tracks = {
        ...tracks,
        prescience: tracks.prescience.map((v) => v + st.rank) as typeof tracks.prescience,
      };
      advanceNotes.push(`${areaLabel(def.area)} settlement destroyed — all prescience markers +${st.rank}.`);
    }
  }

  const reservedReinforcements = Math.max(0, (s.decks.reinforcements ?? 0) - session.reinforcementsUsed);
  let harkonnenReserve = applyReserveDelta(s.harkonnenReserve, battleReserveDelta(session));
  const garrisonDropped = advanceNotes.some((n) => n.includes('garrison'))
    ? Math.min(2, s.harkonnenReserve.deploymentTokens)
    : 0;
  if (garrisonDropped > 0) {
    harkonnenReserve = {
      ...harkonnenReserve,
      deploymentTokens: Math.max(0, harkonnenReserve.deploymentTokens - garrisonDropped),
    };
  }

  const where = areaLabel(def.area);
  const who = hkAttacking ? 'Harkonnen' : 'Atreides';
  const notes: string[] = [];
  if (session.status === 'attacker_won')
    notes.push(
      `${who} take ${where}` +
        (destroyedSietch
          ? ` — sietch destroyed${destroyedSietchRank > 0 ? `, supremacy +${destroyedSietchRank}` : ''}.`
          : '.'),
    );
  else if (session.status === 'attacker_eliminated') notes.push(`${who} attack on ${where} wiped out.`);
  else notes.push(`${who} ceased the attack on ${where}.`);
  if (session.reinforcementsUsed > 0) notes.push(`${session.reinforcementsUsed} reinforcement card(s) spent.`);
  notes.push(...advanceNotes);

  return {
    state: {
      ...s,
      legions,
      sietches,
      settlements,
      tracks,
      vehicles,
      targetSietchId,
      decks: { ...s.decks, reinforcements: reservedReinforcements },
      harkonnenReserve,
    },
    note: notes.join(' '),
  };
}
