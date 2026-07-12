import { describe, it, expect } from 'vitest';
import {
  removeOrnithopterForSector,
  removeCarryallForSector,
  hasCarryallForSector,
} from './vehiclePlacement';
import { transportNeeded, airZonesConnectedToSector, harkonnenNeighbors } from './movement';
import { AIR_ZONES } from './board';
import { sampleState } from '../ui/sampleState';
import type { GameState } from './state';

const connected = airZonesConnectedToSector('s1');
const unconnected = AIR_ZONES.map((z) => z.id).find((id) => !connected.includes(id))!;

function withVehicles(vehicles: GameState['vehicles']): GameState {
  const s = sampleState();
  s.vehicles = vehicles;
  return s;
}

describe('removeOrnithopterForSector', () => {
  it('removes an ornithopter from a zone connected to the sector', () => {
    const s = withVehicles([
      { type: 'ornithopter', location: connected[0] },
      { type: 'ornithopter', location: unconnected },
    ]);
    const next = removeOrnithopterForSector(s, 's1')!;
    expect(next.vehicles).toEqual([{ type: 'ornithopter', location: unconnected }]);
  });

  it('falls back to any ornithopter when none is connected', () => {
    const s = withVehicles([{ type: 'ornithopter', location: unconnected }]);
    const next = removeOrnithopterForSector(s, 's1')!;
    expect(next.vehicles).toEqual([]);
  });

  it('returns null when no ornithopter is on the board', () => {
    const s = withVehicles([{ type: 'carryall', location: connected[0] }]);
    expect(removeOrnithopterForSector(s, 's1')).toBeNull();
  });

  it('never removes a carryall', () => {
    const s = withVehicles([
      { type: 'carryall', location: connected[0] },
      { type: 'ornithopter', location: connected[0] },
    ]);
    const next = removeOrnithopterForSector(s, 's1')!;
    expect(next.vehicles).toEqual([{ type: 'carryall', location: connected[0] }]);
  });
});

describe('carryall rescue helpers', () => {
  it('hasCarryallForSector sees only connected carryalls', () => {
    expect(hasCarryallForSector(withVehicles([{ type: 'carryall', location: connected[0] }]), 's1')).toBe(true);
    expect(hasCarryallForSector(withVehicles([{ type: 'carryall', location: unconnected }]), 's1')).toBe(false);
    expect(hasCarryallForSector(withVehicles([{ type: 'ornithopter', location: connected[0] }]), 's1')).toBe(false);
  });

  it('removeCarryallForSector removes exactly one connected carryall (no fallback)', () => {
    const s = withVehicles([
      { type: 'carryall', location: connected[0] },
      { type: 'harvester', location: 's1_10' },
    ]);
    const next = removeCarryallForSector(s, 's1')!;
    expect(next.vehicles).toEqual([{ type: 'harvester', location: 's1_10' }]);
    expect(removeCarryallForSector(withVehicles([{ type: 'carryall', location: unconnected }]), 's1')).toBeNull();
  });
});

describe('transportNeeded', () => {
  it('is false for a ground-adjacent destination and true beyond it', () => {
    const from = 'carthag';
    const nbrs = harkonnenNeighbors(from);
    expect(transportNeeded(from, nbrs[0])).toBe(false);
    // A neighbour-of-neighbour that is not itself adjacent needs the ornithopter jump.
    const twoAway = harkonnenNeighbors(nbrs[0]).find((n) => n !== from && !nbrs.includes(n))!;
    expect(transportNeeded(from, twoAway)).toBe(true);
  });
});
