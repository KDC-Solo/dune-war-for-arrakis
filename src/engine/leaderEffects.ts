// Named-leader special-action (red action) resolution.
//
// Each named leader occupies an action-die slot and has a special ability printed on its card
// (captured in leaders.ts `special`). This turns that ability into ordered play STEPS, reusing
// the shared effect-step machinery: deterministic steps (deck draws) auto-apply; moves, attacks,
// deployments and on-board replacements are player-resolved directives.

import type { GameState } from './state';
import { leaderByName, NAMED_LEADERS } from './leaders';
import { type EffectStep, type EffectResolution, draw, manual } from './effectSteps';

type StepFn = (s: GameState) => EffectStep;

const LEADER_STEPS: Record<string, StepFn[]> = {
  'Feyd-Rautha': [() => manual('Move and attack with the Legion containing Feyd-Rautha.')],
  'Thufir Hawat': [() => draw('house_harkonnen', 3)],
  'Beast Rabban': [
    () => manual('Move the Legion containing Beast Rabban, then move that Legion again to an adjacent Area.'),
  ],
  'Baron Harkonnen': [() => manual('Replace 3 Regular Units on the board with 3 Elite Units.')],
  // Solo override (fan-summary p9): "Draw 3 Corrino Ally planning cards and play them
  // immediately" — replaces the base card's draw-2-then-play-1.
  'Gaius Helen Mohiam': [() => draw('corrino_ally', 3)],
  'Captain Aramsham': [
    () => manual('Deploy 2 Regular Units, 1 Sardaukar Unit, and 1 Leader (Bashar or Named) in one or more Settlements.'),
  ],
  'Emperor Shaddam IV': [() => manual('Replace 3 Elite Units on the board with 3 Sardaukar Units.')],
};

/**
 * Resolve a named leader's special action into ordered play steps. Returns null if the name
 * isn't a known named leader. Leaders without a structured encoding fall back to a single
 * manual step carrying the printed special text.
 */
export function resolveLeaderSpecial(name: string, s: GameState): EffectResolution | null {
  const def = leaderByName(name);
  if (!def) return null;
  const fns = LEADER_STEPS[name];
  const steps = fns ? fns.map((fn) => fn(s)) : [manual(def.special)];
  return { id: name, name, steps };
}

/** Whether a named leader has a structured (non-fallback) special-action encoding. */
export function hasLeaderEncoding(name: string): boolean {
  return name in LEADER_STEPS;
}

/** All named-leader names (for UI listing). */
export const NAMED_LEADER_NAMES: readonly string[] = NAMED_LEADERS.map((l) => l.name);
