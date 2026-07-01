// Shared "effect step" machinery for resolving printed card / leader-ability text into ordered
// play STEPS. The app auto-applies the unambiguous mechanical steps (fixed-location unit
// placement, vehicle placement, deck draws) and renders the rest as player directives.
//
// Used by cardEffects.ts (planning cards) and leaderEffects.ts (named-leader specials).

import type { GameState, PlanningDeck, UnitType, VehicleType } from "./state";
import { emptyLegion } from "./state";
import { upsertLegion } from "./applyAction";
import {
  placeHarvesters,
  placeCarryalls,
  placeOrnithopters,
} from "./vehiclePlacement";
import { areaLabel, airZoneLabel } from "./describeArea";

export interface EffectStep {
  /** Human-readable directive for this step. */
  text: string;
  /** True if the engine applies it to state; false = the player resolves it on the board. */
  auto: boolean;
  /** Present iff `auto`: returns the next state. */
  apply?: (s: GameState) => GameState;
}

export interface EffectResolution {
  /** Card id or leader name. */
  id: string;
  /** Display name. */
  name: string;
  steps: EffectStep[];
}

const DECK_LABEL: Record<PlanningDeck, string> = {
  house_harkonnen: "House Harkonnen",
  corrino_ally: "Corrino Ally",
  house_atreides: "House Atreides",
  fremen_ally: "Fremen Ally",
};

const UNIT_LABEL: Record<UnitType, [string, string]> = {
  regular: ["Regular Unit", "Regular Units"],
  elite: ["Elite Unit", "Elite Units"],
  special_elite: ["Sardaukar Unit", "Sardaukar Units"],
};

export function fmtUnits(units: Partial<Record<UnitType, number>>): string {
  const parts: string[] = [];
  (Object.keys(units) as UnitType[]).forEach((t) => {
    const n = units[t] ?? 0;
    if (n > 0) parts.push(`${n} ${UNIT_LABEL[t][n === 1 ? 0 : 1]}`);
  });
  return parts.join(" and ");
}

// --- step builders ---------------------------------------------------------

/** Place a fixed mix of Harkonnen units in a known area, drawn from the reserve. Auto. */
export function placeUnits(
  units: Partial<Record<UnitType, number>>,
  area: string,
): EffectStep {
  return {
    text: `Place ${fmtUnits(units)} in ${areaLabel(area)}.`,
    auto: true,
    apply: (s) => {
      const reserve = { ...s.harkonnenReserve.units };
      const add = emptyLegion("harkonnen", area);
      (Object.keys(units) as UnitType[]).forEach((t) => {
        const n = Math.min(units[t] ?? 0, reserve[t]);
        add.units[t] = n;
        reserve[t] = Math.max(0, reserve[t] - n);
      });
      return {
        ...s,
        legions: upsertLegion(s.legions, add),
        harkonnenReserve: { ...s.harkonnenReserve, units: reserve },
      };
    },
  };
}

/** Place 1 unit of one type in each of several fixed areas. Auto. */
export function placeOneEach(
  type: UnitType,
  areas: string[],
  label: string,
): EffectStep {
  return {
    text: `Place 1 ${UNIT_LABEL[type][0]} in ${label}.`,
    auto: true,
    apply: (s) => {
      let legions = s.legions;
      const reserve = { ...s.harkonnenReserve.units };
      for (const area of areas) {
        if (reserve[type] <= 0) break;
        const add = emptyLegion("harkonnen", area);
        add.units[type] = 1;
        reserve[type] -= 1;
        legions = upsertLegion(legions, add);
      }
      return {
        ...s,
        legions,
        harkonnenReserve: { ...s.harkonnenReserve, units: reserve },
      };
    },
  };
}

/** Place vehicles via the placement engine (it picks the board spots). Auto. */
export function placeVehicles(
  s: GameState,
  counts: Partial<Record<VehicleType, number>>,
): EffectStep {
  // Compute positions now so the step text can name the exact spots.
  const newHarvesters = placeHarvesters(s, counts.harvester ?? 0);
  const harvesterAreas = [
    ...s.vehicles.filter((v) => v.type === "harvester").map((v) => v.location),
    ...newHarvesters,
  ];
  const newCarryalls = placeCarryalls(s, counts.carryall ?? 0, harvesterAreas);
  const newOrnithopters = placeOrnithopters(s, counts.ornithopter ?? 0);

  const parts: string[] = [];
  if (newHarvesters.length)
    parts.push(
      `${newHarvesters.length} harvester${newHarvesters.length === 1 ? "" : "s"} in ${newHarvesters.map(areaLabel).join(", ")}`,
    );
  if (newCarryalls.length)
    parts.push(
      `${newCarryalls.length} carryall${newCarryalls.length === 1 ? "" : "s"} in ${newCarryalls.map(airZoneLabel).join(", ")}`,
    );
  if (newOrnithopters.length)
    parts.push(
      `${newOrnithopters.length} ornithopter${newOrnithopters.length === 1 ? "" : "s"} in ${newOrnithopters.map(airZoneLabel).join(", ")}`,
    );
  const text = parts.length
    ? `Place ${parts.join("; ")}.`
    : "No legal vehicle placement available.";

  return {
    text,
    auto: true,
    apply: (st) => {
      const vehicles = [...st.vehicles];
      const hrs = placeHarvesters(st, counts.harvester ?? 0);
      for (const loc of hrs)
        vehicles.push({ type: "harvester", location: loc });
      const hareas = [
        ...st.vehicles
          .filter((v) => v.type === "harvester")
          .map((v) => v.location),
        ...hrs,
      ];
      for (const loc of placeCarryalls(st, counts.carryall ?? 0, hareas))
        vehicles.push({ type: "carryall", location: loc });
      for (const loc of placeOrnithopters(st, counts.ornithopter ?? 0))
        vehicles.push({ type: "ornithopter", location: loc });
      return { ...st, vehicles };
    },
  };
}

/** Draw N cards from a planning deck (decrements the draw pile). Auto. */
export function draw(deck: PlanningDeck, count: number): EffectStep {
  return {
    text: `Draw ${count} ${DECK_LABEL[deck]} Planning card${count === 1 ? "" : "s"}.`,
    auto: true,
    apply: (s) => {
      const n = Math.min(count, s.decks.planning[deck]);
      return {
        ...s,
        decks: {
          ...s.decks,
          planning: { ...s.decks.planning, [deck]: s.decks.planning[deck] - n },
        },
      };
    },
  };
}

/** A step the player resolves on the board (move / attack / choice). Not auto-applied. */
export function manual(text: string): EffectStep {
  return { text, auto: false };
}

/** Apply every auto step in order, returning the resulting state. */
export function applyEffectSteps(s: GameState, steps: EffectStep[]): GameState {
  return steps.reduce(
    (acc, step) => (step.auto && step.apply ? step.apply(acc) : acc),
    s,
  );
}
