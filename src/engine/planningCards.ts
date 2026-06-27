// Harkonnen-side planning-card catalog (House Harkonnen + Corrino Ally decks), captured from the
// physical cards. This is the card DATA (name + effect text); automated effect *resolution* is a
// separate subsystem (the solo rules say: for each effect, refer to deploy / move-attack / house /
// vehicle rules, or resolve it toward the target sietch). Only the two Harkonnen decks are needed
// for the AI — the Atreides/Fremen decks are the player's.

import type { PlanningDeck } from './state';

export interface PlanningCardDef {
  id: string;
  deck: PlanningDeck;
  name: string;
  /** Effect text as printed on the card. */
  text: string;
  /** Number of identical copies in the deck (default 1). */
  copies?: number;
}

export const HOUSE_HARKONNEN_CARDS: readonly PlanningCardDef[] = [
  {
    id: 'hard_times_and_oppression',
    deck: 'house_harkonnen',
    name: 'Hard Times and Oppression',
    text: 'Place 1 Regular Unit in each Village and 1 Elite Unit in both Carthag and Arrakeen Settlements.',
  },
  {
    id: 'forced_recruitment',
    deck: 'house_harkonnen',
    name: 'Forced Recruitment',
    text: 'Place 3 Elite Units and 1 Leader (Named or Bashar) in the Arrakeen Settlement.',
  },
  {
    id: 'beloved_feyd_rautha',
    deck: 'house_harkonnen',
    name: 'Beloved Feyd-Rautha',
    text: 'Feyd-Rautha enters play. Permanently remove Beast Rabban from play. Then, play 1 Planning card. If Feyd-Rautha is already in play: Place 2 Elite Units in the Legion containing Feyd-Rautha.',
  },
  {
    id: 'harkonnen_patrols',
    deck: 'house_harkonnen',
    name: 'Harkonnen Patrols',
    text: 'Place 3 Regular Units in empty Desert Areas of your choice (1 Unit per Area).',
  },
  {
    id: 'arsunt_legion',
    deck: 'house_harkonnen',
    name: 'Arsunt Legion',
    text: 'Place 1 Leader (Named or Bashar), 1 Elite Unit, and 1 Regular Unit in the Arsunt Settlement. Then, move or attack with the Legion in the Arsunt Settlement.',
  },
  {
    id: 'barons_personal_guard',
    deck: 'house_harkonnen',
    name: "Baron's Personal Guard",
    text: 'Place Baron Harkonnen and 2 Elite Units in the Carthag or Arrakeen Settlements. Then, move any Legion.',
  },
  {
    id: 'hawats_scheming',
    deck: 'house_harkonnen',
    name: "Hawat's Scheming",
    text: "This card may not be played or discarded in the usual way. As a free Action, discard 2 or 3 Hawat's Scheming cards to remove Thufir Hawat from the game. Then, Gaius Helen Mohiam enters play.",
    copies: 3,
  },
  {
    id: 'evidence_of_rebellion',
    deck: 'house_harkonnen',
    name: 'Evidence of Rebellion',
    text: 'Place 2 Elite Units in any Settlement. Then, draw 2 Planning cards.',
  },
  {
    id: 'polar_cap_factories',
    deck: 'house_harkonnen',
    name: 'Polar-Cap Factories',
    text: 'Place 2 Regular Units, 1 Elite Unit, and 1 Bashar Leader in the North Pole Settlement. Then, discard all Wormsigns in Areas adjacent to the North Pole Settlement.',
  },
  {
    id: 'carthag_the_former_capital',
    deck: 'house_harkonnen',
    name: 'Carthag, the Former Capital',
    text: 'Place 3 Regular Units, 1 Elite Unit, and 1 Leader (Named or Bashar) in the Carthag Settlement.',
  },
  {
    id: 'workhorse_of_arrakis',
    deck: 'house_harkonnen',
    name: 'Workhorse of Arrakis',
    text: 'Place 1 Harvester and 1 Carryall on the board. Then, draw 2 Planning cards.',
  },
  {
    id: 'spotter_control',
    deck: 'house_harkonnen',
    name: 'Spotter Control',
    text: 'Discard 3 Wormsigns of your choice. Then, draw 2 Planning cards.',
  },
  {
    id: 'explosive_artillery',
    deck: 'house_harkonnen',
    name: 'Explosive Artillery',
    text: 'Move any Legion. Then, make the following special attack against an enemy Legion of your choice that is adjacent to one of your Legions: Roll 4 Combat dice and score 1 Hit for each sword and special result.',
  },
  {
    id: 'sandmasters',
    deck: 'house_harkonnen',
    name: 'Sandmasters',
    text: 'Place 3 Harkonnen Harvesters on the board. Then, draw 1 Planning card.',
  },
  {
    id: 'mudir_nahya_the_demon_ruler',
    deck: 'house_harkonnen',
    name: 'Mudir-Nahya, the Demon Ruler',
    text: 'Place Beast Rabban and 1 Elite Unit in any Legion. Then, make a Surprise Attack with this Legion. If Rabban has been removed from play: Place 1 Leader (Named or Bashar) and 2 Elite Units in any Legion.',
  },
  {
    id: 'hunter_seeker',
    deck: 'house_harkonnen',
    name: 'Hunter-Seeker',
    text: 'Choose 1 enemy Named Leader that is in an Area in the same Sector as a Harkonnen Legion. Place that Leader in the Regeneration Tank.',
  },
];

export const CORRINO_ALLY_CARDS: readonly PlanningCardDef[] = [
  {
    id: 'rage_overcame_shaddam_iv_a',
    deck: 'corrino_ally',
    name: 'Rage Overcame Shaddam IV',
    text: 'Emperor Shaddam IV enters play. Then, play 1 Planning card. If the Emperor is already in play: Place Emperor Shaddam IV and 4 Regular Units in a Harkonnen Settlement of your choice.',
  },
  {
    id: 'rage_overcame_shaddam_iv_b',
    deck: 'corrino_ally',
    name: 'Rage Overcame Shaddam IV',
    text: 'Emperor Shaddam IV enters play. Then, play 1 Planning card. If the Emperor is already in play: Place Emperor Shaddam IV and 2 Sardaukar Units in any Legion.',
  },
  {
    id: 'rage_overcame_shaddam_iv_c',
    deck: 'corrino_ally',
    name: 'Rage Overcame Shaddam IV',
    text: 'Emperor Shaddam IV enters play. Then, play 1 Planning card. If the Emperor is already in play: Place Emperor Shaddam IV in a Legion containing a Sardaukar. Then, move and make a Surprise Attack with this Legion.',
  },
  {
    id: 'manipulation_of_others',
    deck: 'corrino_ally',
    name: 'Manipulation of Others',
    text: 'Force your opponent to discard 2 Planning cards of their choice. Then, draw 2 Planning cards.',
  },
  {
    id: 'breeding_program',
    deck: 'corrino_ally',
    name: 'Breeding Program',
    text: 'Take 1 Bene Gesserit token from the reserve. Then, play 1 Planning card.',
  },
  {
    id: 'troop_carriers',
    deck: 'corrino_ally',
    name: 'Troop Carriers',
    text: 'Move a Legion from a Settlement directly to an Area containing one of your Legions.',
  },
  {
    id: 'shigawire',
    deck: 'corrino_ally',
    name: 'Shigawire',
    text: 'Move a Legion containing a Sardaukar. Then, choose 1 enemy Named Leader that is in an Area adjacent to this Legion and place them in the Regeneration Tank.',
  },
  {
    id: 'hope_clouds_observation',
    deck: 'corrino_ally',
    name: 'Hope Clouds Observation',
    text: 'Shuffle 1 revealed Prescience card of your choice back into the deck.',
  },
  {
    id: 'reports_of_traitors',
    deck: 'corrino_ally',
    name: 'Reports of Traitors',
    text: "Discard 1 of your opponent's unused Action dice with a House result.",
  },
  {
    id: 'sardaukar_pogrom',
    deck: 'corrino_ally',
    name: 'Sardaukar Pogrom',
    text: 'Move 3 Legions containing a Sardaukar.',
  },
  {
    id: 'sardaukars_manner',
    deck: 'corrino_ally',
    name: "Sardaukar's Manner",
    text: 'Move or make a Surprise Attack with a Legion containing a Sardaukar.',
  },
  {
    id: 'spies_all_over_arrakis',
    deck: 'corrino_ally',
    name: 'Spies All Over Arrakis',
    text: 'Reveal any Sietch and all Deployment tokens in an Area of your choice. Then, draw 2 Planning cards.',
  },
  {
    id: 'full_control_of_the_air',
    deck: 'corrino_ally',
    name: 'Full Control of the Air',
    text: 'Place 2 Ornithopters on the board. Then, move a Legion of your choice.',
  },
  {
    id: 'moving_the_battle_group',
    deck: 'corrino_ally',
    name: 'Moving the Battle Group',
    text: 'Place 1 Bashar Leader and 2 Elite Units in a free Mountain Area of your choice.',
  },
  {
    id: 'killers_without_mercy',
    deck: 'corrino_ally',
    name: 'Killers Without Mercy',
    text: 'Attack with a Legion containing a Sardaukar. At the end of each battle round, you may continue the battle without taking 1 Hit, even if the defending Legion is in a Sietch.',
  },
  {
    id: 'sardaukar_disguised',
    deck: 'corrino_ally',
    name: 'Sardaukar Disguised',
    text: 'Replace 2 Elite Units on the board with 2 Sardaukar Units. Then, move 2 Legions each containing a Sardaukar.',
  },
  {
    id: 'i_decide_what_best_serves_his_majesty',
    deck: 'corrino_ally',
    name: '"I Decide What Best Serves His Majesty"',
    text: 'Place Captain Aramsham in a Legion containing a Sardaukar. Then, move or make a Surprise Attack with this Legion.',
  },
  {
    id: 'seek_out_the_mahdi',
    deck: 'corrino_ally',
    name: "Seek Out the 'Mahdi'",
    text: 'Move a Legion of your choice. In their next Action turn, your opponent cannot place or deploy Paul on the board, nor move or attack with a Legion containing him.',
  },
];

/** All Harkonnen-side planning cards (both decks). */
export const HARKONNEN_PLANNING_CARDS: readonly PlanningCardDef[] = [
  ...HOUSE_HARKONNEN_CARDS,
  ...CORRINO_ALLY_CARDS,
];

/** Total physical cards in a deck (counting copies). */
export function deckSize(cards: readonly PlanningCardDef[]): number {
  return cards.reduce((n, c) => n + (c.copies ?? 1), 0);
}

export function cardById(id: string): PlanningCardDef | undefined {
  return HARKONNEN_PLANNING_CARDS.find((c) => c.id === id);
}
