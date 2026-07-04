import { describe, it, expect } from 'vitest';
import { revealDeploymentTokens } from './revealTokens';
import { applyHarkonnenHits } from './combat';
import { emptyLegion, type GameState, type Legion } from './state';
import { sampleState } from '../ui/sampleState';

function leg(faction: Legion['faction'], area: string, over: Partial<Legion>): Legion {
  return { ...emptyLegion(faction, area), ...over };
}

function stateWith(over: Partial<GameState>): GameState {
  return { ...sampleState(), ...over };
}

describe('revealDeploymentTokens', () => {
  it('replaces a Harkonnen legion\'s tokens with units and returns the markers to the pool', () => {
    const area = 'carthag';
    const before = leg('harkonnen', area, { deploymentTokens: 2 });
    const s = stateWith({
      legions: [before],
      harkonnenReserve: { ...sampleState().harkonnenReserve, deploymentTokens: 8 },
    });

    const next = revealDeploymentTokens(s, area, 'harkonnen', { regular: 2, elite: 0, special_elite: 0 });
    const after = next.legions.find((l) => l.faction === 'harkonnen' && l.area === area)!;

    expect(after.deploymentTokens).toBe(0);
    expect(after.units.regular).toBe(2);
    // The 2 freed markers go back to the 8 already in the pool.
    expect(next.harkonnenReserve.deploymentTokens).toBe(10);
  });

  it('caps the returned tokens at the pool size', () => {
    const area = 'carthag';
    const s = stateWith({
      legions: [leg('harkonnen', area, { deploymentTokens: 2 })],
      harkonnenReserve: { ...sampleState().harkonnenReserve, deploymentTokens: 11 },
    });
    const next = revealDeploymentTokens(s, area, 'harkonnen', { regular: 2, elite: 0, special_elite: 0 });
    expect(next.harkonnenReserve.deploymentTokens).toBe(12);
  });

  it('reveals Atreides tokens to units without crediting any pool', () => {
    const area = 'sihaya_ridge';
    const s = stateWith({ legions: [leg('atreides', area, { deploymentTokens: 1, units: { regular: 1, elite: 0, special_elite: 0 } })] });
    const before = s.harkonnenReserve.deploymentTokens;

    const next = revealDeploymentTokens(s, area, 'atreides', { regular: 0, elite: 1, special_elite: 0 });
    const after = next.legions.find((l) => l.faction === 'atreides' && l.area === area)!;

    expect(after.deploymentTokens).toBe(0);
    expect(after.units).toEqual({ regular: 1, elite: 1, special_elite: 0 });
    expect(next.harkonnenReserve.deploymentTokens).toBe(before);
  });

  it('reveals a Bashar from a Harkonnen token, drawing the figure from the reserve', () => {
    const area = 'carthag';
    const s = stateWith({
      legions: [leg('harkonnen', area, { deploymentTokens: 1 })],
      harkonnenReserve: { ...sampleState().harkonnenReserve, bashars: 2 },
    });
    const next = revealDeploymentTokens(s, area, 'harkonnen', { regular: 1, elite: 0, special_elite: 0 }, 1);
    const after = next.legions.find((l) => l.faction === 'harkonnen' && l.area === area)!;
    expect(after.leaders.filter((x) => x.kind === 'generic')).toHaveLength(1);
    expect(next.harkonnenReserve.bashars).toBe(1);
  });

  it('an empty Bashar reserve still reveals the leader (physical figures exist) without going negative', () => {
    const area = 'carthag';
    const s = stateWith({
      legions: [leg('harkonnen', area, { deploymentTokens: 1 })],
      harkonnenReserve: { ...sampleState().harkonnenReserve, bashars: 0 },
    });
    const next = revealDeploymentTokens(s, area, 'harkonnen', { regular: 0, elite: 0, special_elite: 0 }, 1);
    expect(next.legions[0].leaders).toHaveLength(1);
    expect(next.harkonnenReserve.bashars).toBe(0);
  });

  it('ignores the bashars parameter for Atreides tokens (they only ever show units)', () => {
    const area = 'sihaya_ridge';
    const s = stateWith({ legions: [leg('atreides', area, { deploymentTokens: 1 })] });
    const next = revealDeploymentTokens(s, area, 'atreides', { regular: 1, elite: 0, special_elite: 0 }, 1);
    expect(next.legions[0].leaders).toHaveLength(0);
  });

  it('is a no-op when the legion has no tokens', () => {
    const area = 'carthag';
    const s = stateWith({ legions: [leg('harkonnen', area, { units: { regular: 3, elite: 0, special_elite: 0 } })] });
    expect(revealDeploymentTokens(s, area, 'harkonnen', { regular: 1, elite: 0, special_elite: 0 })).toBe(s);
  });

  it('lets the revealed units then be taken as casualties (the gap this closes)', () => {
    // A tokens-only legion is immortal in combat: applyHarkonnenHits never removes tokens.
    const tokensOnly = leg('harkonnen', 'carthag', { deploymentTokens: 2 });
    expect(applyHarkonnenHits(tokensOnly, 5).legion.deploymentTokens).toBe(2); // unchanged — the bug

    // After revealing, the units can actually die.
    const s = stateWith({ legions: [tokensOnly] });
    const revealed = revealDeploymentTokens(s, 'carthag', 'harkonnen', { regular: 2, elite: 0, special_elite: 0 });
    const legion = revealed.legions[0];
    const hit = applyHarkonnenHits(legion, 5);
    expect(hit.legion.units.regular).toBe(0);
    expect(hit.casualties.units).toBe(2);
  });
});
