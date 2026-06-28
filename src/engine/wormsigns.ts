// Wormsign & sandworm placement rules (Desert Hazards phase, rulebook p20 / p30-31).
//
// Place Wormsigns: first discard wormsigns in Areas that now contain an Atreides Legion or a
// Sandworm; then place 1 facedown in each DESERT Area containing a Harkonnen Legion or Harvester
// that doesn't already have a wormsign or sandworm (limited by the token pool).
//
// Occupancy invariants used by the manual editor / map picker:
//   - a wormsign needs an empty-of-worm Desert area with no Atreides Legion (which would discard it);
//   - a sandworm's move destination must be an empty Desert area (figures/tokens block it; an
//     Ecological Testing Station is the only allowed exception).

import type { GameState } from './state';
import { AREA_IDS } from './board';
import { isDesertArea } from './describeArea';

const harkonnenLegionAt = (s: GameState, area: string) => s.legions.some((l) => l.faction === 'harkonnen' && l.area === area);
const atreidesLegionAt = (s: GameState, area: string) => s.legions.some((l) => l.faction === 'atreides' && l.area === area);
const anyLegionAt = (s: GameState, area: string) => s.legions.some((l) => l.area === area);
const harvesterAt = (s: GameState, area: string) => s.vehicles.some((v) => v.type === 'harvester' && v.location === area);
const vehicleAt = (s: GameState, area: string) => s.vehicles.some((v) => v.location === area); // only harvesters use area ids
const wormsignAt = (s: GameState, area: string) => s.wormsigns.some((w) => w.area === area);
const sandwormAt = (s: GameState, area: string) => s.sandworms.some((w) => w.area === area);
const liveSietchAt = (s: GameState, area: string) => s.sietches.some((x) => x.area === area && !x.destroyed);
const liveSettlementAt = (s: GameState, area: string) => s.settlements.some((x) => x.area === area && !x.destroyed);

/** A wormsign may sit on a Desert area with no wormsign/sandworm and no Atreides Legion. */
export function canPlaceWormsign(s: GameState, area: string): boolean {
  return isDesertArea(area) && !wormsignAt(s, area) && !sandwormAt(s, area) && !atreidesLegionAt(s, area);
}

/** A sandworm's destination must be an empty Desert area (a Testing Station is the only allowed token). */
export function canPlaceSandworm(s: GameState, area: string): boolean {
  return (
    isDesertArea(area) &&
    !anyLegionAt(s, area) &&
    !vehicleAt(s, area) &&
    !wormsignAt(s, area) &&
    !sandwormAt(s, area) &&
    !liveSietchAt(s, area) &&
    !liveSettlementAt(s, area)
  );
}

/** Wormsigns discarded at the start of the step (an Atreides Legion or Sandworm is now there). */
export function wormsignsToDiscard(s: GameState): string[] {
  return s.wormsigns.filter((w) => atreidesLegionAt(s, w.area) || sandwormAt(s, w.area)).map((w) => w.area);
}

/** Desert areas that receive a fresh wormsign (Harkonnen Legion or Harvester; not already occupied). */
export function wormsignPlacementAreas(s: GameState): string[] {
  return AREA_IDS.filter(
    (a) => isDesertArea(a) && (harkonnenLegionAt(s, a) || harvesterAt(s, a)) && !wormsignAt(s, a) && !sandwormAt(s, a),
  );
}

export interface WormsignPlacement {
  state: GameState;
  placed: string[];
  discarded: string[];
}

/**
 * Run the official Place-Wormsigns step: discard, then draw from the pool into each qualifying
 * Desert area (capped by the available tokens; discarded tokens shuffle back first). Pure.
 */
export function placeWormsigns(s: GameState): WormsignPlacement {
  const discarded = wormsignsToDiscard(s);
  const discardSet = new Set(discarded);
  const kept = s.wormsigns.filter((w) => !discardSet.has(w.area));
  const afterDiscard: GameState = { ...s, wormsigns: kept };

  let pool = s.decks.wormsignPool + discarded.length; // discards shuffled back into the pool
  const candidates = wormsignPlacementAreas(afterDiscard);
  const placed = candidates.slice(0, Math.max(0, pool));
  pool -= placed.length;

  return {
    state: {
      ...s,
      wormsigns: [...kept, ...placed.map((area) => ({ area }))],
      decks: { ...s.decks, wormsignPool: pool },
    },
    placed,
    discarded,
  };
}
