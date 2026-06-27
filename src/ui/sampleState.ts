// A plausible mid-game GameState used to drive the UI scaffold before a full board-state editor
// exists. Lets every action-die result produce a meaningful Harkonnen directive.

import type { GameState, Legion, Leader } from '../engine/state';
import { emptyLegion } from '../engine/state';

function legion(
  faction: Legion['faction'],
  area: string,
  units: Partial<Legion['units']>,
  leaders: Leader[] = [],
): Legion {
  return {
    ...emptyLegion(faction, area),
    units: { regular: 0, elite: 0, special_elite: 0, ...units },
    leaders,
  };
}

export function sampleState(): GameState {
  return {
    round: 3,
    phase: 'action_resolution',
    settlements: [
      { area: 'arrakeen', rank: 3, destroyed: false },
      { area: 'carthag', rank: 2, destroyed: false },
      { area: 'arsunt', rank: 1, destroyed: false },
      { area: 'hagga_basin', rank: 1, destroyed: false },
      { area: 'imperial_basin', rank: 1, destroyed: false },
      { area: 'north_pole', rank: 1, destroyed: false },
    ],
    sietches: [
      { area: 'gara_kulon', rank: 2, revealed: false, destroyed: false },
      { area: 'habbanya_ridge', rank: 1, revealed: false, destroyed: false },
      { area: 'sihaya_ridge', rank: 3, revealed: false, destroyed: false },
    ],
    testingStations: [],
    legions: [
      // Harkonnen legion adjacent to the target sietch, led by Beast Rabban.
      legion('harkonnen', 's1_11', { regular: 3, elite: 1 }, [
        { kind: 'named', faction: 'harkonnen', name: 'Beast Rabban' },
      ]),
      // A second Harkonnen legion back in Carthag.
      legion('harkonnen', 'carthag', { regular: 2 }, [{ kind: 'generic', faction: 'harkonnen' }]),
      // A weak Atreides legion defending the target sietch.
      legion('atreides', 'gara_kulon', { regular: 1 }, [{ kind: 'generic', faction: 'atreides' }]),
    ],
    vehicles: [],
    wormsigns: [],
    sandworms: [],
    harvestingSector: 's3',
    targetSietchId: 'gara_kulon',
    spice: { markers: { choam: 2, spacing_guild: 3, landsraad: 2 }, activeBans: [], spiceReserve: 0 },
    tracks: { supremacy: 3, prescience: [1, 0, 0] },
    decks: {
      planning: { house_atreides: 12, fremen_ally: 12, house_harkonnen: 16, corrino_ally: 16 },
      planningDiscard: { house_atreides: 0, fremen_ally: 0, house_harkonnen: 0, corrino_ally: 0 },
      prescienceDeck: 14,
      reinforcements: 2,
      wormsignPool: 16,
      tacticalDeck: 8,
    },
    harkonnenReserve: {
      units: { regular: 10, elite: 6, special_elite: 6 },
      deploymentTokens: 8,
      bashars: 2,
      namedLeaders: ['Feyd-Rautha'],
    },
    beneGesserit: { atreides: 1, reserve: 4 },
    harkonnenUnusedDice: 4,
    atreidesUnusedDice: 2,
  };
}
