// Imperium ban data (captured from the 3 Imperium Ban cards). A ban activates when that power's
// imperium marker reaches the bottom row of the Spice Must Flow board (see spiceMustFlow.ts).

import type { ImperiumPower } from './state';

export interface ImperiumBanDef {
  power: ImperiumPower;
  name: string;
  effect: string;
}

export const IMPERIUM_BANS: Record<ImperiumPower, ImperiumBanDef> = {
  spacing_guild: {
    power: 'spacing_guild',
    name: 'Prohibitive Price for Weather Satellites',
    effect: 'You cannot take Scouting actions.',
  },
  landsraad: {
    power: 'landsraad',
    name: 'The Forms Must Be Obeyed',
    effect: 'You cannot discard Planning cards to add Combat dice during battles.',
  },
  choam: {
    power: 'choam',
    name: 'Higher Costs of Maintenance',
    effect: 'Your Legion stacking limit is reduced to 5 Units.',
  },
};

/** Default per-area units stacking limit. */
export const BASE_STACKING_LIMIT = 6;
/** CHOAM ban reduces the stacking limit. */
export const CHOAM_STACKING_LIMIT = 5;

/** The current stacking limit given the active imperium bans (CHOAM → 5, else 6). */
export function stackingLimit(activeBans: readonly ImperiumPower[]): number {
  return activeBans.includes('choam') ? CHOAM_STACKING_LIMIT : BASE_STACKING_LIMIT;
}

/** Whether scouting is forbidden (Spacing Guild ban). */
export function scoutingBanned(activeBans: readonly ImperiumPower[]): boolean {
  return activeBans.includes('spacing_guild');
}

/** Whether reinforcement-card discards for combat dice are forbidden (Landsraad ban). */
export function combatDiceDiscardBanned(activeBans: readonly ImperiumPower[]): boolean {
  return activeBans.includes('landsraad');
}
