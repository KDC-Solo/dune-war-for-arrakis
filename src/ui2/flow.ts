// The guide-bar flow: for any game state, the ONE next thing the player should do (PRD §6).
// M0 ships the round skeleton; M2+ deepen the action_resolution branch (die → directive → apply).

import type { GameState } from '../engine/state';
import { availability } from '../engine/spiceMustFlow';
import { gameOutcome } from '../engine/victory';

export interface GuideStep {
  /** Short imperative headline shown in the guide bar. */
  now: string;
  /** Optional supporting line. */
  detail?: string;
  /** Primary action: 'begin-round' | 'next-phase' | 'next-round' | null (die faces render instead). */
  action: 'begin-round' | 'next-phase' | 'next-round' | null;
  actionLabel?: string;
  /** Render the 5 die faces (action phase). */
  showDice?: boolean;
}

export function guideFor(s: GameState): GuideStep {
  const outcome = gameOutcome(s);
  if (outcome.winner) {
    return {
      now: outcome.winner === 'atreides' ? 'The Sleeper has awakened.' : 'The Baron rules Arrakis.',
      detail: outcome.reason,
      action: null,
    };
  }
  switch (s.phase) {
    case 'start':
      return {
        now: `Begin round ${s.round}`,
        detail: 'Draws the harvesting sector and target sietch, and places the vehicles.',
        action: 'begin-round',
        actionLabel: `Begin round ${s.round}`,
      };
    case 'vehicle_placement':
      return {
        now: 'Place the Harkonnen vehicles',
        detail: 'Set the harvesters, carryalls and ornithopters on the table as shown, then continue.',
        action: 'next-phase',
        actionLabel: 'Vehicles placed →',
      };
    case 'action_resolution':
      return {
        now: 'Roll the Harkonnen action die',
        detail: `Tap the face you rolled — ${availability(s.spice.markers).diceAvailable} dice this round. Record your own turns from the board or the 🜁 sheet.`,
        action: 'next-phase',
        actionLabel: 'Actions done →',
        showDice: true,
      };
    case 'desert_hazards':
      return {
        now: 'Desert hazards',
        detail: 'Resolve wormsigns, then roll Coriolis storms for exposed Harkonnen legions.',
        action: 'next-phase',
        actionLabel: 'Hazards done →',
      };
    case 'spice_harvesting':
      return {
        now: 'The spice must flow',
        detail: 'Collect the harvest and feed the imperium markers.',
        action: 'next-phase',
        actionLabel: 'Harvest applied →',
      };
    case 'end':
      return {
        now: `Round ${s.round} complete`,
        detail: 'Supremacy advances by 1 as the next round begins.',
        action: 'next-round',
        actionLabel: `Start round ${s.round + 1} →`,
      };
  }
}
