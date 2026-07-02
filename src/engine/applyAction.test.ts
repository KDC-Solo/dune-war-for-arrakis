import { describe, it, expect } from "vitest";
import {
  applyHarkonnenAction,
  deployFromReserve,
  isAutoApplied,
  moveLegionUnits,
  reserveDeployAreas,
} from "./applyAction";
import { emptyLegion, type GameState, type Legion } from "./state";

function state(over: Partial<GameState> = {}): GameState {
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
    harvestingSector: "s3",
    targetSietchId: "gara_kulon",
    spice: {
      markers: { choam: 3, spacing_guild: 3, landsraad: 3 },
      activeBans: [],
      spiceReserve: 0,
    },
    tracks: { supremacy: 0, prescience: [0, 0, 0] },
    decks: {
      planning: {
        house_atreides: 10,
        fremen_ally: 10,
        house_harkonnen: 10,
        corrino_ally: 10,
      },
      planningDiscard: {
        house_atreides: 0,
        fremen_ally: 0,
        house_harkonnen: 0,
        corrino_ally: 0,
      },
      prescienceDeck: 16,
      reinforcements: 0,
      wormsignPool: 16,
      tacticalDeck: 8,
    },
    harkonnenReserve: {
      units: { regular: 10, elite: 6, special_elite: 6 },
      deploymentTokens: 8,
      bashars: 2,
      namedLeaders: ["Feyd-Rautha"],
    },
    beneGesserit: { atreides: 1, reserve: 4 },
    harkonnenUnusedDice: 0,
    atreidesUnusedDice: 0,
    ...over,
  };
}
function hLeg(
  area: string,
  units: Partial<Legion["units"]>,
  leaders: Legion["leaders"] = [],
): Legion {
  return {
    ...emptyLegion("harkonnen", area),
    units: { regular: 0, elite: 0, special_elite: 0, ...units },
    leaders,
  };
}

describe("applyHarkonnenAction — move", () => {
  it("moves a legion to the destination", () => {
    const s = state({ legions: [hLeg("s1_11", { regular: 3 })] });
    const r = applyHarkonnenAction(s, {
      kind: "move",
      legion: "s1_11",
      path: ["s1_11", "s1_12"],
    });
    expect(r.applied).toBe(true);
    expect(r.state.legions.find((l) => l.area === "s1_11")).toBeUndefined();
    expect(r.state.legions.find((l) => l.area === "s1_12")?.units.regular).toBe(
      3,
    );
  });

  it("merges into a friendly legion at the destination", () => {
    const s = state({
      legions: [hLeg("carthag", { regular: 2 }), hLeg("s5_2", { regular: 1 })],
    });
    // carthag and s5_2 may not be adjacent, but applyMove is mechanical (path endpoints given)
    const r = applyHarkonnenAction(s, {
      kind: "move",
      legion: "s5_2",
      path: ["s5_2", "carthag"],
    });
    expect(r.state.legions.filter((l) => l.area === "carthag")).toHaveLength(1);
    expect(
      r.state.legions.find((l) => l.area === "carthag")?.units.regular,
    ).toBe(3);
  });

  it("drops 2 deployment tokens when leaving a settlement", () => {
    const s = state({
      settlements: [{ area: "carthag", rank: 2, destroyed: false }],
      legions: [hLeg("carthag", { regular: 3 })],
    });
    const r = applyHarkonnenAction(s, {
      kind: "move",
      legion: "carthag",
      path: ["carthag", "s5_2"],
    });
    const left = r.state.legions.find((l) => l.area === "carthag");
    expect(left?.deploymentTokens).toBe(2);
    expect(r.state.harkonnenReserve.deploymentTokens).toBe(6); // 8 - 2
  });
});

describe("moveLegionUnits — manual split move", () => {
  it("moves the whole legion by default and clears the source", () => {
    const s = state({
      legions: [
        hLeg("s1_11", { regular: 3 }, [
          { kind: "named", faction: "harkonnen", name: "Beast Rabban" },
        ]),
      ],
    });
    const src = s.legions[0];
    const next = moveLegionUnits(s, "harkonnen", "s1_11", "s1_12", {
      units: { regular: 3, elite: 0, special_elite: 0 },
      deploymentTokens: 0,
      leaderIndices: [0],
    });
    expect(next.legions.find((l) => l.area === "s1_11")).toBeUndefined();
    const moved = next.legions.find((l) => l.area === "s1_12")!;
    expect(moved.units.regular).toBe(3);
    expect(moved.leaders).toEqual(src.leaders);
  });

  it("splits: moves a subset and leaves the rest behind", () => {
    const s = state({
      legions: [
        hLeg("s1_11", { regular: 3, elite: 2 }, [
          { kind: "named", faction: "harkonnen", name: "Beast Rabban" },
        ]),
      ],
    });
    const next = moveLegionUnits(s, "harkonnen", "s1_11", "s1_12", {
      units: { regular: 1, elite: 0, special_elite: 0 },
      deploymentTokens: 0,
      leaderIndices: [],
    });
    const stay = next.legions.find((l) => l.area === "s1_11")!;
    const moved = next.legions.find((l) => l.area === "s1_12")!;
    expect(stay.units).toEqual({ regular: 2, elite: 2, special_elite: 0 });
    expect(stay.leaders).toHaveLength(1); // leader stayed behind (not selected)
    expect(moved.units).toEqual({ regular: 1, elite: 0, special_elite: 0 });
    expect(moved.leaders).toHaveLength(0);
  });

  it("merges the moved subset into a same-faction legion at the destination", () => {
    const s = state({
      legions: [hLeg("s1_11", { regular: 3 }), hLeg("s1_12", { elite: 1 })],
    });
    const next = moveLegionUnits(s, "harkonnen", "s1_11", "s1_12", {
      units: { regular: 2, elite: 0, special_elite: 0 },
      deploymentTokens: 0,
      leaderIndices: [],
    });
    expect(next.legions.filter((l) => l.area === "s1_12")).toHaveLength(1);
    const dest = next.legions.find((l) => l.area === "s1_12")!;
    expect(dest.units).toEqual({ regular: 2, elite: 1, special_elite: 0 });
    expect(next.legions.find((l) => l.area === "s1_11")?.units.regular).toBe(1);
  });

  it("clamps counts to what is present and is a no-op for from === to", () => {
    const s = state({ legions: [hLeg("s1_11", { regular: 2 })] });
    const over = moveLegionUnits(s, "harkonnen", "s1_11", "s1_12", {
      units: { regular: 9, elite: 0, special_elite: 0 },
      deploymentTokens: 0,
      leaderIndices: [],
    });
    expect(over.legions.find((l) => l.area === "s1_11")).toBeUndefined();
    expect(over.legions.find((l) => l.area === "s1_12")?.units.regular).toBe(2);
    expect(
      moveLegionUnits(s, "harkonnen", "s1_11", "s1_11", {
        units: { regular: 1, elite: 0, special_elite: 0 },
        deploymentTokens: 0,
        leaderIndices: [],
      }),
    ).toBe(s);
  });

  it("drops 2 garrison tokens when a Harkonnen legion fully leaves a live settlement", () => {
    const s = state({
      settlements: [{ area: "carthag", rank: 2, destroyed: false }],
      legions: [hLeg("carthag", { regular: 2 })],
    });
    const next = moveLegionUnits(s, "harkonnen", "carthag", "arsunt", {
      units: { regular: 2, elite: 0, special_elite: 0 },
      deploymentTokens: 0,
      leaderIndices: [],
    });
    const garrison = next.legions.find((l) => l.area === "carthag")!;
    expect(garrison.deploymentTokens).toBe(2);
    expect(next.harkonnenReserve.deploymentTokens).toBe(
      s.harkonnenReserve.deploymentTokens - 2,
    );
    // A split (units remain) leaves no garrison drop.
    const split = moveLegionUnits(s, "harkonnen", "carthag", "arsunt", {
      units: { regular: 1, elite: 0, special_elite: 0 },
      deploymentTokens: 0,
      leaderIndices: [],
    });
    expect(split.legions.find((l) => l.area === "carthag")!.deploymentTokens).toBe(0);
    expect(split.harkonnenReserve.deploymentTokens).toBe(s.harkonnenReserve.deploymentTokens);
  });

  it("clamps the moved units to the destination's stacking room (highest value first)", () => {
    const s = state({
      legions: [
        hLeg("s1_11", { regular: 3, special_elite: 1 }),
        hLeg("s1_12", { regular: 4 }),
      ],
    });
    // Destination holds 4 of 6 → room for 2: the Sardaukar + 1 regular move, 2 regulars stay.
    const next = moveLegionUnits(s, "harkonnen", "s1_11", "s1_12", {
      units: { regular: 3, elite: 0, special_elite: 1 },
      deploymentTokens: 0,
      leaderIndices: [],
    });
    const dest = next.legions.find((l) => l.area === "s1_12")!;
    expect(dest.units).toEqual({ regular: 5, elite: 0, special_elite: 1 });
    expect(next.legions.find((l) => l.area === "s1_11")!.units.regular).toBe(2);
  });

  it("is a no-op (leaders stay too) when the destination has no stacking room", () => {
    const s = state({
      legions: [
        hLeg("s1_11", { regular: 2 }, [
          { kind: "named", faction: "harkonnen", name: "Beast Rabban" },
        ]),
        hLeg("s1_12", { regular: 6 }),
      ],
    });
    const next = moveLegionUnits(s, "harkonnen", "s1_11", "s1_12", {
      units: { regular: 2, elite: 0, special_elite: 0 },
      deploymentTokens: 0,
      leaderIndices: [0],
    });
    const stay = next.legions.find((l) => l.area === "s1_11")!;
    expect(stay.units.regular).toBe(2);
    expect(stay.leaders).toHaveLength(1);
    expect(next.legions.find((l) => l.area === "s1_12")!.units.regular).toBe(6);
  });

  it("the CHOAM ban lowers the Harkonnen limit to 5 but not the Atreides limit", () => {
    const banned = state({
      spice: {
        markers: { choam: 5, spacing_guild: 3, landsraad: 3 },
        activeBans: ["choam"],
        spiceReserve: 0,
      },
    });
    const hk = moveLegionUnits(
      { ...banned, legions: [hLeg("s1_11", { regular: 3 }), hLeg("s1_12", { regular: 4 })] },
      "harkonnen",
      "s1_11",
      "s1_12",
      { units: { regular: 3, elite: 0, special_elite: 0 }, deploymentTokens: 0, leaderIndices: [] },
    );
    expect(hk.legions.find((l) => l.area === "s1_12")!.units.regular).toBe(5);

    const aLeg = (area: string, regular: number): Legion => ({
      ...emptyLegion("atreides", area),
      units: { regular, elite: 0, special_elite: 0 },
    });
    const at = moveLegionUnits(
      { ...banned, legions: [aLeg("s1_11", 3), aLeg("s1_12", 4)] },
      "atreides",
      "s1_11",
      "s1_12",
      { units: { regular: 3, elite: 0, special_elite: 0 }, deploymentTokens: 0, leaderIndices: [] },
    );
    expect(at.legions.find((l) => l.area === "s1_12")!.units.regular).toBe(6);
  });
});

describe("reserveDeployAreas", () => {
  it("offers live settlements and Harkonnen-legion areas, excluding destroyed/enemy/full ones", () => {
    const s = state({
      settlements: [
        { area: "arrakeen", rank: 3, destroyed: false },
        { area: "carthag", rank: 2, destroyed: true },
      ],
      legions: [
        hLeg("s1_11", { regular: 2 }),
        hLeg("s1_12", { regular: 6 }), // at the stacking limit — no room
        { ...emptyLegion("atreides", "arsunt"), units: { regular: 1, elite: 0, special_elite: 0 } },
      ],
    });
    const areas = reserveDeployAreas(s);
    expect(areas.has("arrakeen")).toBe(true); // live settlement
    expect(areas.has("s1_11")).toBe(true); // Harkonnen legion with room
    expect(areas.has("carthag")).toBe(false); // destroyed settlement
    expect(areas.has("s1_12")).toBe(false); // full stack
    expect(areas.has("arsunt")).toBe(false); // Atreides-held
  });

  it("excludes a live settlement occupied by an Atreides legion", () => {
    const s = state({
      settlements: [{ area: "arrakeen", rank: 3, destroyed: false }],
      legions: [
        { ...emptyLegion("atreides", "arrakeen"), units: { regular: 2, elite: 0, special_elite: 0 } },
      ],
    });
    expect(reserveDeployAreas(s).has("arrakeen")).toBe(false);
  });
});

describe("applyHarkonnenAction — deploy", () => {
  it("adds units + a named leader from the reserve", () => {
    const s = state({
      settlements: [{ area: "arrakeen", rank: 3, destroyed: false }],
    });
    const r = applyHarkonnenAction(s, {
      kind: "deploy",
      placements: [
        {
          settlement: "arrakeen",
          units: { regular: 2, elite: 1, special_elite: 0 },
          leader: "Feyd-Rautha",
        },
      ],
    });
    expect(r.applied).toBe(true);
    const leg = r.state.legions.find((l) => l.area === "arrakeen")!;
    expect(leg.units).toEqual({ regular: 2, elite: 1, special_elite: 0 });
    expect(leg.leaders).toEqual([
      { kind: "named", faction: "harkonnen", name: "Feyd-Rautha" },
    ]);
    expect(r.state.harkonnenReserve.units.regular).toBe(8); // 10 - 2
    expect(r.state.harkonnenReserve.namedLeaders).not.toContain("Feyd-Rautha");
  });
});

describe("deployFromReserve", () => {
  it("merges units into an existing legion and draws them from the reserve (totals conserved)", () => {
    const s = state({ legions: [hLeg("carthag", { regular: 1 })] });
    const next = deployFromReserve(s, {
      settlement: "carthag",
      units: { regular: 2, elite: 1, special_elite: 0 },
      leader: "Bashar",
    });
    const leg = next.legions.find((l) => l.area === "carthag")!;
    expect(leg.units).toEqual({ regular: 3, elite: 1, special_elite: 0 }); // 1 + 2
    expect(leg.leaders).toEqual([{ kind: "generic", faction: "harkonnen" }]);
    expect(next.harkonnenReserve.units.regular).toBe(8); // 10 - 2
    expect(next.harkonnenReserve.units.elite).toBe(5); // 6 - 1
    expect(next.harkonnenReserve.bashars).toBe(1); // 2 - 1
  });

  it("clamps a request to what the reserve actually holds", () => {
    const s = state({
      harkonnenReserve: {
        units: { regular: 1, elite: 0, special_elite: 0 },
        deploymentTokens: 0,
        bashars: 0,
        namedLeaders: [],
      },
    });
    const next = deployFromReserve(s, {
      settlement: "carthag",
      units: { regular: 5, elite: 2, special_elite: 0 },
      leader: null,
    });
    expect(next.legions.find((l) => l.area === "carthag")!.units.regular).toBe(
      1,
    );
    expect(next.harkonnenReserve.units.regular).toBe(0);
  });
});

describe("applyHarkonnenAction — house upgrade", () => {
  it("replaces regulars with elites and swaps the reserve", () => {
    const s = state({ legions: [hLeg("carthag", { regular: 3 })] });
    const r = applyHarkonnenAction(s, {
      kind: "house_replace",
      legion: "carthag",
      count: 2,
    });
    const leg = r.state.legions.find((l) => l.area === "carthag")!;
    expect(leg.units.regular).toBe(1);
    expect(leg.units.elite).toBe(2);
    expect(r.state.harkonnenReserve.units.elite).toBe(4); // 6 - 2
    expect(r.state.harkonnenReserve.units.regular).toBe(12); // 10 + 2 returned
  });
});

describe("applyHarkonnenAction — place vehicles", () => {
  it("places a harvester and an ornithopter", () => {
    const r = applyHarkonnenAction(state(), { kind: "house_place_vehicles" });
    expect(r.applied).toBe(true);
    expect(r.state.vehicles.some((v) => v.type === "harvester")).toBe(true);
    expect(r.state.vehicles.some((v) => v.type === "ornithopter")).toBe(true);
  });
});

describe("applyHarkonnenAction — player-resolved actions", () => {
  it("does not auto-apply attacks, mentat, or none", () => {
    const s = state();
    for (const a of [
      {
        kind: "attack_sietch",
        attacker: "s1_11",
        sietch: "gara_kulon",
        useOrnithopter: false,
      },
      { kind: "attack_legion", attacker: "s1_11", defender: "gara_kulon" },
      { kind: "mentat" },
      { kind: "none", reason: "x" },
    ] as const) {
      const r = applyHarkonnenAction(s, a);
      expect(r.applied).toBe(false);
      expect(r.note).toBeTruthy();
      expect(r.state).toBe(s); // unchanged
    }
  });

  it("isAutoApplied flags the mechanical actions", () => {
    expect(isAutoApplied({ kind: "move", legion: "a", path: ["a", "b"] })).toBe(
      true,
    );
    expect(
      isAutoApplied({ kind: "attack_legion", attacker: "a", defender: "b" }),
    ).toBe(false);
  });
});
