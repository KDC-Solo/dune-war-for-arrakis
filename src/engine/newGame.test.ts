import { describe, it, expect } from "vitest";
import { newGameState } from "./newGame";
import { AREA_IDS, AREAS } from "./board";
import { deckSize, HOUSE_HARKONNEN_CARDS, CORRINO_ALLY_CARDS } from "./planningCards";

describe("newGameState", () => {
  const s = newGameState();

  it("places all 6 Harkonnen settlements with their board ranks", () => {
    expect(s.settlements).toHaveLength(6);
    const arrakeen = s.settlements.find((x) => x.area === "arrakeen");
    expect(arrakeen?.rank).toBe(3);
    expect(s.settlements.every((x) => !x.destroyed)).toBe(true);
  });

  it("places all 8 sietches facedown (rank hidden, not revealed)", () => {
    expect(s.sietches).toHaveLength(8);
    expect(
      s.sietches.every((x) => x.rank === null && !x.revealed && !x.destroyed),
    ).toBe(true);
  });

  it("seeds one Atreides legion (token + Naib) on every sietch", () => {
    const sietchAreas = AREA_IDS.filter((id) => AREAS[id].sietch);
    for (const a of sietchAreas) {
      const leg = s.legions.find(
        (l) => l.faction === "atreides" && l.area === a,
      )!;
      expect(leg.deploymentTokens).toBe(1);
      expect(leg.leaders).toEqual([{ kind: "generic", faction: "atreides" }]);
    }
  });

  it("seeds one Harkonnen legion (2 Starting Deployment tokens) on every settlement", () => {
    const settlementAreas = AREA_IDS.filter(
      (id) => AREAS[id].settlement != null,
    );
    const sietchAreas = AREA_IDS.filter((id) => AREAS[id].sietch);
    expect(s.legions).toHaveLength(sietchAreas.length + settlementAreas.length);
    for (const a of settlementAreas) {
      const leg = s.legions.find(
        (l) => l.faction === "harkonnen" && l.area === a,
      )!;
      expect(leg.deploymentTokens).toBe(2);
      expect(leg.units).toEqual({ regular: 0, elite: 0, special_elite: 0 });
      expect(leg.leaders).toEqual([]);
    }
  });

  it("starts the imperium markers at the top step (max action dice, no bans)", () => {
    expect(s.spice.markers).toEqual({
      choam: 1,
      spacing_guild: 1,
      landsraad: 1,
    });
    expect(s.spice.activeBans).toEqual([]);
  });

  it("starts tracks at zero in round 1", () => {
    expect(s.round).toBe(1);
    expect(s.tracks.supremacy).toBe(0);
    expect(s.tracks.prescience).toEqual([0, 0, 0]);
  });

  it("starts the token pool empty (all 12 tokens are on-board garrisons) with start-in-play leaders in the reserve", () => {
    expect(s.harkonnenReserve.deploymentTokens).toBe(0);
    // All 12 Starting Deployment tokens sit on the 6 settlements (2 each).
    const onBoard = s.legions
      .filter((l) => l.faction === "harkonnen")
      .reduce((n, l) => n + l.deploymentTokens, 0);
    expect(onBoard).toBe(12);
    expect(s.harkonnenReserve.units).toEqual({
      regular: 16,
      elite: 8,
      special_elite: 8,
    });
    expect(s.harkonnenReserve.namedLeaders).toEqual(
      expect.arrayContaining([
        "Beast Rabban",
        "Baron Harkonnen",
        "Captain Aramsham",
      ]),
    );
  });

  it("has no vehicles, wormsigns, sandworms, or this-round draws yet", () => {
    expect(s.vehicles).toEqual([]);
    expect(s.wormsigns).toEqual([]);
    expect(s.sandworms).toEqual([]);
    expect(s.harvestingSector).toBeNull();
    expect(s.targetSietchId).toBeNull();
  });
});

describe('reinforcements deck at setup', () => {
  it('starts with 2 cards (1 Harkonnen + 1 Corrino), drawn from those piles', () => {
    const s = newGameState();
    expect(s.decks.reinforcements).toBe(2);
    // The seeded cards came out of the two Harkonnen planning draw piles.
    expect(s.decks.planning.house_harkonnen).toBe(deckSize(HOUSE_HARKONNEN_CARDS) - 1);
    expect(s.decks.planning.corrino_ally).toBe(deckSize(CORRINO_ALLY_CARDS) - 1);
  });
});
