// A fresh Mahdi-solo starting position, per the rulebook setup (2-player setup, p14, + the solo
// overrides, p37). Fixed locations (settlements / sietches / testing stations) are derived from
// board.ts so this never drifts from the board data.
//
// Setup facts encoded here:
//  • 6 Harkonnen Settlements on their fixed areas (Arrakeen 3, Carthag 2, 4 Pyon Villages 1).
//  • 8 Sietches on their fixed areas, rank hidden (placed facedown; only Atreides may inspect).
//  • Each Sietch area holds 1 Atreides legion: 1 Deployment token + 1 Naib (generic) leader.
//  • The 3 Imperium markers start on the TOP step (best for the Harkonnen → 8 action dice).
//  • Supremacy & Prescience tracks at 0. Wormsign pool 16, Tactical deck 8.
//  • Solo: the two sets of Harkonnen Starting Deployment tokens (12) form the reserve POOL — they
//    are dropped 2-at-a-time when a Harkonnen legion leaves a Settlement, so the settlements start
//    with no figures and the Harkonnen build out via Deployment actions.
//  • Named leaders "in play at the start" (Beast Rabban, Baron Harkonnen, Captain Aramsham) are set
//    aside as available-to-deploy (reserve), not pre-placed on the map.

import { AREA_IDS, AREAS } from './board';
import { NAMED_LEADERS } from './leaders';
import { deckSize, HOUSE_HARKONNEN_CARDS, CORRINO_ALLY_CARDS } from './planningCards';
import { emptyLegion, type GameState, type Legion } from './state';

export function newGameState(): GameState {
  const settlementAreas = AREA_IDS.filter((id) => AREAS[id].settlement != null);
  const sietchAreas = AREA_IDS.filter((id) => AREAS[id].sietch);
  const stationAreas = AREA_IDS.filter((id) => AREAS[id].testingStation);
  const startLeaders = NAMED_LEADERS.filter((l) => l.entry.kind === 'start').map((l) => l.name);

  // One Atreides legion per sietch: 1 facedown deployment token + 1 Naib (generic) leader.
  const atreidesLegions: Legion[] = sietchAreas.map((area) => ({
    ...emptyLegion('atreides', area),
    deploymentTokens: 1,
    leaders: [{ kind: 'generic', faction: 'atreides' }],
  }));

  return {
    round: 1,
    phase: 'start',

    settlements: settlementAreas.map((area) => ({
      area,
      rank: AREAS[area].settlement as 1 | 2 | 3,
      destroyed: false,
    })),
    sietches: sietchAreas.map((area) => ({ area, rank: null, revealed: false, destroyed: false })),
    testingStations: stationAreas.map((area) => ({ area, revealed: false })),

    legions: atreidesLegions, // Harkonnen settlements start with no figures (deployment-token pool)
    vehicles: [],
    wormsigns: [],
    sandworms: [],

    harvestingSector: null, // drawn from the Tactical deck at the start of round 1
    targetSietchId: null,

    spice: { markers: { choam: 1, spacing_guild: 1, landsraad: 1 }, activeBans: [], spiceReserve: 0 },
    tracks: { supremacy: 0, prescience: [0, 0, 0] },
    decks: {
      planning: {
        house_atreides: 18,
        fremen_ally: 18,
        house_harkonnen: deckSize(HOUSE_HARKONNEN_CARDS),
        corrino_ally: deckSize(CORRINO_ALLY_CARDS),
      },
      planningDiscard: { house_atreides: 0, fremen_ally: 0, house_harkonnen: 0, corrino_ally: 0 },
      prescienceDeck: 18,
      reinforcements: 0,
      wormsignPool: 16,
      tacticalDeck: 8,
    },

    harkonnenReserve: {
      units: { regular: 16, elite: 8, special_elite: 8 },
      deploymentTokens: 12, // the two sets of Harkonnen Starting Deployment tokens (the solo pool)
      bashars: 2,
      namedLeaders: startLeaders,
    },

    beneGesserit: { atreides: 0, reserve: 5 },

    harkonnenUnusedDice: 0,
    atreidesUnusedDice: 0,
  };
}
