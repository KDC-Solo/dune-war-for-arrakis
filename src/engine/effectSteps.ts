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
import { areaLabel } from "./describeArea";

export interface EffectStep {
  /** Human-readable directive for this step. */
  text: string;
  /** True if the engine applies it to state; false = the player resolves it on the board. */
  auto: boolean;
  /** Present iff `auto`: returns the next state. */
  apply?: (s: GameState) => GameState;
  /** Ground area ids to render as clickable chips in the UI (vehicle/unit placement steps). */
  groundLocations?: string[];
  /** Air-zone ids to render as clickable chips in the UI (carryall/ornithopter placement steps). */
  airLocations?: string[];
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
  note?: string,
): EffectStep {
  return {
    text: `Place ${fmtUnits(units)} in ${areaLabel(area)}${note ? ` ${note}` : ""}.`,
    auto: true,
    groundLocations: [area],
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
    groundLocations: [...areas],
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

  // Describe what the card says (from counts), not just what positions were found.
  const countParts: string[] = [];
  if (counts.harvester)
    countParts.push(
      `${counts.harvester} harvester${counts.harvester === 1 ? "" : "s"}`,
    );
  if (counts.carryall)
    countParts.push(
      `${counts.carryall} carryall${counts.carryall === 1 ? "" : "s"}`,
    );
  if (counts.ornithopter)
    countParts.push(
      `${counts.ornithopter} ornithopter${counts.ornithopter === 1 ? "" : "s"}`,
    );
  const text = countParts.length
    ? `Place ${countParts.join(" and ")} on the board:`
    : "No vehicles to place.";

  return {
    text,
    groundLocations: newHarvesters,
    airLocations: [...newCarryalls, ...newOrnithopters],
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
export function manual(
  text: string,
  locations?: { ground?: string[]; air?: string[] },
): EffectStep {
  return {
    text,
    auto: false,
    groundLocations: locations?.ground,
    airLocations: locations?.air,
  };
}

/** Place a leader ("Bashar" or a named leader) from the reserve into the legion in `area`. Auto. */
export function placeLeader(leader: string, area: string): EffectStep {
  const label = leader === "Bashar" ? "1 Bashar Leader" : leader;
  return {
    text: `Place ${label} in ${areaLabel(area)}.`,
    auto: true,
    groundLocations: [area],
    apply: (s) => {
      const r = s.harkonnenReserve;
      let reserve = r;
      if (leader === "Bashar") {
        if (r.bashars <= 0) return s;
        reserve = { ...r, bashars: r.bashars - 1 };
      } else {
        if (!r.namedLeaders.includes(leader)) return s;
        reserve = { ...r, namedLeaders: r.namedLeaders.filter((n) => n !== leader) };
      }
      // upsertLegion MERGES contents, so hand it only the newly-added leader.
      const add = emptyLegion("harkonnen", area);
      add.leaders.push(
        leader === "Bashar"
          ? { kind: "generic", faction: "harkonnen" }
          : { kind: "named", faction: "harkonnen", name: leader },
      );
      return {
        ...s,
        legions: upsertLegion(s.legions, add),
        harkonnenReserve: reserve,
      };
    },
  };
}

/**
 * Discard one wormsign token per listed area (tokens return to the draw pool, matching the
 * hazard-phase rule). Areas may repeat when an area holds several tokens.
 */
export function discardWormsigns(areas: string[]): EffectStep {
  const labels = areas.map((a) => areaLabel(a)).join(", ");
  return {
    text: `Discard ${areas.length} Wormsign${areas.length === 1 ? "" : "s"}: ${labels}.`,
    auto: true,
    groundLocations: [...new Set(areas)],
    apply: (s) => {
      const remaining = [...s.wormsigns];
      let removed = 0;
      for (const area of areas) {
        const i = remaining.findIndex((w) => w.area === area);
        if (i >= 0) {
          remaining.splice(i, 1);
          removed += 1;
        }
      }
      if (removed === 0) return s;
      return {
        ...s,
        wormsigns: remaining,
        decks: { ...s.decks, wormsignPool: s.decks.wormsignPool + removed },
      };
    },
  };
}

/** Swap up to `count` units of one type in the legion at `area` for another type from the reserve. Auto. */
export function replaceUnits(
  area: string,
  from: UnitType,
  to: UnitType,
  count: number,
): EffectStep {
  return {
    text: `Replace ${fmtUnits({ [from]: count })} in ${areaLabel(area)} with ${fmtUnits({ [to]: count })}.`,
    auto: true,
    groundLocations: [area],
    apply: (s) => {
      const leg = s.legions.find((l) => l.faction === "harkonnen" && l.area === area);
      if (!leg) return s;
      const n = Math.min(count, leg.units[from], s.harkonnenReserve.units[to]);
      if (n <= 0) return s;
      const updated = {
        ...leg,
        units: { ...leg.units, [from]: leg.units[from] - n, [to]: leg.units[to] + n },
      };
      const reserve = { ...s.harkonnenReserve.units };
      reserve[to] -= n;
      reserve[from] += n;
      return {
        ...s,
        // in-place swap: upsertLegion would MERGE and double the legion's contents
        legions: s.legions.map((l) => (l === leg ? updated : l)),
        harkonnenReserve: { ...s.harkonnenReserve, units: reserve },
      };
    },
  };
}

/** Apply every auto step in order, returning the resulting state. */
export function applyEffectSteps(s: GameState, steps: EffectStep[]): GameState {
  return steps.reduce(
    (acc, step) => (step.auto && step.apply ? step.apply(acc) : acc),
    s,
  );
}
