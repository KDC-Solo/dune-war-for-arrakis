// Apply a resolved Harkonnen action to the game state (the start of the round driver).
// Pure: returns a new state. Only the unambiguous, non-dice actions are auto-applied
// (move, deploy, house upgrade, place vehicles); attacks and card draws are left to the player
// (`applied: false`) because they involve physical dice / the card subsystem.

import type { GameState, Legion, UnitType } from './state';
import { emptyLegion } from './state';
import type { HarkonnenAction } from './harkonnenActions';
import { placeHarvesters, placeOrnithopters } from './vehiclePlacement';

export interface ApplyResult {
  state: GameState;
  /** True if the engine mutated state; false if the player must resolve it manually. */
  applied: boolean;
  /** Explanation when not auto-applied, or a summary of what changed. */
  note?: string;
}

const clamp0 = (n: number) => Math.max(0, n);

function mergeInto(target: Legion, src: Legion): Legion {
  return {
    ...target,
    units: {
      regular: target.units.regular + src.units.regular,
      elite: target.units.elite + src.units.elite,
      special_elite: target.units.special_elite + src.units.special_elite,
    },
    deploymentTokens: target.deploymentTokens + src.deploymentTokens,
    leaders: [...target.leaders, ...src.leaders],
  };
}

/** Add a legion to the list, merging into an existing same-faction legion in that area. */
export function upsertLegion(legions: Legion[], legion: Legion): Legion[] {
  const i = legions.findIndex((l) => l.faction === legion.faction && l.area === legion.area);
  if (i < 0) return [...legions, legion];
  return legions.map((l, idx) => (idx === i ? mergeInto(l, legion) : l));
}

function harkonnenAt(s: GameState, area: string): Legion | undefined {
  return s.legions.find((l) => l.faction === 'harkonnen' && l.area === area);
}

// --- move ------------------------------------------------------------------

function applyMove(s: GameState, from: string, to: string): ApplyResult {
  const mover = harkonnenAt(s, from);
  if (!mover) return { state: s, applied: false, note: 'no Harkonnen legion to move' };

  let legions = s.legions.filter((l) => l !== mover);
  legions = upsertLegion(legions, { ...mover, area: to });

  let reserve = s.harkonnenReserve;
  // When a Harkonnen legion leaves a settlement, drop 2 deployment tokens there.
  const leftSettlement = s.settlements.some((st) => st.area === from && !st.destroyed);
  if (leftSettlement) {
    const tokens = Math.min(2, reserve.deploymentTokens);
    if (tokens > 0) {
      legions = upsertLegion(legions, { ...emptyLegion('harkonnen', from), deploymentTokens: tokens });
      reserve = { ...reserve, deploymentTokens: reserve.deploymentTokens - tokens };
    }
  }
  return {
    state: { ...s, legions, harkonnenReserve: reserve },
    applied: true,
    note: leftSettlement ? 'Legion moved; 2 deployment tokens left in the settlement.' : 'Legion moved.',
  };
}

// --- deploy ----------------------------------------------------------------

function applyDeploy(s: GameState, placements: Extract<HarkonnenAction, { kind: 'deploy' }>['placements']): ApplyResult {
  let legions = [...s.legions];
  let units = { ...s.harkonnenReserve.units };
  let bashars = s.harkonnenReserve.bashars;
  let namedLeaders = [...s.harkonnenReserve.namedLeaders];

  for (const p of placements) {
    const add = emptyLegion('harkonnen', p.settlement);
    (Object.keys(p.units) as UnitType[]).forEach((t) => {
      const n = Math.min(p.units[t], units[t]);
      add.units[t] = n;
      units[t] = clamp0(units[t] - n);
    });
    if (p.leader === 'Bashar' && bashars > 0) {
      add.leaders.push({ kind: 'generic', faction: 'harkonnen' });
      bashars -= 1;
    } else if (p.leader && namedLeaders.includes(p.leader)) {
      add.leaders.push({ kind: 'named', faction: 'harkonnen', name: p.leader });
      namedLeaders = namedLeaders.filter((n) => n !== p.leader);
    }
    legions = upsertLegion(legions, add);
  }
  return {
    state: { ...s, legions, harkonnenReserve: { ...s.harkonnenReserve, units, bashars, namedLeaders } },
    applied: true,
    note: 'Units deployed from the reserve.',
  };
}

// --- house: replace regulars with elites -----------------------------------

function applyHouseReplace(s: GameState, area: string, count: number): ApplyResult {
  const leg = harkonnenAt(s, area);
  if (!leg) return { state: s, applied: false, note: 'no legion to upgrade' };
  const n = Math.min(count, leg.units.regular, s.harkonnenReserve.units.elite);
  if (n <= 0) return { state: s, applied: false, note: 'no elites available / no regulars to replace' };

  const legions = s.legions.map((l) =>
    l === leg ? { ...l, units: { ...l.units, regular: l.units.regular - n, elite: l.units.elite + n } } : l,
  );
  const units = {
    ...s.harkonnenReserve.units,
    regular: s.harkonnenReserve.units.regular + n, // freed regulars return to the pool
    elite: clamp0(s.harkonnenReserve.units.elite - n),
  };
  return {
    state: { ...s, legions, harkonnenReserve: { ...s.harkonnenReserve, units } },
    applied: true,
    note: `Upgraded ${n} regular${n === 1 ? '' : 's'} to elite.`,
  };
}

// --- house: place vehicles (1 harvester + 1 ornithopter) -------------------

function applyPlaceVehicles(s: GameState): ApplyResult {
  const harvester = placeHarvesters(s, 1)[0];
  const ornithopter = placeOrnithopters(s, 1)[0];
  const vehicles = [...s.vehicles];
  if (harvester) vehicles.push({ type: 'harvester', location: harvester });
  if (ornithopter) vehicles.push({ type: 'ornithopter', location: ornithopter });
  if (vehicles.length === s.vehicles.length) {
    return { state: s, applied: false, note: 'no legal vehicle placement available' };
  }
  return { state: { ...s, vehicles }, applied: true, note: 'Placed 1 harvester + 1 ornithopter.' };
}

// --- dispatch --------------------------------------------------------------

/** Apply a Harkonnen action to the state where unambiguous; otherwise report it's player-resolved. */
export function applyHarkonnenAction(s: GameState, a: HarkonnenAction): ApplyResult {
  switch (a.kind) {
    case 'move':
      return applyMove(s, a.path[0], a.path[a.path.length - 1]);
    case 'deploy':
      return applyDeploy(s, a.placements);
    case 'house_replace':
      return applyHouseReplace(s, a.legion, a.count);
    case 'house_place_vehicles':
      return applyPlaceVehicles(s);
    case 'attack_sietch':
      return { state: s, applied: false, note: 'Resolve the battle on the board (roll combat dice).' };
    case 'attack_legion':
      return { state: s, applied: false, note: 'Resolve the battle on the board (roll combat dice).' };
    case 'mentat':
      return { state: s, applied: false, note: 'Draw 2 planning cards and play them (card rules).' };
    case 'none':
      return { state: s, applied: false, note: a.reason };
  }
}

/** Whether an action kind is auto-applied by the engine (vs player-resolved). */
export function isAutoApplied(a: HarkonnenAction): boolean {
  return a.kind === 'move' || a.kind === 'deploy' || a.kind === 'house_replace' || a.kind === 'house_place_vehicles';
}
