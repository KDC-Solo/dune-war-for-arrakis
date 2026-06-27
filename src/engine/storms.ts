// Coriolis Storm resolution (Desert Hazards phase).
//
// Source: rulebook "Resolve Coriolis Storms" (p20) + Mahdi solo summary (p37). All Plateau,
// Minor Erg, Desert and Deep Desert areas are vulnerable EXCEPT the 5 central Plateau areas
// encircled by Mountains. For each Harkonnen legion in a vulnerable area the Atreides player
// rolls 2 Combat dice: each SWORD result scores 1 hit (any terrain); each SPECIAL result scores
// terrain-dependent hits — Deep Desert 2, Desert 1, Minor Erg / Plateau 0. Atreides legions are
// immune. Casualties use the standard Harkonnen casualty priority (applyHarkonnenHits).

import { AREAS, AREA_IDS } from './board';
import { neighbors } from './graph';
import type { GameState, Legion } from './state';
import { applyHarkonnenHits, type Casualties } from './combat';
import { addReserveDelta, applyReserveDelta, emptyReserveDelta, reserveDeltaFromCasualties } from './reserve';
import { areaLabel } from './describeArea';

// ---------------------------------------------------------------------------
// The 5 storm-exempt central plateaus — derived from the board graph
// ---------------------------------------------------------------------------

/**
 * A plateau is storm-exempt when it is "encircled by Mountains": none of its passable neighbours
 * is open sand (desert / minor erg). The central plateau cluster (Arrakeen / Carthag / Imperial
 * Basin / Hagga Basin / Arsunt) touches only mountains and each other, so exactly these 5 qualify.
 */
function deriveExemptPlateaus(): string[] {
  return AREA_IDS.filter((id) => {
    if (AREAS[id].terrain !== 'plateau') return false;
    const nbrs = neighbors(id);
    return nbrs.length > 0 && nbrs.every((n) => {
      const t = AREAS[n]?.terrain;
      return t === 'mountain' || t === 'plateau';
    });
  });
}

export const STORM_EXEMPT_PLATEAUS: ReadonlySet<string> = new Set(deriveExemptPlateaus());

/** True if Coriolis Storms can hit a legion standing in this area. */
export function isStormVulnerable(areaId: string): boolean {
  const a = AREAS[areaId];
  if (!a || a.terrain === 'mountain') return false; // mountains are sheltered
  if (a.terrain === 'plateau' && STORM_EXEMPT_PLATEAUS.has(areaId)) return false;
  return true; // non-exempt plateau, minor erg, desert, deep desert
}

/** Hits scored per SPECIAL die result for a legion in this area. */
export function specialHitValue(areaId: string): number {
  const a = AREAS[areaId];
  if (!a || a.terrain !== 'desert') return 0; // minor erg / plateau take nothing from specials
  return a.deep ? 2 : 1; // deep desert 2, desert 1
}

// ---------------------------------------------------------------------------
// Resolution
// ---------------------------------------------------------------------------

/** The two Combat dice rolled for one legion (only swords & specials matter for storms). */
export interface StormDice {
  swords: number;
  specials: number;
}

/** A Harkonnen legion exposed to the storm this phase. */
export interface StormTarget {
  /** Index into state.legions. */
  legionIndex: number;
  area: string;
  areaLabel: string;
  terrain: string;
  deep: boolean;
  /** Hits per special result here (0 / 1 / 2). */
  specialHitValue: number;
}

/** Outcome of resolving the storm for one legion. */
export interface StormOutcome extends StormTarget {
  swords: number;
  specials: number;
  hits: number;
  casualties: Casualties;
  /** True if the legion was wiped out. */
  eliminated: boolean;
}

/** Hits a legion in `area` takes from a 2-die roll. */
export function stormHits(area: string, dice: StormDice): number {
  return dice.swords + dice.specials * specialHitValue(area);
}

/** Every Harkonnen legion currently exposed to Coriolis Storms (in board order). */
export function stormTargets(s: GameState): StormTarget[] {
  const out: StormTarget[] = [];
  s.legions.forEach((l, i) => {
    if (l.faction !== 'harkonnen' || !isStormVulnerable(l.area)) return;
    const a = AREAS[l.area];
    out.push({
      legionIndex: i,
      area: l.area,
      areaLabel: areaLabel(l.area),
      terrain: a.terrain ?? 'unknown',
      deep: a.deep ?? false,
      specialHitValue: specialHitValue(l.area),
    });
  });
  return out;
}

const isEmpty = (l: Legion) =>
  l.units.regular + l.units.elite + l.units.special_elite + l.deploymentTokens === 0 && l.leaders.length === 0;

/**
 * Resolve Coriolis Storms for every exposed Harkonnen legion. `diceFor` supplies each legion's
 * 2-die result (player input in the app; injected for tests). Returns the updated state (hits
 * applied, wiped-out legions removed, casualties replenished into the reserve) and a per-legion
 * outcome summary. Pure — no mutation of `s`.
 */
export function resolveCoriolisStorms(
  s: GameState,
  diceFor: (t: StormTarget) => StormDice,
): { state: GameState; outcomes: StormOutcome[] } {
  const targets = stormTargets(s);
  if (targets.length === 0) return { state: s, outcomes: [] };

  const outcomes: StormOutcome[] = [];
  const legions = [...s.legions];
  let reserveDelta = emptyReserveDelta();

  for (const t of targets) {
    const dice = diceFor(t);
    const hits = stormHits(t.area, dice);
    const before = legions[t.legionIndex];
    const { legion, casualties } = applyHarkonnenHits(before, hits);
    legions[t.legionIndex] = legion;
    reserveDelta = addReserveDelta(reserveDelta, reserveDeltaFromCasualties(before, legion));
    outcomes.push({
      ...t,
      swords: dice.swords,
      specials: dice.specials,
      hits,
      casualties,
      eliminated: isEmpty(legion),
    });
  }

  return {
    state: {
      ...s,
      legions: legions.filter((l) => !isEmpty(l)),
      harkonnenReserve: applyReserveDelta(s.harkonnenReserve, reserveDelta),
    },
    outcomes,
  };
}
