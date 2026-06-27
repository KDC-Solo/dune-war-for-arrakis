// Mahdi solo round structure: phase sequence + start/end-of-round tactical-card logic.
//
// Source: rulebook "Mahdi Solo Mode Game Round Sequence" (p37+) and fan summary p9.
// The solo round follows the regular sequence with these key differences modeled here:
//  - Start of round: draw 2 prescience (not 3); draw a Harvesting-Sector tactical card and a
//    Target-Sietch tactical card (with re-draw constraints).
//  - End of round: advance the supremacy marker 1 step; reshuffle all 8 tactical cards.

import { AREAS, type SectorId } from './board';
import type { RoundPhase, TacticalCard, TacticalSector } from './state';

// ---------------------------------------------------------------------------
// Sectors: the 4 sectors adjacent to the North Pole are "central" and a tactical
// card treats all 4 as a single sector. The North Pole itself is part of all 4.
// ---------------------------------------------------------------------------

export const CENTRAL_SECTORS: readonly SectorId[] = ['s5', 's6', 's7', 's8'];

/** The tactical-card sector for an area: 'central' for central/pole areas, else the outer sector. */
export function tacticalSectorOf(areaSector: SectorId): TacticalSector {
  if (areaSector === 'np' || CENTRAL_SECTORS.includes(areaSector)) return 'central';
  return areaSector;
}

// ---------------------------------------------------------------------------
// The 8 tactical cards — one per sietch, pairing the sietch with its own sector
// (e.g. "North-East Sector — Gara Kulon"). Generated from board.ts so it stays in
// sync with the verified board. The 2 central sietches form the "two central cards".
// ---------------------------------------------------------------------------

export const TACTICAL_CARDS: readonly TacticalCard[] = Object.values(AREAS)
  .filter((a) => a.sietch)
  .map((a) => ({ id: `tac_${a.id}`, sietchId: a.id, sector: tacticalSectorOf(a.sector) }))
  .sort((x, y) => x.sietchId.localeCompare(y.sietchId));

/** Two tactical cards share a sector (central counts as one), which forbids pairing them. */
export function sameTacticalSector(a: TacticalSector, b: TacticalSector): boolean {
  return a === b;
}

// ---------------------------------------------------------------------------
// Phase sequence
// ---------------------------------------------------------------------------

export const PHASE_ORDER: readonly RoundPhase[] = [
  'start',
  'vehicle_placement',
  'action_resolution',
  'desert_hazards',
  'spice_harvesting',
  'end',
];

/** The phase after `p`, or null after the final ('end') phase. */
export function nextPhase(p: RoundPhase): RoundPhase | null {
  const i = PHASE_ORDER.indexOf(p);
  return i >= 0 && i < PHASE_ORDER.length - 1 ? PHASE_ORDER[i + 1] : null;
}

// ---------------------------------------------------------------------------
// Start-of-round tactical draw
// ---------------------------------------------------------------------------

export interface TacticalDraw {
  /** Harvesting sector for the round (first card's sector). */
  harvestingSector: TacticalSector;
  /** Target sietch area id (second eligible card's sietch). */
  targetSietchId: string;
  /** The harvesting card drawn. */
  harvestingCard: TacticalCard;
  /** The target card drawn. */
  targetCard: TacticalCard;
}

/**
 * Resolve the two start-of-round tactical draws from a pre-shuffled deck order.
 *
 * Rules: the 1st card sets the Harvesting Sector. The 2nd card sets the Target Sietch, but if
 * it shares the 1st card's sector or its sietch is already destroyed, discard and draw again
 * until a card with a different sector and a sietch still in play is found.
 *
 * `deck` is the shuffled card order (drawn from the front). `isDestroyed(sietchId)` reports
 * whether a sietch has been destroyed. Throws if the deck cannot satisfy the constraints.
 */
export function drawTacticalCards(
  deck: readonly TacticalCard[],
  isDestroyed: (sietchId: string) => boolean = () => false,
): TacticalDraw {
  if (deck.length < 2) throw new Error('tactical deck needs at least 2 cards');
  const harvestingCard = deck[0];
  const targetCard = deck
    .slice(1)
    .find((c) => !sameTacticalSector(c.sector, harvestingCard.sector) && !isDestroyed(c.sietchId));
  if (!targetCard) throw new Error('no eligible target-sietch card in deck');
  return {
    harvestingSector: harvestingCard.sector,
    targetSietchId: targetCard.sietchId,
    harvestingCard,
    targetCard,
  };
}

/**
 * Re-select a target sietch mid-round when the current target is destroyed: draw the next
 * eligible card (different sector from the harvesting sector, sietch still in play).
 * Returns the new target sietch area id, or null if none qualifies.
 */
export function reselectTargetSietch(
  deck: readonly TacticalCard[],
  harvestingSector: TacticalSector,
  isDestroyed: (sietchId: string) => boolean,
): string | null {
  const card = deck.find(
    (c) => !sameTacticalSector(c.sector, harvestingSector) && !isDestroyed(c.sietchId),
  );
  return card ? card.sietchId : null;
}

// ---------------------------------------------------------------------------
// End-of-round (solo additions)
// ---------------------------------------------------------------------------

/** Supremacy step gained automatically at end of each solo round. The Harkonnen win at 10. */
export const SUPREMACY_PER_ROUND = 1;
export const SUPREMACY_WIN = 10;

/** Atreides draws this many prescience cards each round in solo mode (2, not 3). */
export const PRESCIENCE_DRAW_SOLO = 2;
