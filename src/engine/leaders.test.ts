import { describe, it, expect } from 'vitest';
import {
  NAMED_LEADERS,
  leaderByName,
  leadersForSlot,
  PRIORITY_NAMED_LEADERS,
  GENERIC_LEADER_COMBAT,
} from './leaders';

describe('named leaders', () => {
  it('has the 7 named leaders (4 Harkonnen + 3 Corrino)', () => {
    expect(NAMED_LEADERS).toHaveLength(7);
    expect(NAMED_LEADERS.filter((l) => l.faction === 'house_harkonnen')).toHaveLength(4);
    expect(NAMED_LEADERS.filter((l) => l.faction === 'corrino_ally')).toHaveLength(3);
  });

  it('maps each leader to its action-die slot', () => {
    expect(leaderByName('Feyd-Rautha')?.slot).toBe('leadership');
    expect(leaderByName('Thufir Hawat')?.slot).toBe('mentat');
    expect(leaderByName('Baron Harkonnen')?.slot).toBe('house');
    expect(leaderByName('Captain Aramsham')?.slot).toBe('deployment');
    expect(leaderByName('Emperor Shaddam IV')?.slot).toBe('strategy');
  });

  it('records entry conditions', () => {
    expect(leaderByName('Feyd-Rautha')?.entry).toEqual({ kind: 'supremacy_step', step: 6, alsoRemove: 'Beast Rabban' });
    expect(leaderByName('Thufir Hawat')?.entry).toEqual({ kind: 'supremacy_step', step: 1 });
    expect(leaderByName('Beast Rabban')?.entry).toEqual({ kind: 'start' });
    expect(leaderByName('Gaius Helen Mohiam')?.entry).toEqual({ kind: 'leader_removed', leader: 'Thufir Hawat' });
  });

  it('leadersForSlot finds both Leadership leaders', () => {
    expect(leadersForSlot('leadership').map((l) => l.name).sort()).toEqual(['Beast Rabban', 'Feyd-Rautha']);
  });

  it('priority deploy leaders are Beast Rabban and Feyd-Rautha', () => {
    expect([...PRIORITY_NAMED_LEADERS].sort()).toEqual(['Beast Rabban', 'Feyd-Rautha']);
  });

  it('records each leader combat ability (hits/shields from a Special result)', () => {
    expect(leaderByName('Feyd-Rautha')?.combatAbility).toEqual({ hits: 2, shields: 1 });
    expect(leaderByName('Thufir Hawat')?.combatAbility).toEqual({ hits: 1, shields: 2 });
    expect(leaderByName('Beast Rabban')?.combatAbility).toEqual({ hits: 2, shields: 0 });
    expect(leaderByName('Baron Harkonnen')?.combatAbility).toEqual({ hits: 0, shields: 2 });
    expect(leaderByName('Gaius Helen Mohiam')?.combatAbility).toEqual({ hits: 0, shields: 3 });
    expect(leaderByName('Captain Aramsham')?.combatAbility).toEqual({ hits: 1, shields: 1 });
    expect(leaderByName('Emperor Shaddam IV')?.combatAbility).toEqual({ hits: 2, shields: 0 });
    // every named leader has one
    for (const l of NAMED_LEADERS) {
      expect(l.combatAbility.hits + l.combatAbility.shields).toBeGreaterThan(0);
    }
  });

  it('generic Bashar combat ability is 1 hit', () => {
    expect(GENERIC_LEADER_COMBAT).toEqual({ hits: 1, shields: 0 });
  });
});
