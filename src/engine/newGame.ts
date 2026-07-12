// A fresh Mahdi-solo starting position, per the rulebook setup (2-player setup, p14, + the solo
// overrides, p37). Fixed locations (settlements / sietches / testing stations) are derived from
// board.ts so this never drifts from the board data.
//
// Setup facts encoded here:
//  • 6 Harkonnen Settlements on their fixed areas (Arrakeen 3, Carthag 2, 4 Pyon Villages 1).
//  • 8 Sietches on their fixed areas, rank hidden (placed facedown; only Atreides may inspect).
//  • Each Sietch area holds 1 Atreides legion: 1 Deployment token + 1 Naib (generic) leader.
//  • Each Harkonnen Settlement holds 1 legion of 2 facedown Starting Deployment tokens (1 of each
//    type), per the 2-player setup (rulebook p14 step 6) that solo inherits (p37: "set up the game
//    as in a 2-player game"). Their unit composition is hidden until revealed, so they're modeled
//    as deployment tokens (combat power 2, counting as 1 unit each), not specific figures.
//  • The 3 Imperium markers start on the TOP step (best for the Harkonnen → 8 action dice).
//  • Supremacy & Prescience tracks at 0. Wormsign pool 16, Tactical deck 8.
//  • Solo: the two sets of Harkonnen Starting Deployment tokens (12) ARE those on-board garrisons
//    (2 per settlement), so the replenishment pool (rulebook p42) starts empty and refills only as
//    tokens are freed (revealed in battle). Leaving a settlement drops 2 tokens only when the pool
//    has some — this keeps the 12 tokens conserved (no duplication when a garrison marches out).
//  • Named leaders "in play at the start" (Beast Rabban, Baron Harkonnen, Captain Aramsham) are set
//    aside as available-to-deploy (reserve), not pre-placed on the map.

import { AREA_IDS, AREAS } from "./board";
import { NAMED_LEADERS } from "./leaders";
import {
  deckSize,
  HOUSE_HARKONNEN_CARDS,
  CORRINO_ALLY_CARDS,
} from "./planningCards";
import { emptyLegion, type GameState, type Legion } from "./state";

export function newGameState(): GameState {
  const settlementAreas = AREA_IDS.filter((id) => AREAS[id].settlement != null);
  const sietchAreas = AREA_IDS.filter((id) => AREAS[id].sietch);
  const stationAreas = AREA_IDS.filter((id) => AREAS[id].testingStation);
  const startLeaders = NAMED_LEADERS.filter(
    (l) => l.entry.kind === "start",
  ).map((l) => l.name);

  // One Atreides legion per sietch: 1 facedown deployment token + 1 Naib (generic) leader.
  const atreidesLegions: Legion[] = sietchAreas.map((area) => ({
    ...emptyLegion("atreides", area),
    deploymentTokens: 1,
    leaders: [{ kind: "generic", faction: "atreides" }],
  }));

  // One Harkonnen legion per settlement: 2 facedown Starting Deployment tokens (1 of each type).
  const harkonnenLegions: Legion[] = settlementAreas.map((area) => ({
    ...emptyLegion("harkonnen", area),
    deploymentTokens: 2,
  }));

  return {
    round: 1,
    phase: "start",

    settlements: settlementAreas.map((area) => ({
      area,
      rank: AREAS[area].settlement as 1 | 2 | 3,
      destroyed: false,
    })),
    sietches: sietchAreas.map((area) => ({
      area,
      rank: null,
      revealed: false,
      destroyed: false,
    })),
    testingStations: stationAreas.map((area) => ({ area, revealed: false })),

    legions: [...harkonnenLegions, ...atreidesLegions],
    vehicles: [],
    wormsigns: [],
    sandworms: [],

    harvestingSector: null, // drawn from the Tactical deck at the start of round 1
    targetSietchId: null,

    spice: {
      markers: { choam: 1, spacing_guild: 1, landsraad: 1 },
      activeBans: [],
      spiceReserve: 0,
    },
    tracks: { supremacy: 0, prescience: [0, 0, 0] },
    decks: {
      planning: {
        house_atreides: 18,
        fremen_ally: 18,
        // Solo setup: 1 card from each Harkonnen deck seeds the reinforcements deck facedown.
        house_harkonnen: deckSize(HOUSE_HARKONNEN_CARDS) - 1,
        corrino_ally: deckSize(CORRINO_ALLY_CARDS) - 1,
      },
      planningDiscard: {
        house_atreides: 0,
        fremen_ally: 0,
        house_harkonnen: 0,
        corrino_ally: 0,
      },
      prescienceDeck: 18,
      reinforcements: 2,
      wormsignPool: 16,
      tacticalDeck: 8,
    },

    harkonnenReserve: {
      units: { regular: 16, elite: 8, special_elite: 8 },
      deploymentTokens: 0, // pool starts empty — all 12 tokens are the on-board starting garrisons (2/settlement); refills as tokens are revealed in battle
      bashars: 2,
      namedLeaders: startLeaders,
      regenerationTank: [],
    },

    beneGesserit: { atreides: 0, reserve: 5 },

    atreidesObjective: null,

    harkonnenUnusedDice: 0,
    atreidesUnusedDice: 0,
  };
}
