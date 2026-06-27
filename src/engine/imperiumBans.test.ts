import { describe, it, expect } from 'vitest';
import {
  IMPERIUM_BANS,
  stackingLimit,
  scoutingBanned,
  combatDiceDiscardBanned,
} from './imperiumBans';

describe('imperium bans', () => {
  it('has all three bans with their effects', () => {
    expect(IMPERIUM_BANS.choam.effect).toMatch(/stacking limit/i);
    expect(IMPERIUM_BANS.spacing_guild.effect).toMatch(/scouting/i);
    expect(IMPERIUM_BANS.landsraad.effect).toMatch(/combat dice/i);
  });

  it('CHOAM ban lowers the stacking limit to 5', () => {
    expect(stackingLimit([])).toBe(6);
    expect(stackingLimit(['choam'])).toBe(5);
    expect(stackingLimit(['landsraad', 'spacing_guild'])).toBe(6);
  });

  it('flags the scouting and combat-dice bans', () => {
    expect(scoutingBanned(['spacing_guild'])).toBe(true);
    expect(scoutingBanned([])).toBe(false);
    expect(combatDiceDiscardBanned(['landsraad'])).toBe(true);
    expect(combatDiceDiscardBanned(['choam'])).toBe(false);
  });
});
