import { describe, it, expect } from 'vitest';
import {
  chooseFreeMountainArea,
  chooseEmptyDesertAreas,
  chooseSettlementForUnits,
  chooseWormsignDiscards,
  chooseLegionForLeader,
  chooseEliteSwaps,
  chooseTroopCarrierMove,
  chooseHunterSeekerTarget,
  chooseSpiesArea,
  recommendMove,
  recommendMoveOrAttack,
} from './cardChoices';
import { AREAS } from './board';
import { harkonnenDistance } from './movement';
import { sampleState } from '../ui/sampleState';
import type { GameState } from './state';

function s0(): GameState {
  return sampleState();
}

describe('chooseFreeMountainArea', () => {
  it('picks a mountain area with no legion, live sietch, settlement, or sandworm', () => {
    const s = s0();
    const area = chooseFreeMountainArea(s)!;
    expect(AREAS[area].terrain).toBe('mountain');
    expect(s.legions.some((l) => l.area === area)).toBe(false);
    expect(s.sietches.some((si) => si.area === area && !si.destroyed)).toBe(false);
    expect(s.settlements.some((st) => st.area === area && !st.destroyed)).toBe(false);
  });

  it('prefers the mountain closest to the target sietch', () => {
    const s = s0();
    const area = chooseFreeMountainArea(s)!;
    const d = harkonnenDistance(area, s.targetSietchId!);
    // no other free mountain is strictly closer
    for (const id of Object.keys(AREAS)) {
      if (AREAS[id].terrain !== 'mountain') continue;
      if (s.legions.some((l) => l.area === id)) continue;
      if (s.sietches.some((si) => si.area === id && !si.destroyed)) continue;
      expect(harkonnenDistance(id, s.targetSietchId!)).toBeGreaterThanOrEqual(d);
    }
  });
});

describe('chooseEmptyDesertAreas', () => {
  it('returns distinct empty desert areas, avoiding wormsigns when possible', () => {
    const s = s0();
    s.wormsigns = [{ area: 's1_10' }];
    const areas = chooseEmptyDesertAreas(s, 3);
    expect(new Set(areas).size).toBe(3);
    for (const a of areas) {
      expect(AREAS[a].terrain).toBe('desert');
      expect(s.legions.some((l) => l.area === a)).toBe(false);
      expect(a).not.toBe('s1_10'); // enough clean desert exists to avoid the wormsign
    }
  });
});

describe('chooseSettlementForUnits', () => {
  it('picks a live settlement with room, preferring the strongest garrison', () => {
    const s = s0();
    // carthag holds the only settlement legion (2 regulars) → highest CP settlement
    expect(chooseSettlementForUnits(s, 2)).toBe('carthag');
  });

  it('respects an allowlist', () => {
    const s = s0();
    expect(chooseSettlementForUnits(s, 2, ['arrakeen'])).toBe('arrakeen');
  });

  it('skips full settlements', () => {
    const s = s0();
    const carthag = s.legions.find((l) => l.area === 'carthag')!;
    carthag.units.regular = 6; // at the stacking limit
    expect(chooseSettlementForUnits(s, 2)).not.toBe('carthag');
  });
});

describe('chooseWormsignDiscards', () => {
  it('discards the signs nearest Harkonnen legions first', () => {
    const s = s0();
    s.wormsigns = [{ area: 's4_1' }, { area: 's1_10' }];
    const picks = chooseWormsignDiscards(s, 1);
    // s1_10 is in the same sector as the forward legion at s1_11 → nearer
    expect(picks).toEqual(['s1_10']);
  });

  it('caps at the number of wormsigns on the board', () => {
    const s = s0();
    s.wormsigns = [{ area: 's1_10' }];
    expect(chooseWormsignDiscards(s, 3)).toHaveLength(1);
  });
});

describe('chooseLegionForLeader', () => {
  it('sends the leader to the legion with an attack available', () => {
    const s = s0();
    // s1_11 legion is adjacent to the beatable target sietch defender
    expect(chooseLegionForLeader(s)).toBe('s1_11');
  });

  it('honours the legion filter', () => {
    const s = s0();
    expect(chooseLegionForLeader(s, (l) => l.area === 'carthag')).toBe('carthag');
    expect(chooseLegionForLeader(s, () => false)).toBeNull();
  });
});

describe('chooseEliteSwaps', () => {
  it('upgrades elites in the legion nearest the target first', () => {
    const s = s0();
    const swaps = chooseEliteSwaps(s, 2);
    expect(swaps).toEqual([{ area: 's1_11', count: 1 }]); // only 1 elite on the board
  });

  it('is capped by the Sardaukar reserve', () => {
    const s = s0();
    s.harkonnenReserve.units.special_elite = 0;
    expect(chooseEliteSwaps(s, 2)).toEqual([]);
  });
});

describe('chooseTroopCarrierMove', () => {
  it('teleports a settlement legion toward the front, never backwards', () => {
    const s = s0();
    const mv = chooseTroopCarrierMove(s)!;
    expect(mv.from).toBe('carthag');
    expect(mv.to).toBe('s1_11');
    expect(harkonnenDistance(mv.to, s.targetSietchId!)).toBeLessThan(
      harkonnenDistance(mv.from, s.targetSietchId!),
    );
  });

  it('returns null when no forward move exists', () => {
    const s = s0();
    // remove the forward legion — only the settlement legion remains
    s.legions = s.legions.filter((l) => l.area !== 's1_11');
    expect(chooseTroopCarrierMove(s)).toBeNull();
  });
});

describe('chooseHunterSeekerTarget', () => {
  it('finds an enemy named leader sharing a sector with a Harkonnen legion', () => {
    const s = s0();
    s.legions
      .find((l) => l.faction === 'atreides')!
      .leaders.push({ kind: 'named', faction: 'atreides', name: 'Gurney Halleck' });
    // gara_kulon (s1) shares sector s1 with the legion at s1_11
    expect(chooseHunterSeekerTarget(s)).toEqual({
      leader: 'Gurney Halleck',
      area: 'gara_kulon',
    });
  });

  it('returns null when no named leader is in reach', () => {
    expect(chooseHunterSeekerTarget(s0())).toBeNull();
  });
});

describe('chooseSpiesArea', () => {
  it('prefers the unrevealed target sietch', () => {
    const s = s0();
    expect(chooseSpiesArea(s)).toBe(s.targetSietchId);
  });

  it('falls back to the biggest token stack when the target is revealed', () => {
    const s = s0();
    s.sietches.find((si) => si.area === s.targetSietchId)!.revealed = true;
    const atr = s.legions.find((l) => l.faction === 'atreides')!;
    atr.deploymentTokens = 3;
    expect(chooseSpiesArea(s)).toBe(atr.area);
  });
});

describe('recommendMove / recommendMoveOrAttack', () => {
  it('recommendMoveOrAttack finds the sietch attack in the sample state', () => {
    const a = recommendMoveOrAttack(s0())!;
    expect(a.kind).toBe('attack_sietch');
  });

  it('restricting to a rear legion yields a move instead', () => {
    const s = s0();
    const a = recommendMoveOrAttack(s, (l) => l.area === 'carthag')!;
    expect(a.kind).toBe('move');
  });

  it('recommendMove returns null when the filtered set cannot move', () => {
    expect(recommendMove(s0(), () => false)).toBeNull();
  });
});
