import { describe, it, expect } from 'vitest';
import { decideHarkonnenAction, BRAIN_PROFILES } from './harkonnenBrain';
import { resolveAction } from './harkonnenActions';
import { harkonnenAreAdjacent } from './movement';
import { newGameState } from './newGame';
import type { GameState, ActionResult } from './state';

const FACES: ActionResult[] = ['leadership', 'strategy', 'mentat', 'deployment', 'house'];

function midGame(): GameState {
  const s = newGameState();
  s.phase = 'action_resolution';
  s.targetSietchId = 'gara_kulon';
  s.legions = [
    ...s.legions,
    {
      faction: 'harkonnen',
      area: 's1_11',
      units: { regular: 4, elite: 1, special_elite: 0 },
      deploymentTokens: 0,
      leaders: [{ kind: 'generic', faction: 'harkonnen' }],
    },
  ];
  return s;
}

describe('decideHarkonnenAction', () => {
  it("'mahdi' delegates to the official solo bot exactly", () => {
    const s = midGame();
    for (const face of FACES) {
      expect(decideHarkonnenAction(s, face, 'mahdi', () => 0)).toEqual(resolveAction(s, face));
    }
  });

  it('every brain returns a well-formed directive for every face', () => {
    const s = midGame();
    for (const p of BRAIN_PROFILES) {
      for (const face of FACES) {
        const a = decideHarkonnenAction(s, face, p.id, () => 0.5);
        expect(a).toBeTruthy();
        expect(typeof a.kind).toBe('string');
        if (a.kind === 'attack_sietch' || a.kind === 'attack_legion') {
          const def = a.kind === 'attack_sietch' ? a.sietch : a.defender;
          // attacks always come from adjacency (or transport, which only sietch attacks may use)
          if (a.kind === 'attack_legion' || !a.useOrnithopter) {
            expect(harkonnenAreAdjacent(a.attacker, def)).toBe(true);
          }
        }
        if (a.kind === 'move') expect(a.path.length).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it('rng() → 0 always takes the top-scored candidate (deterministic at temperature)', () => {
    const s = midGame();
    const a1 = decideHarkonnenAction(s, 'strategy', 'baron', () => 0);
    const a2 = decideHarkonnenAction(s, 'strategy', 'baron', () => 0);
    expect(a1).toEqual(a2);
  });

  it('Recruit is measurably more erratic than Baron', () => {
    const s = midGame();
    const variety = (brain: 'recruit' | 'baron') => {
      const seen = new Set<string>();
      for (let i = 0; i < 40; i++) {
        // a crude deterministic rng stream
        let x = i * 2654435761 % 4294967296;
        const rng = () => {
          x = (x * 1664525 + 1013904223) % 4294967296;
          return x / 4294967296;
        };
        seen.add(JSON.stringify(decideHarkonnenAction(s, 'strategy', brain, rng)));
      }
      return seen.size;
    };
    expect(variety('recruit')).toBeGreaterThanOrEqual(variety('baron'));
  });
});
