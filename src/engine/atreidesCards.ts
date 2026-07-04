// Atreides-side planning-card catalog (House Atreides + Fremen Ally decks), captured from the
// physical cards (docs/images/20260704_09*.jpg). Card DATA only: the player resolves their own
// cards on the board — the app never automates the Atreides side (PRD scope). Surfaced as an
// in-app reference and exercised by playtests.
//
// Deck facts: 36 cards — 18 House Atreides (Smugglers ×3, each with a different follow-up when
// Gurney is already in play) and 18 Fremen Ally (Shai-Hulud ×3 identical copies).

import type { PlanningCardDef } from './planningCards';

export const HOUSE_ATREIDES_CARDS: readonly PlanningCardDef[] = [
  {
    id: 'war_plan',
    deck: 'house_atreides',
    name: 'War Plan',
    text: 'Move or attack with any Legion. If a battle starts, gain 1 Combat die during each battle round.',
  },
  {
    id: 'alia_the_abomination',
    deck: 'house_atreides',
    name: 'Alia, the Abomination',
    text: 'If Reverend Mother Jessica is in play, Alia enters play. Then, play 1 Planning card. If Alia is already in play: Place 1 enemy Named Leader of your choice in the Regeneration Tank. Then, draw 2 Planning cards.',
  },
  {
    id: 'smugglers_a',
    deck: 'house_atreides',
    name: 'Smugglers',
    text: 'Gurney Halleck enters play. Place him and 2 Elite Units in any empty Desert Area. If Gurney is already in play: Place 2 Wormsigns. Then, move the Legion containing Gurney Halleck.',
  },
  {
    id: 'smugglers_b',
    deck: 'house_atreides',
    name: 'Smugglers',
    text: 'Gurney Halleck enters play. Place him and 2 Elite Units in any empty Desert Area. If Gurney is already in play: Place 2 Elite Units in the Legion containing Gurney Halleck.',
  },
  {
    id: 'smugglers_c',
    deck: 'house_atreides',
    name: 'Smugglers',
    text: 'Gurney Halleck enters play. Place him and 2 Elite Units in any empty Desert Area. If Gurney is already in play: Remove 2 Harkonnen Vehicles from the same Sector as Gurney Halleck.',
  },
  {
    id: 'the_voice',
    deck: 'house_atreides',
    name: 'The Voice',
    text: 'Force your opponent to discard 1 Planning card of their choice. Then, play 1 Planning card.',
  },
  {
    id: 'death_commandos',
    deck: 'house_atreides',
    name: 'Death Commandos',
    text: 'Replace 2 Elite Units on the board with 2 Fedaykin Units. Then, move 2 Legions, each containing a Fedaykin.',
  },
  {
    id: 'tested_with_the_gom_jabbar',
    deck: 'house_atreides',
    name: 'Tested with the Gom Jabbar',
    text: 'Draw a second Secret Objective card. You win the game by completing either of the 2 Secret Objective cards. Then, draw 2 Planning cards.',
  },
  {
    id: 'chatt_the_leaper',
    deck: 'house_atreides',
    name: 'Chatt the Leaper',
    text: 'Place 2 Fedaykin Units and 1 Naib Leader in a Sietch of your choice.',
  },
  {
    id: 'truthtrance',
    deck: 'house_atreides',
    name: 'Truthtrance',
    text: 'Choose 1 unused opponent Action die. On the next turn, the Harkonnen player must use that die. Then, draw 2 Planning cards or play 1 Planning card.',
  },
  {
    id: 'adab_the_demanding_memory',
    deck: 'house_atreides',
    name: 'Adab, the Demanding Memory',
    text: 'Permanently discard any number of revealed Prescience cards and replace them with the same number of cards drawn from the deck. Then, play 1 Planning card.',
  },
  {
    id: 'alam_al_mithal',
    deck: 'house_atreides',
    name: 'Alam al-Mithal, the World of Similitudes',
    text: 'Decrease 1 Prescience marker of your choice by any number of steps and increase another Prescience marker of your choice by the same number of steps. Then, draw 2 Planning cards.',
  },
  {
    id: 'usul_the_base_of_the_pillar',
    deck: 'house_atreides',
    name: 'Usul, the Base of the Pillar',
    text: 'Take a Desert Power Action. Then, play 1 Planning card.',
  },
  {
    id: 'voice_from_the_outer_world',
    deck: 'house_atreides',
    name: 'Voice from the Outer World',
    text: 'Place Paul and 1 Fedaykin Unit in any Legion. Then, move or make a Surprise Attack with this Legion.',
  },
  {
    id: 'our_family_atomics',
    deck: 'house_atreides',
    name: 'Our Family Atomics',
    text: 'Atomics immediately detonate if any marker is at step 4+ of the Prescience track. Then, play 1 Planning card. If Atomics have already been detonated: Take 2 consecutive Desert Power Actions.',
  },
  {
    id: 'battle_language',
    deck: 'house_atreides',
    name: 'Battle Language',
    text: 'Move or make a Surprise Attack with a Legion with a Leader. If a battle starts, in the first round, your opponent cannot roll more than 4 Combat dice.',
  },
  {
    id: 'bill_of_particulars',
    deck: 'house_atreides',
    name: 'Bill of Particulars',
    text: "Move 1 Imperium marker of your choice 1 step down (don't activate the corresponding Ban). Then, play 1 Planning card.",
  },
  {
    id: 'fear_is_the_mind_killer',
    deck: 'house_atreides',
    name: 'Fear Is the Mind-Killer',
    text: 'Attach this card to any revealed Prescience card. If the Prescience card is claimed, additionally advance any Prescience marker by 2 steps. Discard this card at the End of the Round.',
  },
];

export const FREMEN_ALLY_CARDS: readonly PlanningCardDef[] = [
  {
    id: 'shai_hulud',
    deck: 'fremen_ally',
    name: 'Shai-Hulud',
    text: 'Wild Maker enters play, spent. Place its figure in an empty Desert Area of your choice. If Wild Maker is already in play: Move and attack with the Wild Maker.',
    copies: 3,
  },
  {
    id: 'wall_of_sandworms',
    deck: 'fremen_ally',
    name: 'Wall of Sandworms',
    text: 'Place 1 Sandworm in an empty Desert Area adjacent to another Sandworm. Then, take a Desert Power Action.',
  },
  {
    id: 'dust_chasms',
    deck: 'fremen_ally',
    name: 'Dust Chasms',
    text: 'Remove 2 Harvesters from Deep Desert Areas of your choice within the same Sector. Then, take a Desert Power Action.',
  },
  {
    id: 'fremen_rockets',
    deck: 'fremen_ally',
    name: 'Fremen Rockets',
    text: 'Choose a Sector containing any of your Legions. Then, roll 3 Combat dice: Remove 1 Harkonnen Vehicle of your choice from that Sector or in a connected Air Zone for each Sword and Special result.',
  },
  {
    id: 'eyes_of_ibad',
    deck: 'fremen_ally',
    name: 'Eyes of Ibad',
    text: 'Attach this card to any revealed Prescience card. This Prescience card cannot be discarded in any way and remains revealed and in play for the rest of the game (in addition to the usual ones), until it is eventually claimed.',
  },
  {
    id: 'captured_ornithopter',
    deck: 'fremen_ally',
    name: 'Captured Ornithopter',
    text: 'Remove 1 Harkonnen Ornithopter from the board to make the following special attack against a Legion in a connected Sector: Roll 3 Combat dice and score 1 Hit for every Sword and Special result.',
  },
  {
    id: 'crysknife',
    deck: 'fremen_ally',
    name: 'Crysknife',
    text: 'Move a Legion containing a Fedaykin. Then, choose 1 enemy Named Leader that is in an Area adjacent to this Legion and place them in the Regeneration Tank.',
  },
  {
    id: 'cielagos_piping_message',
    deck: 'fremen_ally',
    name: "Cielago's Piping Message",
    text: 'If a Harkonnen Legion is within 2 Areas of a Sietch, place 1 Deployment token in that Sietch. Then, draw 1 Planning card.',
  },
  {
    id: 'jubba_cloaks',
    deck: 'fremen_ally',
    name: 'Jubba Cloaks',
    text: 'Move a Legion with a Leader (Naib or Named) of your choice that is in a Desert Area. Then, play 1 Planning card.',
  },
  {
    id: 'hieregs',
    deck: 'fremen_ally',
    name: 'Hieregs',
    text: 'Place 2 Regular Units on the board, each in an empty Desert Area of your choice. Then, take a Desert Power Action.',
  },
  {
    id: 'grandmother_of_a_storm',
    deck: 'fremen_ally',
    name: 'Grandmother of a Storm',
    text: 'Roll for Coriolis Storms following the regular rules.',
  },
  {
    id: 'stillsuits',
    deck: 'fremen_ally',
    name: 'Stillsuits',
    text: 'Move any Legion that is in a Desert Area. Then, swap the position of all Deployment tokens between 2 different Sietches (even if a Sietch has none).',
  },
  {
    id: 'i_am_stilgar_the_fremen',
    deck: 'fremen_ally',
    name: '"I Am Stilgar, the Fremen"',
    text: 'Place Stilgar, 2 Elite Units, and 1 Regular Unit in any free Plateau Area. Then, draw 1 Planning card.',
  },
  {
    id: 'thumpers',
    deck: 'fremen_ally',
    name: 'Thumpers',
    text: 'Place 2 Sandworms in empty Desert Areas of your choice that are adjacent to Areas containing Atreides Legions.',
  },
  {
    id: 'kitab_al_ibar',
    deck: 'fremen_ally',
    name: 'Kitab al-Ibar',
    text: 'Move a Sietch and any number of figures and tokens in the same Area to an adjacent empty Desert Area.',
  },
  {
    id: 'sandtides',
    deck: 'fremen_ally',
    name: 'Sandtides',
    text: 'Move an enemy Legion that is in a Desert Area to any empty adjacent Area. Then, take a Desert Power Action.',
  },
];

/** Every Atreides-side planning card (House Atreides + Fremen Ally). */
export const ATREIDES_PLANNING_CARDS: readonly PlanningCardDef[] = [
  ...HOUSE_ATREIDES_CARDS,
  ...FREMEN_ALLY_CARDS,
];

/** Total physical cards in the combined deck (counting copies). */
export function atreidesDeckSize(): number {
  return ATREIDES_PLANNING_CARDS.reduce((n, c) => n + (c.copies ?? 1), 0);
}
