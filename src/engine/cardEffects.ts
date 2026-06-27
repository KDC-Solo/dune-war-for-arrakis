// Planning-card effect resolution (Mahdi solo, Harkonnen decks).
//
// The solo app is a co-processor: it turns a card's printed text into ordered, structured play
// STEPS the player executes on the board, and auto-applies only the unambiguous mechanical ones
// (fixed-location unit placement, vehicle placement, deck draws). Steps that need a physical
// choice (which area, which leader, a move/attack, which units to replace) are left for the
// player and rendered as plain directives (`auto: false`, no `apply`).
//
// Card DATA lives in planningCards.ts; this module encodes each card's effect as a step list.

import type { GameState, PlanningDeck, UnitType, VehicleType } from './state';
import { emptyLegion } from './state';
import { upsertLegion } from './applyAction';
import { placeHarvesters, placeCarryalls, placeOrnithopters } from './vehiclePlacement';
import { cardById } from './planningCards';
import { areaLabel } from './describeArea';

// ---------------------------------------------------------------------------
// Step model
// ---------------------------------------------------------------------------

export interface CardStep {
  /** Human-readable directive for this step. */
  text: string;
  /** True if the engine applies it to state; false = the player resolves it on the board. */
  auto: boolean;
  /** Present iff `auto`: returns the next state. */
  apply?: (s: GameState) => GameState;
}

export interface CardResolution {
  id: string;
  name: string;
  steps: CardStep[];
}

// ---------------------------------------------------------------------------
// Settlement / village area ids (fixed board data)
// ---------------------------------------------------------------------------

const ARRAKEEN = 'arrakeen';
const CARTHAG = 'carthag';
const NORTH_POLE = 'north_pole';
const VILLAGES = ['arsunt', 'hagga_basin', 'imperial_basin', 'north_pole'];

const DECK_LABEL: Record<PlanningDeck, string> = {
  house_harkonnen: 'House Harkonnen',
  corrino_ally: 'Corrino Ally',
  house_atreides: 'House Atreides',
  fremen_ally: 'Fremen Ally',
};

const UNIT_LABEL: Record<UnitType, [string, string]> = {
  regular: ['Regular Unit', 'Regular Units'],
  elite: ['Elite Unit', 'Elite Units'],
  special_elite: ['Sardaukar Unit', 'Sardaukar Units'],
};

function fmtUnits(units: Partial<Record<UnitType, number>>): string {
  const parts: string[] = [];
  (Object.keys(units) as UnitType[]).forEach((t) => {
    const n = units[t] ?? 0;
    if (n > 0) parts.push(`${n} ${UNIT_LABEL[t][n === 1 ? 0 : 1]}`);
  });
  return parts.join(' and ');
}

// ---------------------------------------------------------------------------
// Step builders
// ---------------------------------------------------------------------------

/** Place a fixed mix of Harkonnen units in a known area, drawn from the reserve. Auto. */
function placeUnits(units: Partial<Record<UnitType, number>>, area: string): CardStep {
  return {
    text: `Place ${fmtUnits(units)} in ${areaLabel(area)}.`,
    auto: true,
    apply: (s) => {
      const reserve = { ...s.harkonnenReserve.units };
      const add = emptyLegion('harkonnen', area);
      (Object.keys(units) as UnitType[]).forEach((t) => {
        const want = units[t] ?? 0;
        const n = Math.min(want, reserve[t]);
        add.units[t] = n;
        reserve[t] = Math.max(0, reserve[t] - n);
      });
      return {
        ...s,
        legions: upsertLegion(s.legions, add),
        harkonnenReserve: { ...s.harkonnenReserve, units: reserve },
      };
    },
  };
}

/** Place 1 unit of one type in each of several fixed areas. Auto. */
function placeOneEach(type: UnitType, areas: string[], label: string): CardStep {
  return {
    text: `Place 1 ${UNIT_LABEL[type][0]} in ${label}.`,
    auto: true,
    apply: (s) => {
      let legions = s.legions;
      const reserve = { ...s.harkonnenReserve.units };
      for (const area of areas) {
        if (reserve[type] <= 0) break;
        const add = emptyLegion('harkonnen', area);
        add.units[type] = 1;
        reserve[type] -= 1;
        legions = upsertLegion(legions, add);
      }
      return { ...s, legions, harkonnenReserve: { ...s.harkonnenReserve, units: reserve } };
    },
  };
}

/** Place vehicles via the placement engine (it picks the board spots). Auto. */
function placeVehicles(counts: Partial<Record<VehicleType, number>>): CardStep {
  const desc = (Object.keys(counts) as VehicleType[])
    .filter((t) => (counts[t] ?? 0) > 0)
    .map((t) => `${counts[t]} ${t}${(counts[t] ?? 0) === 1 ? '' : 's'}`)
    .join(' and ');
  return {
    text: `Place ${desc} on the board (at the positions shown above).`,
    auto: true,
    apply: (s) => {
      const vehicles = [...s.vehicles];
      const newHarvesters = placeHarvesters(s, counts.harvester ?? 0);
      for (const loc of newHarvesters) vehicles.push({ type: 'harvester', location: loc });
      // Carryalls protect harvesters — feed them every harvester area (existing + just placed).
      const harvesterAreas = [
        ...s.vehicles.filter((v) => v.type === 'harvester').map((v) => v.location),
        ...newHarvesters,
      ];
      for (const loc of placeCarryalls(s, counts.carryall ?? 0, harvesterAreas)) vehicles.push({ type: 'carryall', location: loc });
      for (const loc of placeOrnithopters(s, counts.ornithopter ?? 0)) vehicles.push({ type: 'ornithopter', location: loc });
      return { ...s, vehicles };
    },
  };
}

/** Draw N cards from a planning deck (decrements the draw pile). Auto. */
function draw(deck: PlanningDeck, count: number): CardStep {
  return {
    text: `Draw ${count} ${DECK_LABEL[deck]} Planning card${count === 1 ? '' : 's'}.`,
    auto: true,
    apply: (s) => {
      const n = Math.min(count, s.decks.planning[deck]);
      return { ...s, decks: { ...s.decks, planning: { ...s.decks.planning, [deck]: s.decks.planning[deck] - n } } };
    },
  };
}

/** A step the player resolves on the board (move / attack / choice). Not auto-applied. */
function manual(text: string): CardStep {
  return { text, auto: false };
}

// ---------------------------------------------------------------------------
// Per-card step encodings (House Harkonnen deck)
// ---------------------------------------------------------------------------

type StepFn = (s: GameState) => CardStep;

const CARD_STEPS: Record<string, StepFn[]> = {
  hard_times_and_oppression: [
    () => placeOneEach('regular', VILLAGES, 'each Village'),
    () => placeOneEach('elite', [CARTHAG, ARRAKEEN], 'both Carthag and Arrakeen'),
  ],
  forced_recruitment: [
    () => placeUnits({ elite: 3 }, ARRAKEEN),
    () => manual('Place 1 Leader (Named or Bashar) in the Arrakeen Settlement.'),
  ],
  beloved_feyd_rautha: [
    () => manual('Feyd-Rautha enters play; permanently remove Beast Rabban from play. Then play 1 Planning card. (If Feyd-Rautha is already in play instead: place 2 Elite Units in his Legion.)'),
  ],
  harkonnen_patrols: [
    () => manual('Place 3 Regular Units in empty Desert Areas of your choice (1 per Area).'),
  ],
  arsunt_legion: [
    () => placeUnits({ elite: 1, regular: 1 }, 'arsunt'),
    () => manual('Place 1 Leader (Named or Bashar) in the Arsunt Settlement.'),
    () => manual('Then move or attack with the Legion in the Arsunt Settlement.'),
  ],
  barons_personal_guard: [
    () => placeUnits({ elite: 2 }, CARTHAG),
    () => manual('Place Baron Harkonnen in the Carthag or Arrakeen Settlement (with the 2 Elite Units above).'),
    () => manual('Then move any Legion.'),
  ],
  hawats_scheming: [
    () => manual("Free action: discard 2 or 3 Hawat's Scheming cards to remove Thufir Hawat from the game; then Gaius Helen Mohiam enters play. (Not played/discarded the usual way.)"),
  ],
  evidence_of_rebellion: [
    () => manual('Place 2 Elite Units in any Settlement of your choice.'),
    () => draw('house_harkonnen', 2),
  ],
  polar_cap_factories: [
    () => placeUnits({ regular: 2, elite: 1 }, NORTH_POLE),
    () => manual('Place 1 Bashar Leader in the North Pole Settlement.'),
    () => manual('Then discard all Wormsigns in Areas adjacent to the North Pole Settlement.'),
  ],
  carthag_the_former_capital: [
    () => placeUnits({ regular: 3, elite: 1 }, CARTHAG),
    () => manual('Place 1 Leader (Named or Bashar) in the Carthag Settlement.'),
  ],
  workhorse_of_arrakis: [
    () => placeVehicles({ harvester: 1, carryall: 1 }),
    () => draw('house_harkonnen', 2),
  ],
  spotter_control: [
    () => manual('Discard 3 Wormsigns of your choice.'),
    () => draw('house_harkonnen', 2),
  ],
  explosive_artillery: [
    () => manual('Move any Legion.'),
    () => manual('Then make a special attack against an adjacent enemy Legion: roll 4 Combat dice, 1 Hit per sword and special result.'),
  ],
  sandmasters: [
    () => placeVehicles({ harvester: 3 }),
    () => draw('house_harkonnen', 1),
  ],
  mudir_nahya_the_demon_ruler: [
    () => manual('Place Beast Rabban and 1 Elite Unit in any Legion, then make a Surprise Attack with it. (If Rabban is removed instead: place 1 Leader and 2 Elite Units in any Legion.)'),
  ],
  hunter_seeker: [
    () => manual('Choose 1 enemy Named Leader in the same Sector as a Harkonnen Legion and place that Leader in the Regeneration Tank.'),
  ],

  // --- Corrino Ally deck ---
  rage_overcame_shaddam_iv_a: [
    () => manual('Emperor Shaddam IV enters play, then play 1 Planning card. (If already in play instead: place Emperor Shaddam IV and 4 Regular Units in a Harkonnen Settlement of your choice.)'),
  ],
  rage_overcame_shaddam_iv_b: [
    () => manual('Emperor Shaddam IV enters play, then play 1 Planning card. (If already in play instead: place Emperor Shaddam IV and 2 Sardaukar Units in any Legion.)'),
  ],
  rage_overcame_shaddam_iv_c: [
    () => manual('Emperor Shaddam IV enters play, then play 1 Planning card. (If already in play instead: place him in a Legion containing a Sardaukar, then move and make a Surprise Attack with it.)'),
  ],
  manipulation_of_others: [
    () => manual('Force your opponent to discard 2 Planning cards of their choice.'),
    () => draw('corrino_ally', 2),
  ],
  breeding_program: [
    () => manual('Take 1 Bene Gesserit token from the reserve.'),
    () => manual('Then play 1 Planning card.'),
  ],
  troop_carriers: [
    () => manual('Move a Legion from a Settlement directly to an Area containing one of your Legions.'),
  ],
  shigawire: [
    () => manual('Move a Legion containing a Sardaukar.'),
    () => manual('Then place an enemy Named Leader adjacent to that Legion in the Regeneration Tank.'),
  ],
  hope_clouds_observation: [
    () => manual('Shuffle 1 revealed Prescience card of your choice back into the deck.'),
  ],
  reports_of_traitors: [
    () => manual("Discard 1 of your opponent's unused Action dice showing a House result."),
  ],
  sardaukar_pogrom: [
    () => manual('Move 3 Legions each containing a Sardaukar.'),
  ],
  sardaukars_manner: [
    () => manual('Move or make a Surprise Attack with a Legion containing a Sardaukar.'),
  ],
  spies_all_over_arrakis: [
    () => manual('Reveal any Sietch and all Deployment tokens in an Area of your choice.'),
    () => draw('corrino_ally', 2),
  ],
  full_control_of_the_air: [
    () => placeVehicles({ ornithopter: 2 }),
    () => manual('Then move a Legion of your choice.'),
  ],
  moving_the_battle_group: [
    () => manual('Place 1 Bashar Leader and 2 Elite Units in a free Mountain Area of your choice.'),
  ],
  killers_without_mercy: [
    () => manual('Attack with a Legion containing a Sardaukar. Each battle round, you may continue the battle without taking 1 Hit, even against a Sietch.'),
  ],
  sardaukar_disguised: [
    () => manual('Replace 2 Elite Units on the board with 2 Sardaukar Units.'),
    () => manual('Then move 2 Legions each containing a Sardaukar.'),
  ],
  i_decide_what_best_serves_his_majesty: [
    () => manual('Place Captain Aramsham in a Legion containing a Sardaukar, then move or make a Surprise Attack with it.'),
  ],
  seek_out_the_mahdi: [
    () => manual("Move a Legion of your choice. Next Action turn, your opponent cannot place/deploy Paul, nor move/attack with a Legion containing him."),
  ],
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Resolve a Harkonnen planning card into ordered play steps for the given state.
 * Returns null for an unknown id. Cards without an encoding fall back to a single
 * manual step carrying the printed text.
 */
export function resolveCardPlay(id: string, s: GameState): CardResolution | null {
  const card = cardById(id);
  if (!card) return null;
  const fns = CARD_STEPS[id];
  const steps = fns ? fns.map((fn) => fn(s)) : [manual(card.text)];
  return { id, name: card.name, steps };
}

/** Apply every auto step of a resolution in order, returning the resulting state. */
export function applyCardSteps(s: GameState, steps: CardStep[]): GameState {
  return steps.reduce((acc, step) => (step.auto && step.apply ? step.apply(acc) : acc), s);
}

/** Which card ids have a structured (non-fallback) step encoding. */
export function hasCardEncoding(id: string): boolean {
  return id in CARD_STEPS;
}
