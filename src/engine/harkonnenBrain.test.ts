import { describe, it, expect } from 'vitest';
import {
  decideHarkonnenAction,
  ensureBrainPlan,
  atreidesReplyThreat,
  BRAIN_PROFILES,
  BRAIN_LABELS,
  type BrainId,
} from './harkonnenBrain';
import { resolveAction, resolveDeployment } from './harkonnenActions';
import { harkonnenAreAdjacent, harkonnenNeighbors } from './movement';
import { newGameState } from './newGame';
import { AREAS } from './board';
import type { GameState, ActionResult } from './state';

/** A neighbor of `area` that is not a sietch (sietch garrisons don't count as threats). */
function fieldNeighborOf(area: string): string {
  const n = harkonnenNeighbors(area).find((a) => !AREAS[a].sietch);
  if (!n) throw new Error(`no non-sietch neighbor of ${area}`);
  return n;
}

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

  it('every difficulty has a label and a profile (including Mentat)', () => {
    const ids: BrainId[] = ['mahdi', 'recruit', 'bashar', 'baron', 'mentat'];
    for (const id of ids) expect(BRAIN_LABELS[id]).toBeTruthy();
    expect(BRAIN_PROFILES.map((p) => p.id)).toContain('mentat');
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

describe('persistent plans (ensureBrainPlan)', () => {
  it('mahdi and recruit never plan; recruit clears a stale plan', () => {
    const s = midGame();
    expect(ensureBrainPlan(s, 'mahdi')).toBe(s);
    expect(ensureBrainPlan(s, 'recruit')).toBe(s);
    const stale = { ...s, brainPlan: { brain: 'baron', kind: 'push' as const, area: 'gara_kulon', round: 1 } };
    expect(ensureBrainPlan(stale, 'recruit').brainPlan).toBeNull();
  });

  it('a planning brain forms a push plan and keeps it while valid (same state object back)', () => {
    const s = ensureBrainPlan(midGame(), 'baron');
    expect(s.brainPlan).toBeTruthy();
    expect(s.brainPlan?.brain).toBe('baron');
    expect(s.brainPlan?.kind).toBe('push');
    expect(s.sietches.some((si) => si.area === s.brainPlan?.area && !si.destroyed)).toBe(true);
    expect(ensureBrainPlan(s, 'baron')).toBe(s); // idempotent while valid
  });

  it('plans expire after the profile horizon and are re-made', () => {
    const s = ensureBrainPlan(midGame(), 'bashar'); // bashar horizon = 2
    const later = { ...s, round: s.round + 2 };
    const replanned = ensureBrainPlan(later, 'bashar');
    expect(replanned).not.toBe(later);
    expect(replanned.brainPlan?.round).toBe(later.round);
  });

  it('a different brain re-plans from scratch', () => {
    const s = ensureBrainPlan(midGame(), 'baron');
    const swapped = ensureBrainPlan(s, 'mentat');
    expect(swapped.brainPlan?.brain).toBe('mentat');
  });

  it('a big Atreides stack on a weak settlement flips a watchful brain to defend', () => {
    const s = midGame();
    const next = fieldNeighborOf('carthag');
    s.legions = [
      ...s.legions,
      {
        faction: 'atreides',
        area: next,
        units: { regular: 8, elite: 4, special_elite: 2 },
        deploymentTokens: 0,
        leaders: [],
      },
    ];
    const planned = ensureBrainPlan(s, 'baron');
    expect(planned.brainPlan?.kind).toBe('defend');
    // The defended settlement is one the stack actually presses on.
    const area = planned.brainPlan?.area ?? '';
    expect(area === next || harkonnenAreAdjacent(next, area)).toBe(true);
  });
});

describe('deployment variants', () => {
  it('resolveDeployment honors an explicit settlement order', () => {
    const s = midGame();
    const live = s.settlements.filter((st) => !st.destroyed).map((st) => st.area);
    expect(live.length).toBeGreaterThanOrEqual(2);
    const a = resolveDeployment(s, [live[0]]);
    const b = resolveDeployment(s, [live[1]]);
    if (a.kind === 'deploy' && b.kind === 'deploy') {
      expect(a.placements[0].settlement).toBe(live[0]);
      expect(b.placements[0].settlement).toBe(live[1]);
    } else {
      throw new Error('expected deploy actions');
    }
  });

  it('a defending brain lands the drop on the settlement its plan defends', () => {
    const s = midGame();
    const next = fieldNeighborOf('carthag');
    s.legions = [
      ...s.legions,
      {
        faction: 'atreides',
        area: next,
        units: { regular: 8, elite: 4, special_elite: 2 },
        deploymentTokens: 0,
        leaders: [],
      },
    ];
    const planned = ensureBrainPlan(s, 'baron');
    expect(planned.brainPlan?.kind).toBe('defend');
    const a = decideHarkonnenAction(planned, 'deployment', 'baron', () => 0);
    expect(a.kind).toBe('deploy');
    if (a.kind === 'deploy') {
      expect(a.placements.some((p) => p.settlement === planned.brainPlan?.area)).toBe(true);
    }
  });
});

describe('lookahead (Mentat)', () => {
  it('atreidesReplyThreat is 0 with no Atreides pressure and positive with a hanging piece', () => {
    const s = newGameState();
    s.legions = s.legions.filter((l) => l.faction !== 'atreides');
    expect(atreidesReplyThreat(s)).toBe(0);
    // A lone weak Harkonnen legion next to a big Atreides stack is a hanging piece.
    const area = harkonnenNeighbors('gara_kulon')[0];
    s.legions = [
      { faction: 'harkonnen', area, units: { regular: 1, elite: 0, special_elite: 0 }, deploymentTokens: 0, leaders: [] },
      { faction: 'atreides', area: 'gara_kulon', units: { regular: 8, elite: 3, special_elite: 0 }, deploymentTokens: 0, leaders: [] },
    ];
    expect(atreidesReplyThreat(s)).toBeGreaterThan(0);
  });

  it('mentat returns well-formed directives with plans engaged', () => {
    const s = ensureBrainPlan(midGame(), 'mentat');
    for (const face of FACES) {
      const a = decideHarkonnenAction(s, face, 'mentat', () => 0);
      expect(typeof a.kind).toBe('string');
    }
  });
});
