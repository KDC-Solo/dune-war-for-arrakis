// Game-state types for the Mahdi Solo Mode (headless, pure-TS).
//
// Source: docs/Dune_Rulebook_2_web.pdf (Mahdi Solo Mode p37+) and the fan summary
// (DuneWarForArrakis_v1.pdf p9). The player runs Atreides; this engine automates the
// Harkonnen. The physical board stays the source of truth — this models the state the
// AI rules need to decide the Harkonnen's actions.
//
// Board topology (areas / adjacency / sectors / sietch & settlement & testing-station
// LOCATIONS) lives in board.ts. This file models the *mutable* game state placed on top
// of that fixed topology.

import type { SectorId } from './board';

export type Faction = 'atreides' | 'harkonnen';

// ---------------------------------------------------------------------------
// Units & leaders
// ---------------------------------------------------------------------------

/** Unit tiers. `special_elite` = Sardaukar (Harkonnen) / Fedaykin (Atreides). */
export type UnitType = 'regular' | 'elite' | 'special_elite';

/** Generic leaders are Naib (Atreides) / Bashar (Harkonnen); named leaders are unique. */
export type LeaderKind = 'generic' | 'named';

export interface Leader {
  kind: LeaderKind;
  faction: Faction;
  /** Set for named leaders (e.g. "Beast Rabban"); omitted for generic Naib/Bashar. */
  name?: string;
  /** A named leader on the board may be in the regeneration tank (special action spent). */
  inRegenerationTank?: boolean;
}

/**
 * A legion = every unit + leader of one faction in one area.
 *
 * Harkonnen deployment tokens are tracked separately from revealed units: they are
 * facedown, count as 1 unit for stacking/movement, and have a fixed combat power of 2
 * (Mahdi solo special rule). Atreides deployment tokens behave the same way on the
 * board until revealed via guerrilla training / combat.
 */
export interface Legion {
  faction: Faction;
  /** Area id (see board.ts AREAS). */
  area: string;
  units: Record<UnitType, number>;
  /** Facedown deployment tokens present (each counts as 1 unit, combat power 2). */
  deploymentTokens: number;
  leaders: Leader[];
}

/** A legion with no pieces, used as a builder base. */
export function emptyLegion(faction: Faction, area: string): Legion {
  return {
    faction,
    area,
    units: { regular: 0, elite: 0, special_elite: 0 },
    deploymentTokens: 0,
    leaders: [],
  };
}

/** Total unit figures in a legion (excludes leaders; deployment tokens count as 1 unit). */
export function unitCount(l: Legion): number {
  return l.units.regular + l.units.elite + l.units.special_elite + l.deploymentTokens;
}

// ---------------------------------------------------------------------------
// Board features that carry mutable state (locations are fixed in board.ts)
// ---------------------------------------------------------------------------

/** Harkonnen settlement token (ranks are public). 6 at setup: Arrakeen III, Carthag II, 4 Pyon I. */
export interface SettlementState {
  area: string;
  rank: 1 | 2 | 3;
  destroyed: boolean;
}

/** Atreides sietch token (rank hidden until revealed). 8 at setup. */
export interface SietchState {
  area: string;
  /** Hidden rank; null while still facedown/unknown to the Harkonnen AI. */
  rank: 1 | 2 | 3 | null;
  revealed: boolean;
  destroyed: boolean;
}

/** Ecological testing station — 6 fixed areas (board.ts testingStation); hidden value is secret. */
export interface TestingStationState {
  area: string;
  /** Revealed when an Atreides legion enters the area (grants a prescience point). */
  revealed: boolean;
}

// ---------------------------------------------------------------------------
// Vehicles & desert hazards
// ---------------------------------------------------------------------------

export type VehicleType = 'harvester' | 'carryall' | 'ornithopter';

/**
 * Vehicles never move once placed. Harvesters sit in desert areas (location = area id);
 * carryalls and ornithopters sit in air zones (location = air-zone id, see board.ts AIR_ZONES).
 */
export interface Vehicle {
  type: VehicleType;
  location: string;
}

/** Facedown wormsign token on an area (resolved in the Desert Hazards phase). */
export interface Wormsign {
  area: string;
}

/** A sandworm placed on an area. */
export interface Sandworm {
  area: string;
}

// ---------------------------------------------------------------------------
// Tactical cards (solo): each card names a sector + a sietch
// ---------------------------------------------------------------------------

/** Sector reference on a tactical card. The two central cards treat all 4 central sectors as one. */
export type TacticalSector = SectorId | 'central';

export interface TacticalCard {
  id: string;
  sector: TacticalSector;
  /** Area id of the sietch named on the card. */
  sietchId: string;
}

// ---------------------------------------------------------------------------
// The Spice Must Flow board, imperium bans, and tracks
// ---------------------------------------------------------------------------

export type ImperiumPower = 'choam' | 'spacing_guild' | 'landsraad';

/**
 * The Spice Must Flow board. The 3 imperium markers sit on step rows; the lowest marker's
 * row (the "active row") sets how many Harkonnen action dice are available and how many
 * vehicles enter this round. A marker that drops to the bottom activates that power's ban.
 */
export interface SpiceMustFlow {
  /** Step (row) index of each imperium marker. Higher = better for Harkonnen. */
  markers: Record<ImperiumPower, number>;
  /** Bans currently active (a marker has reached the bottom). */
  activeBans: ImperiumPower[];
  /** Saved spice for a later round (max 1, per the spice reserve rule). */
  spiceReserve: 0 | 1;
}

export interface Tracks {
  /** Supremacy track 0..10; the Harkonnen win at 10. Advances 1/round in solo. */
  supremacy: number;
  /** The 3 prescience markers' positions (Atreides progress). */
  prescience: [number, number, number];
}

// ---------------------------------------------------------------------------
// Cards / decks (modeled as pile sizes; card identities added when resolvers need them)
// ---------------------------------------------------------------------------

export type PlanningDeck = 'house_atreides' | 'fremen_ally' | 'house_harkonnen' | 'corrino_ally';

export interface Decks {
  /** Draw-pile sizes per planning deck (exhausted decks are not reshuffled). */
  planning: Record<PlanningDeck, number>;
  planningDiscard: Record<PlanningDeck, number>;
  prescienceDeck: number;
  /** Harkonnen reinforcements deck (Corrino + Harkonnen cards fueling extra combat dice). */
  reinforcements: number;
  /** Facedown wormsign tokens available to draw. */
  wormsignPool: number;
  /** Remaining tactical cards (reshuffled each round-end in solo). */
  tacticalDeck: number;
}

// ---------------------------------------------------------------------------
// Action dice
// ---------------------------------------------------------------------------

/** The 5 action-die results. (Desert Power is an Atreides free action, not a die face.) */
export type ActionResult = 'leadership' | 'strategy' | 'mentat' | 'deployment' | 'house';

/** Dashboard slot caps: 3 per result for Harkonnen / 2 for Atreides, but deployment & house cap at 2. */
export const DASHBOARD_SLOTS: Record<Faction, Record<ActionResult, number>> = {
  harkonnen: { leadership: 3, strategy: 3, mentat: 3, deployment: 2, house: 2 },
  atreides: { leadership: 2, strategy: 2, mentat: 2, deployment: 2, house: 2 },
};

// ---------------------------------------------------------------------------
// Round structure
// ---------------------------------------------------------------------------

/** Mahdi solo round sequence. */
export type RoundPhase =
  | 'start' // draw planning + 2 prescience; draw harvesting-sector & target-sietch tactical cards
  | 'vehicle_placement' // Harkonnen: harvesters, carryalls, ornithopters
  | 'action_resolution' // alternate turns; Harkonnen die rolled & resolved per AI criteria
  | 'desert_hazards' // place/resolve wormsigns, then coriolis storms
  | 'spice_harvesting' // collect spice, feed imperium markers
  | 'end'; // advance supremacy, reshuffle tactical deck

// ---------------------------------------------------------------------------
// Reserve pools (pieces off the board, available to deploy)
// ---------------------------------------------------------------------------

export interface HarkonnenReserve {
  units: Record<UnitType, number>;
  /** Facedown deployment tokens available (black+silver pool). */
  deploymentTokens: number;
  /** Generic Bashar leaders available. */
  bashars: number;
  /** Named leaders available to deploy (by name). Beast Rabban / Feyd-Rautha deploy first. */
  namedLeaders: string[];
  /**
   * Named leaders killed in battle/storms. They sit in the regeneration tank (not the deploy
   * pool) until regenerated back into play. Optional for back-compat with older saves.
   */
  regenerationTank?: string[];
}

// ---------------------------------------------------------------------------
// Aggregate game state
// ---------------------------------------------------------------------------

export interface GameState {
  round: number;
  phase: RoundPhase;

  // Stateful board features (locations fixed in board.ts).
  settlements: SettlementState[];
  sietches: SietchState[];
  testingStations: TestingStationState[];

  // Pieces on the board.
  legions: Legion[];
  vehicles: Vehicle[];
  wormsigns: Wormsign[];
  sandworms: Sandworm[];

  // This round's solo draws.
  harvestingSector: TacticalSector | null;
  /** Area id of the current target sietch (may switch to a temporary one during movement). */
  targetSietchId: string | null;

  // Economy & tracks.
  spice: SpiceMustFlow;
  tracks: Tracks;
  decks: Decks;

  /** Harkonnen pieces off the board, available to deploy. */
  harkonnenReserve: HarkonnenReserve;

  /** Bene Gesserit tokens: held by Atreides + the shared reserve (5 total at start). */
  beneGesserit: { atreides: number; reserve: number };

  // Action-die pools (counts; faces are assigned as dice are rolled/placed).
  harkonnenUnusedDice: number;
  atreidesUnusedDice: number;
}

// ---------------------------------------------------------------------------
// Component reference counts (from the rulebook component list)
// ---------------------------------------------------------------------------

export const COMPONENTS = {
  vehicles: { harvester: 8, carryall: 3, ornithopter: 6 },
  harkonnenUnits: { regular: 16, elite: 8, sardaukar: 8 },
  atreidesUnits: { regular: 16, elite: 8, fedaykin: 6 },
  wormsignTokens: 16,
  imperiumMarkers: 3,
  prescienceMarkers: 3,
  beneGesseritTokens: 5,
  testingStations: 6,
  sietches: 8,
  harkonnenSettlements: 6,
  harkonnenStartingDeploymentTokens: 12,
  tacticalCards: 8,
} as const;
