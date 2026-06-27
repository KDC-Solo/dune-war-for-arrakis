// Named-leader data (Harkonnen + Corrino Ally), captured from the physical leader cards.
// Each named leader occupies one action-die slot on the dashboard and enters play under a
// specific condition. The Harkonnen AI prefers activating a named leader's special action over
// the regular action when possible (see harkonnenActions).
//
// Each leader's combat-ability strip (`combatAbility`) is the hits/shields produced when the
// leader converts a Special combat-die result in battle (user-read from the cards 2026-06-27).

import type { ActionResult } from './state';

export type LeaderFaction = 'house_harkonnen' | 'corrino_ally';

/** When a named leader enters play. */
export type LeaderEntry =
  | { kind: 'start' } // in play at the start of the game
  | { kind: 'track_step'; step: number; alsoRemove?: string } // a track marker reaches a step
  | { kind: 'leader_removed'; leader: string } // another named leader is removed from the game
  | { kind: 'planning_card'; card: string }; // a specific planning card is played

export interface NamedLeaderDef {
  name: string;
  faction: LeaderFaction;
  /** The action-die result this leader activates on. */
  slot: ActionResult;
  entry: LeaderEntry;
  /** Plain-text summary of the special (red) action from the card. */
  special: string;
  /** Hits/shields produced when this leader converts a Special combat-die result. */
  combatAbility: { hits: number; shields: number };
}

// ⚠ The "track_step" entry conditions (Feyd-Rautha step 6, Thufir Hawat step 1) reference a track
// marker on the card; most likely the SUPREMACY track (0-10, advances 1/round in solo). Confirm
// against the physical card / a close-up if leader timing matters.
export const NAMED_LEADERS: readonly NamedLeaderDef[] = [
  {
    name: 'Feyd-Rautha',
    faction: 'house_harkonnen',
    slot: 'leadership',
    entry: { kind: 'track_step', step: 6, alsoRemove: 'Beast Rabban' },
    special: 'Move and attack with the Legion containing Feyd-Rautha.',
    combatAbility: { hits: 2, shields: 1 },
  },
  {
    name: 'Thufir Hawat',
    faction: 'house_harkonnen',
    slot: 'mentat',
    entry: { kind: 'track_step', step: 1 },
    special: 'Draw 3 House Harkonnen Planning cards.',
    combatAbility: { hits: 1, shields: 2 },
  },
  {
    name: 'Beast Rabban',
    faction: 'house_harkonnen',
    slot: 'leadership',
    entry: { kind: 'start' },
    special: 'Move the Legion containing Beast Rabban, then move this Legion to an adjacent Area.',
    combatAbility: { hits: 2, shields: 0 },
  },
  {
    name: 'Baron Harkonnen',
    faction: 'house_harkonnen',
    slot: 'house',
    entry: { kind: 'start' },
    special: 'Replace 3 Regular Units on the board with 3 Elite Units.',
    combatAbility: { hits: 0, shields: 2 },
  },
  {
    name: 'Gaius Helen Mohiam',
    faction: 'corrino_ally',
    slot: 'mentat',
    entry: { kind: 'leader_removed', leader: 'Thufir Hawat' },
    special: 'Draw 2 Corrino Ally Planning cards. Then, play 1 Planning card.',
    combatAbility: { hits: 0, shields: 3 },
  },
  {
    name: 'Captain Aramsham',
    faction: 'corrino_ally',
    slot: 'deployment',
    entry: { kind: 'start' },
    special: 'Deploy 2 Regular Units, 1 Sardaukar Unit, and 1 Leader (Bashar or Named) in one or more Settlements.',
    combatAbility: { hits: 1, shields: 1 },
  },
  {
    name: 'Emperor Shaddam IV',
    faction: 'corrino_ally',
    slot: 'strategy',
    entry: { kind: 'planning_card', card: 'Rage Overcame Shaddam IV' },
    special: 'Replace 3 Elite Units on the board with 3 Sardaukar Units.',
    combatAbility: { hits: 2, shields: 0 },
  },
];

/** The generic Bashar leader's combat-ability strip (converts a Special result to 1 hit). */
export const GENERIC_LEADER_COMBAT = { hits: 1, shields: 0 } as const;

/** Named leaders that must be deployed before any other named leader (deployment priority). */
export const PRIORITY_NAMED_LEADERS = ['Beast Rabban', 'Feyd-Rautha'] as const;

/** The generic Harkonnen leader (Bashar) has no special action and no action-die slot. */
export const GENERIC_LEADER = 'Bashar';

export function leaderByName(name: string): NamedLeaderDef | undefined {
  return NAMED_LEADERS.find((l) => l.name === name);
}

/** Named leaders that occupy a given action-die slot. */
export function leadersForSlot(slot: ActionResult): NamedLeaderDef[] {
  return NAMED_LEADERS.filter((l) => l.slot === slot);
}
