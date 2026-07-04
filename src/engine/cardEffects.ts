// Planning-card effect resolution (Mahdi solo, Harkonnen decks).
//
// Turns each card's printed text into ordered, structured play STEPS the player executes on the
// board, auto-applying only the unambiguous mechanical ones (see effectSteps.ts). Card DATA lives
// in planningCards.ts; this module encodes each card's effect as a step list.

import type { GameState } from "./state";
import { cardById } from "./planningCards";
import {
  type EffectStep,
  type EffectResolution,
  placeUnits,
  placeOneEach,
  placeVehicles,
  draw,
  manual,
} from "./effectSteps";

export type {
  EffectStep as CardStep,
  EffectResolution as CardResolution,
} from "./effectSteps";
export { applyEffectSteps as applyCardSteps } from "./effectSteps";

// Settlement / village area ids (fixed board data).
const ARRAKEEN = "arrakeen";
const CARTHAG = "carthag";
const NORTH_POLE = "north_pole";
const VILLAGES = ["arsunt", "hagga_basin", "imperial_basin", "north_pole"];

type StepFn = (s: GameState) => EffectStep;

const CARD_STEPS: Record<string, StepFn[]> = {
  // --- House Harkonnen deck ---
  hard_times_and_oppression: [
    () => placeOneEach("regular", VILLAGES, "each Village"),
    () =>
      placeOneEach("elite", [CARTHAG, ARRAKEEN], "both Carthag and Arrakeen"),
  ],
  forced_recruitment: [
    () => placeUnits({ elite: 3 }, ARRAKEEN),
    () =>
      manual("Place 1 Leader (Named or Bashar) in the Arrakeen Settlement."),
  ],
  beloved_feyd_rautha: [
    () =>
      manual(
        "Feyd-Rautha enters play; permanently remove Beast Rabban from play. Then play 1 Planning card. (If Feyd-Rautha is already in play instead: place 2 Elite Units in his Legion.)",
      ),
  ],
  harkonnen_patrols: [
    () =>
      manual(
        "Place 3 Regular Units in empty Desert Areas of your choice (1 per Area).",
      ),
  ],
  arsunt_legion: [
    () => placeUnits({ elite: 1, regular: 1 }, "arsunt"),
    () => manual("Place 1 Leader (Named or Bashar) in the Arsunt Settlement."),
    () =>
      manual("Then move or attack with the Legion in the Arsunt Settlement."),
  ],
  barons_personal_guard: [
    () => placeUnits({ elite: 2 }, CARTHAG),
    () =>
      manual(
        "Place Baron Harkonnen in the Carthag or Arrakeen Settlement (with the 2 Elite Units above).",
      ),
    () => manual("Then move any Legion."),
  ],
  hawats_scheming: [
    () =>
      manual(
        "Free action: discard 2 or 3 Hawat's Scheming cards to remove Thufir Hawat from the game; then Gaius Helen Mohiam enters play. (Not played/discarded the usual way.)",
      ),
  ],
  evidence_of_rebellion: [
    () => manual("Place 2 Elite Units in any Settlement of your choice."),
    () => draw("house_harkonnen", 2),
  ],
  polar_cap_factories: [
    () => placeUnits({ regular: 2, elite: 1 }, NORTH_POLE),
    () => manual("Place 1 Bashar Leader in the North Pole Settlement."),
    () =>
      manual(
        "Then discard all Wormsigns in Areas adjacent to the North Pole Settlement.",
      ),
  ],
  carthag_the_former_capital: [
    () => placeUnits({ regular: 3, elite: 1 }, CARTHAG),
    () => manual("Place 1 Leader (Named or Bashar) in the Carthag Settlement."),
  ],
  workhorse_of_arrakis: [
    (s) => placeVehicles(s, { harvester: 1, carryall: 1 }),
    () => draw("house_harkonnen", 2),
  ],
  spotter_control: [
    () => manual("Discard 3 Wormsigns of your choice."),
    () => draw("house_harkonnen", 2),
  ],
  explosive_artillery: [
    () => manual("Move any Legion."),
    () =>
      manual(
        "Then make a special attack against an adjacent enemy Legion: roll 4 Combat dice, 1 Hit per sword and special result.",
      ),
  ],
  sandmasters: [
    (s) => placeVehicles(s, { harvester: 3 }),
    () => draw("house_harkonnen", 1),
  ],
  mudir_nahya_the_demon_ruler: [
    () =>
      manual(
        "Place Beast Rabban and 1 Elite Unit in any Legion, then make a Surprise Attack with it. (If Rabban is removed instead: place 1 Leader and 2 Elite Units in any Legion.)",
      ),
  ],
  hunter_seeker: [
    () =>
      manual(
        "Choose 1 enemy Named Leader in the same Sector as a Harkonnen Legion and place that Leader in the Regeneration Tank.",
      ),
  ],

  // --- Corrino Ally deck ---
  rage_overcame_shaddam_iv_a: [
    () =>
      manual(
        "Emperor Shaddam IV enters play, then play 1 Planning card. (If already in play instead: place Emperor Shaddam IV and 4 Regular Units in a Harkonnen Settlement of your choice.)",
      ),
  ],
  rage_overcame_shaddam_iv_b: [
    () =>
      manual(
        "Emperor Shaddam IV enters play, then play 1 Planning card. (If already in play instead: place Emperor Shaddam IV and 2 Sardaukar Units in any Legion.)",
      ),
  ],
  rage_overcame_shaddam_iv_c: [
    () =>
      manual(
        "Emperor Shaddam IV enters play, then play 1 Planning card. (If already in play instead: place him in a Legion containing a Sardaukar, then move and make a Surprise Attack with it.)",
      ),
  ],
  manipulation_of_others: [
    () =>
      manual(
        "Force your opponent to discard 2 Planning cards of their choice.",
      ),
    () => draw("corrino_ally", 2),
  ],
  breeding_program: [
    () => manual("Take 1 Bene Gesserit token from the reserve."),
    () => manual("Then play 1 Planning card."),
  ],
  troop_carriers: [
    () =>
      manual(
        "Move a Legion from a Settlement directly to an Area containing one of your Legions.",
      ),
  ],
  shigawire: [
    () =>
      manual(
        "Move a Legion containing a Sardaukar. A facedown Deployment token may hide one — the card " +
          "effect lets you flip a token to check (tap the area → Reveal tokens; the units come out, " +
          "the marker returns to the pool). If no Legion contains a Sardaukar, this part does nothing.",
      ),
    () =>
      manual(
        "Then place an enemy Named Leader adjacent to that Legion in the Regeneration Tank.",
      ),
  ],
  hope_clouds_observation: [
    () =>
      manual(
        "Shuffle 1 revealed Prescience card of your choice back into the deck.",
      ),
  ],
  reports_of_traitors: [
    () =>
      manual(
        "Discard 1 of your opponent's unused Action dice showing a House result.",
      ),
  ],
  sardaukar_pogrom: [
    () =>
      manual(
        "Move 3 Legions each containing a Sardaukar. Facedown tokens may hide them — flip tokens to " +
          "check (tap the area → Reveal tokens). Legions without a Sardaukar don't move.",
      ),
  ],
  sardaukars_manner: [
    () =>
      manual(
        "Move or make a Surprise Attack with a Legion containing a Sardaukar (a facedown token may " +
          "hide one — tap the area → Reveal tokens to flip it).",
      ),
  ],
  spies_all_over_arrakis: [
    () =>
      manual(
        "Reveal any Sietch and all Deployment tokens in an Area of your choice.",
      ),
    () => draw("corrino_ally", 2),
  ],
  full_control_of_the_air: [
    (s) => placeVehicles(s, { ornithopter: 2 }),
    () => manual("Then move a Legion of your choice."),
  ],
  moving_the_battle_group: [
    () =>
      manual(
        "Place 1 Bashar Leader and 2 Elite Units in a free Mountain Area of your choice.",
      ),
  ],
  killers_without_mercy: [
    () =>
      manual(
        "Attack with a Legion containing a Sardaukar. Each battle round, you may continue the battle without taking 1 Hit, even against a Sietch.",
      ),
  ],
  sardaukar_disguised: [
    () => manual("Replace 2 Elite Units on the board with 2 Sardaukar Units."),
    () => manual("Then move 2 Legions each containing a Sardaukar."),
  ],
  i_decide_what_best_serves_his_majesty: [
    () =>
      manual(
        "Place Captain Aramsham in a Legion containing a Sardaukar, then move or make a Surprise Attack with it.",
      ),
  ],
  seek_out_the_mahdi: [
    () =>
      manual(
        "Move a Legion of your choice. Next Action turn, your opponent cannot place/deploy Paul, nor move/attack with a Legion containing him.",
      ),
  ],
};

/**
 * Resolve a Harkonnen planning card into ordered play steps for the given state.
 * Returns null for an unknown id. Cards without an encoding fall back to a single
 * manual step carrying the printed text.
 */
export function resolveCardPlay(
  id: string,
  s: GameState,
): EffectResolution | null {
  const card = cardById(id);
  if (!card) return null;
  const fns = CARD_STEPS[id];
  const steps = fns ? fns.map((fn) => fn(s)) : [manual(card.text)];
  return { id, name: card.name, steps };
}

/** Which card ids have a structured (non-fallback) step encoding. */
export function hasCardEncoding(id: string): boolean {
  return id in CARD_STEPS;
}
