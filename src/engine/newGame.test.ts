import { describe, it, expect } from 'vitest';
import { newGameState } from './newGame';
import { AREA_IDS, AREAS } from './board';

describe('newGameState', () => {
  const s = newGameState();

  it('places all 6 Harkonnen settlements with their board ranks', () => {
    expect(s.settlements).toHaveLength(6);
    const arrakeen = s.settlements.find((x) => x.area === 'arrakeen');
    expect(arrakeen?.rank).toBe(3);
    expect(s.settlements.every((x) => !x.destroyed)).toBe(true);
  });

  it('places all 8 sietches facedown (rank hidden, not revealed)', () => {
    expect(s.sietches).toHaveLength(8);
    expect(s.sietches.every((x) => x.rank === null && !x.revealed && !x.destroyed)).toBe(true);
  });

  it('seeds one Atreides legion (token + Naib) on every sietch, and no Harkonnen on the board', () => {
    const sietchAreas = AREA_IDS.filter((id) => AREAS[id].sietch);
    expect(s.legions).toHaveLength(sietchAreas.length);
    expect(s.legions.every((l) => l.faction === 'atreides')).toBe(true);
    for (const a of sietchAreas) {
      const leg = s.legions.find((l) => l.area === a)!;
      expect(leg.deploymentTokens).toBe(1);
      expect(leg.leaders).toEqual([{ kind: 'generic', faction: 'atreides' }]);
    }
  });

  it('starts the imperium markers at the top step (max action dice, no bans)', () => {
    expect(s.spice.markers).toEqual({ choam: 1, spacing_guild: 1, landsraad: 1 });
    expect(s.spice.activeBans).toEqual([]);
  });

  it('starts tracks at zero in round 1', () => {
    expect(s.round).toBe(1);
    expect(s.tracks.supremacy).toBe(0);
    expect(s.tracks.prescience).toEqual([0, 0, 0]);
  });

  it('puts the 12 starting deployment tokens and start-in-play leaders in the reserve', () => {
    expect(s.harkonnenReserve.deploymentTokens).toBe(12);
    expect(s.harkonnenReserve.units).toEqual({ regular: 16, elite: 8, special_elite: 8 });
    expect(s.harkonnenReserve.namedLeaders).toEqual(
      expect.arrayContaining(['Beast Rabban', 'Baron Harkonnen', 'Captain Aramsham']),
    );
  });

  it('has no vehicles, wormsigns, sandworms, or this-round draws yet', () => {
    expect(s.vehicles).toEqual([]);
    expect(s.wormsigns).toEqual([]);
    expect(s.sandworms).toEqual([]);
    expect(s.harvestingSector).toBeNull();
    expect(s.targetSietchId).toBeNull();
  });
});
