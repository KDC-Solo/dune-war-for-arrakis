import { describe, it, expect } from "vitest";
import {
  gameOutcome,
  advancePrescience,
  destroySettlement,
  takeTestingStation,
  voluntaryRevealBonus,
  harkonnenBeneGesserit,
} from "./victory";
import { newGameState } from "./newGame";
import type { GameState } from "./state";

const base = (): GameState => newGameState();

describe("gameOutcome", () => {
  it("no winner in a fresh game", () => {
    expect(gameOutcome(base()).winner).toBeNull();
  });

  it("Harkonnen win at supremacy 10", () => {
    const s = base();
    s.tracks = { ...s.tracks, supremacy: 10 };
    expect(gameOutcome(s).winner).toBe("harkonnen");
  });

  it("Atreides win when all prescience markers reach the objective", () => {
    const s = base();
    s.atreidesObjective = [4, 5, 6];
    s.tracks = { ...s.tracks, prescience: [4, 5, 6] };
    expect(gameOutcome(s).winner).toBe("atreides");

    s.tracks = { ...s.tracks, prescience: [4, 5, 5] }; // one short
    expect(gameOutcome(s).winner).toBeNull();
  });

  it("no Atreides win without an entered objective", () => {
    const s = base();
    s.tracks = { ...s.tracks, prescience: [99, 99, 99] };
    expect(gameOutcome(s).winner).toBeNull();
  });
});

describe("prescience economy", () => {
  it("advancePrescience adds deltas and floors at 0", () => {
    const s = advancePrescience(base(), [2, 0, -5]);
    expect(s.tracks.prescience).toEqual([2, 0, 0]);
  });

  it("destroySettlement marks it destroyed and advances ALL markers by its rank", () => {
    const s0 = base();
    const arrakeen = s0.settlements.find((x) => x.area === "arrakeen")!;
    expect(arrakeen.rank).toBe(3);
    const s = destroySettlement(s0, "arrakeen");
    expect(s.settlements.find((x) => x.area === "arrakeen")!.destroyed).toBe(true);
    expect(s.tracks.prescience).toEqual([3, 3, 3]);
    // No-op on an already-destroyed settlement or a non-settlement area.
    expect(destroySettlement(s, "arrakeen")).toBe(s);
    expect(destroySettlement(s, "gara_kulon")).toBe(s);
  });

  it("takeTestingStation reveals the station and advances the chosen marker by 1", () => {
    const s0 = base();
    const station = s0.testingStations[0];
    const s = takeTestingStation(s0, station.area, 1);
    expect(s.testingStations.find((x) => x.area === station.area)!.revealed).toBe(true);
    expect(s.tracks.prescience).toEqual([0, 1, 0]);
    // Already revealed → no-op.
    expect(takeTestingStation(s, station.area, 1)).toBe(s);
  });
});

describe("solo bookkeeping rules", () => {
  it("voluntary reveal adds 1 reinforcements card unless the Spacing Guild ban is active", () => {
    const s0 = base();
    const s = voluntaryRevealBonus(s0);
    expect(s.decks.reinforcements).toBe(s0.decks.reinforcements + 1);

    const banned: GameState = {
      ...s0,
      spice: { ...s0.spice, activeBans: ["spacing_guild"] },
    };
    expect(voluntaryRevealBonus(banned)).toBe(banned);
  });

  it("Harkonnen Bene Gesserit: die from the SMF board → unused dice, else +1 supremacy", () => {
    const s0 = base();
    const withDie = harkonnenBeneGesserit(s0, true);
    expect(withDie.harkonnenUnusedDice).toBe(s0.harkonnenUnusedDice + 1);
    expect(withDie.tracks.supremacy).toBe(s0.tracks.supremacy);

    const noDie = harkonnenBeneGesserit(s0, false);
    expect(noDie.tracks.supremacy).toBe(s0.tracks.supremacy + 1);
    expect(noDie.harkonnenUnusedDice).toBe(s0.harkonnenUnusedDice);
  });
});
