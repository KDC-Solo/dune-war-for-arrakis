// Victory conditions & the Atreides prescience economy (rulebook p10/p27, fan-summary p5/p9).
//
//  - Harkonnen win: supremacy marker reaches 10 (solo: +1 per round + spice surpluses).
//  - Atreides win: all 3 prescience markers (Kwisatz Haderach / Sand Dwellers / Jihad) reach the
//    scores on the Secret Objective card drawn at game start. The card is physical and secret, so
//    the app stores the player-entered targets in `atreidesObjective`. Formally the check happens
//    at the end of any round OR immediately after destroying Arrakeen; the app surfaces the win as
//    soon as the scores are met (the player met them via one of those events anyway).
//
// Prescience markers advance when (fan-summary p5):
//  - a prescience card is claimed (max 2/round): the deltas printed on the card;
//  - an Atreides legion takes an ecological testing station: +1 to the marker whose symbol is on
//    the token's back (the player sees the physical token);
//  - a Harkonnen settlement is destroyed: ALL markers advance by the settlement's rank
//    (Arrakeen 3 / Carthag 2 / Pyon village 1).

import type { GameState } from "./state";
import { SUPREMACY_WIN } from "./round";
import { scoutingBanned } from "./imperiumBans";

/** Marker order used by `tracks.prescience` and `atreidesObjective`. */
export const PRESCIENCE_MARKERS = [
  { key: "kwisatz", label: "Kwisatz Haderach", color: "green" },
  { key: "sand_dwellers", label: "Sand Dwellers", color: "orange" },
  { key: "jihad", label: "Jihad", color: "red" },
] as const;

export type PrescienceTriple = [number, number, number];

export interface GameOutcome {
  winner: "harkonnen" | "atreides" | null;
  reason: string;
}

/** The game's outcome, if either victory condition is met. */
export function gameOutcome(s: GameState): GameOutcome {
  if (s.tracks.supremacy >= SUPREMACY_WIN) {
    return {
      winner: "harkonnen",
      reason: `The supremacy marker reached ${SUPREMACY_WIN}.`,
    };
  }
  // Every Secret Objective card targets all three markers with nonzero scores, so a triple with
  // any 0 means the player is still entering it — never declare a win off a partial objective.
  const obj = s.atreidesObjective;
  if (obj && obj.every((target) => target >= 1) && obj.every((target, i) => s.tracks.prescience[i] >= target)) {
    return {
      winner: "atreides",
      reason: "All 3 prescience markers reached the Secret Objective scores.",
    };
  }
  return { winner: null, reason: "" };
}

/** Advance (or correct) the prescience markers by the given deltas, floored at 0. */
export function advancePrescience(
  s: GameState,
  deltas: PrescienceTriple,
): GameState {
  const prescience = s.tracks.prescience.map((v, i) =>
    Math.max(0, v + deltas[i]),
  ) as PrescienceTriple;
  return { ...s, tracks: { ...s.tracks, prescience } };
}

/**
 * Destroy a Harkonnen settlement the Atreides way: mark it destroyed and advance ALL prescience
 * markers by its rank (Arrakeen 3 / Carthag 2 / village 1). No-op if the area isn't a live
 * settlement.
 */
export function destroySettlement(s: GameState, area: string): GameState {
  const st = s.settlements.find((x) => x.area === area && !x.destroyed);
  if (!st) return s;
  const settlements = s.settlements.map((x) =>
    x.area === area ? { ...x, destroyed: true } : x,
  );
  return advancePrescience(
    { ...s, settlements },
    [st.rank, st.rank, st.rank],
  );
}

/**
 * Take an ecological testing station: mark it revealed and advance the chosen marker by 1 (the
 * token's back shows which marker — the player reads it off the physical token). No-op if the
 * station is unknown or already revealed.
 */
export function takeTestingStation(
  s: GameState,
  area: string,
  markerIndex: 0 | 1 | 2,
): GameState {
  const ts = s.testingStations.find((x) => x.area === area && !x.revealed);
  if (!ts) return s;
  const testingStations = s.testingStations.map((x) =>
    x.area === area ? { ...x, revealed: true } : x,
  );
  const deltas: PrescienceTriple = [0, 0, 0];
  deltas[markerIndex] = 1;
  return advancePrescience({ ...s, testingStations }, deltas);
}

/**
 * The Atreides voluntarily reveal a sietch or deployment token (guerrilla training): the
 * Harkonnen add 1 planning card to the reinforcements deck — unless the Spacing Guild ban is
 * active (fan-summary p9).
 */
export function voluntaryRevealBonus(s: GameState): GameState {
  if (scoutingBanned(s.spice.activeBans)) return s;
  return {
    ...s,
    decks: { ...s.decks, reinforcements: s.decks.reinforcements + 1 },
  };
}

/**
 * The Harkonnen would gain a Bene Gesserit token (solo rule, fan-summary p9): take 1 action die
 * from The Spice Must Flow board into the unused Harkonnen dice; if no die is set aside there,
 * advance the supremacy marker 1 step instead. The physical SMF board shows whether a die is
 * available, so the caller reports it.
 */
export function harkonnenBeneGesserit(
  s: GameState,
  dieAvailableOnBoard: boolean,
): GameState {
  if (dieAvailableOnBoard) {
    return { ...s, harkonnenUnusedDice: s.harkonnenUnusedDice + 1 };
  }
  return {
    ...s,
    tracks: {
      ...s.tracks,
      supremacy: Math.min(SUPREMACY_WIN, s.tracks.supremacy + 1),
    },
  };
}
