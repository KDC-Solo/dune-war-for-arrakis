import { describe, it, expect } from "vitest";
import { legalMoveDestinations, standardNeighbors } from "./moveTargets";
import { harkonnenNeighbors } from "./movement";
import { emptyLegion, type GameState, type Legion } from "./state";

function gs(over: Partial<GameState> = {}): GameState {
  return {
    round: 1,
    phase: "action_resolution",
    settlements: [],
    sietches: [],
    testingStations: [],
    legions: [],
    vehicles: [],
    wormsigns: [],
    sandworms: [],
    harvestingSector: null,
    targetSietchId: null,
    spice: {
      markers: { choam: 1, spacing_guild: 1, landsraad: 1 },
      activeBans: [],
      spiceReserve: 0,
    },
    tracks: { supremacy: 0, prescience: [0, 0, 0] },
    decks: {
      planning: {
        house_atreides: 0,
        fremen_ally: 0,
        house_harkonnen: 0,
        corrino_ally: 0,
      },
      planningDiscard: {
        house_atreides: 0,
        fremen_ally: 0,
        house_harkonnen: 0,
        corrino_ally: 0,
      },
      prescienceDeck: 0,
      reinforcements: 0,
      wormsignPool: 16,
      tacticalDeck: 8,
    },
    harkonnenReserve: {
      units: { regular: 0, elite: 0, special_elite: 0 },
      deploymentTokens: 0,
      bashars: 0,
      namedLeaders: [],
    },
    beneGesserit: { atreides: 0, reserve: 5 },
    harkonnenUnusedDice: 0,
    atreidesUnusedDice: 0,
    ...over,
  };
}
function leg(
  faction: Legion["faction"],
  area: string,
  units: Partial<Legion["units"]> = {},
  extra: Partial<Legion> = {},
): Legion {
  return {
    ...emptyLegion(faction, area),
    units: { regular: 0, elite: 0, special_elite: 0, ...units },
    ...extra,
  };
}

describe("legalMoveDestinations", () => {
  it("Harkonnen ignore impassable borders (broken_land ↔ s1_3), other factions do not", () => {
    // broken_land and s1_3 are an impassable pair; Harkonnen adjacency includes it, standard doesn't.
    expect(harkonnenNeighbors("broken_land")).toContain("s1_3");
    expect(standardNeighbors("broken_land")).not.toContain("s1_3");

    const hk = legalMoveDestinations(
      gs({ legions: [leg("harkonnen", "broken_land", { regular: 2 })] }),
      leg("harkonnen", "broken_land", { regular: 2 }),
    );
    expect(hk.has("s1_3")).toBe(true); // crosses the red border
    expect(hk.has("arsunt")).toBe(true); // ordinary ground neighbour

    const at = legalMoveDestinations(
      gs({ legions: [leg("atreides", "broken_land", { regular: 2 })] }),
      leg("atreides", "broken_land", { regular: 2 }),
    );
    expect(at.has("s1_3")).toBe(false); // cannot cross the impassable border
    expect(at.has("arsunt")).toBe(true);
  });

  it("a sandworm blocks a destination", () => {
    const legion = leg("harkonnen", "broken_land", { regular: 2 });
    const dests = legalMoveDestinations(
      gs({ legions: [legion], sandworms: [{ area: "s1_3" }] }),
      legion,
    );
    expect(dests.has("s1_3")).toBe(false);
  });

  it("Harkonnen troop-transport extends reach by 1 area via an ornithopter in a connected air zone", () => {
    // s8_2 is 2 areas from s5_1 (via hagga_basin), so it's only reachable by troop-transport.
    const legion = leg("harkonnen", "s5_1", { regular: 2 });
    const noLift = legalMoveDestinations(gs({ legions: [legion] }), legion);
    expect(noLift.has("s8_2")).toBe(false);

    // az2 straddles sector s5 (hagga_basin/s5_1/s5_2), so an ornithopter there lets an s5 legion lift.
    const lifted = legalMoveDestinations(
      gs({
        legions: [legion],
        vehicles: [{ type: "ornithopter", location: "az2" }],
      }),
      legion,
    );
    expect(lifted.has("s8_2")).toBe(true);
  });

  it("Atreides sandriding rides a wormsign chain to reach an otherwise-unreachable area", () => {
    // s4_11 neighbours s1_3 but not s1_1, so from s1_1 it is only reachable by sandriding through s1_3.
    const legion = leg("atreides", "s1_1", { regular: 2 });
    const noWorm = legalMoveDestinations(gs({ legions: [legion] }), legion);
    expect(noWorm.has("s4_11")).toBe(false);

    const sandride = legalMoveDestinations(
      gs({ legions: [legion], wormsigns: [{ area: "s1_3" }] }),
      legion,
    );
    expect(sandride.has("s4_11")).toBe(true);
  });

  it("is empty for a legion with no figures", () => {
    expect(
      legalMoveDestinations(gs(), leg("harkonnen", "broken_land")).size,
    ).toBe(0);
  });

  it("excludes a destination whose friendly legion is at the stacking limit", () => {
    const mover = leg("harkonnen", "s1_11", { regular: 2 });
    const room = legalMoveDestinations(
      gs({ legions: [mover, leg("harkonnen", "s1_12", { regular: 5 })] }),
      mover,
    );
    expect(room.has("s1_12")).toBe(true); // 5 of 6 — room to merge

    const full = legalMoveDestinations(
      gs({ legions: [mover, leg("harkonnen", "s1_12", { regular: 6 })] }),
      mover,
    );
    expect(full.has("s1_12")).toBe(false); // at the limit — no room

    // CHOAM ban drops the Harkonnen limit to 5, so 5 units now block too.
    const banned = legalMoveDestinations(
      gs({
        legions: [mover, leg("harkonnen", "s1_12", { regular: 5 })],
        spice: {
          markers: { choam: 5, spacing_guild: 1, landsraad: 1 },
          activeBans: ["choam"],
          spiceReserve: 0,
        },
      }),
      mover,
    );
    expect(banned.has("s1_12")).toBe(false);
  });
});
