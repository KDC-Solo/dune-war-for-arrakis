// Harkonnen reserve replenishment from casualties.
//
// When a Harkonnen legion takes hits (combat or Coriolis storms), figures leave the board and
// must flow back to the off-board reserve so the player doesn't track it by hand:
//   - eliminated regulars return to the regular pool;
//   - a demoted elite/Sardaukar returns to its pool while a regular is *drawn* from the pool to
//     replace it on the board (a swap — net zero figures, but it shifts the pool composition);
//   - generic Bashar leaders return to the pool;
//   - named leaders go to the regeneration tank (NOT the deploy pool — they must regenerate first).
//
// Deltas are derived by diffing a legion before/after `applyHarkonnenHits` (combat.ts), which
// never touches deployment tokens — so those are not part of casualty replenishment.

import type { HarkonnenReserve, Legion, UnitType } from './state';

/**
 * Signed change to the Harkonnen reserve pool. Positive unit counts return figures to the pool;
 * negative counts draw figures from it (the regular pulled in to replace a demoted elite/Sardaukar).
 */
export interface ReserveDelta {
  units: Record<UnitType, number>;
  /** Generic Bashar leaders returned to the pool. */
  bashars: number;
  /** Named leaders killed → sent to the regeneration tank. */
  namedLeaders: string[];
}

const zeroUnits = (): Record<UnitType, number> => ({ regular: 0, elite: 0, special_elite: 0 });

export function emptyReserveDelta(): ReserveDelta {
  return { units: zeroUnits(), bashars: 0, namedLeaders: [] };
}

/** Combine two reserve deltas (e.g. across several legions hit in one storm phase). */
export function addReserveDelta(a: ReserveDelta, b: ReserveDelta): ReserveDelta {
  return {
    units: {
      regular: a.units.regular + b.units.regular,
      elite: a.units.elite + b.units.elite,
      special_elite: a.units.special_elite + b.units.special_elite,
    },
    bashars: a.bashars + b.bashars,
    namedLeaders: [...a.namedLeaders, ...b.namedLeaders],
  };
}

/**
 * Reserve change implied by one legion's casualties, diffed from its before/after state.
 * Elites and Sardaukar only ever leave the board via demotion to a regular (Harkonnen casualty
 * priority), so their decrease is exactly the demotion count; the rest of the regular swing is
 * eliminations.
 */
export function reserveDeltaFromCasualties(before: Legion, after: Legion): ReserveDelta {
  const delta = emptyReserveDelta();

  const eliteDemotions = Math.max(0, before.units.elite - after.units.elite);
  const sardDemotions = Math.max(0, before.units.special_elite - after.units.special_elite);
  delta.units.elite += eliteDemotions;
  delta.units.special_elite += sardDemotions;

  // board regular change = (regulars gained from demotions) − (regulars eliminated).
  const regularsAdded = eliteDemotions + sardDemotions;
  const regularsEliminated = regularsAdded - (after.units.regular - before.units.regular);
  // Net flow to the pool: + eliminated (returned), − demotions (drawn out to replace).
  delta.units.regular += regularsEliminated - regularsAdded;

  // Leaders: count generic removals; collect named removals by name.
  const beforeGeneric = before.leaders.filter((l) => l.kind === 'generic').length;
  const afterGeneric = after.leaders.filter((l) => l.kind === 'generic').length;
  delta.bashars += Math.max(0, beforeGeneric - afterGeneric);

  const survivingNamed = new Set(
    after.leaders.filter((l) => l.kind === 'named' && l.name).map((l) => l.name as string),
  );
  for (const l of before.leaders) {
    if (l.kind === 'named' && l.name && !survivingNamed.has(l.name)) {
      delta.namedLeaders.push(l.name);
    }
  }

  return delta;
}

/** Apply a reserve delta, clamping unit pools at 0 and appending killed named leaders to the tank. */
export function applyReserveDelta(reserve: HarkonnenReserve, delta: ReserveDelta): HarkonnenReserve {
  return {
    ...reserve,
    units: {
      regular: Math.max(0, reserve.units.regular + delta.units.regular),
      elite: Math.max(0, reserve.units.elite + delta.units.elite),
      special_elite: Math.max(0, reserve.units.special_elite + delta.units.special_elite),
    },
    bashars: reserve.bashars + delta.bashars,
    regenerationTank: [...(reserve.regenerationTank ?? []), ...delta.namedLeaders],
  };
}
