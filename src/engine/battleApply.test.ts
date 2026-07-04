import { describe, it, expect } from 'vitest';
import { commitBattle } from './battleApply';
import { beginBattle, resolveBattleRound } from './combat';
import { emptyLegion, type GameState, type Legion } from './state';
import { sampleState } from '../ui/sampleState';

function leg(faction: Legion['faction'], area: string, units: Partial<Legion['units']>): Legion {
  return { ...emptyLegion(faction, area), units: { regular: 0, elite: 0, special_elite: 0, ...units } };
}

function stateWith(over: Partial<GameState>): GameState {
  return { ...sampleState(), ...over };
}

describe('commitBattle', () => {
  it('removes a wiped-out defender, destroys its sietch, clears the target, replenishes the reserve', () => {
    const area = 'sihaya_ridge';
    const attacker = leg('harkonnen', area, { regular: 5 });
    const defender = leg('atreides', area, { regular: 1 });
    const s = stateWith({
      legions: [attacker, defender],
      sietches: [{ area, rank: 2, revealed: false, destroyed: false }],
      targetSietchId: area,
    });

    let session = beginBattle({ attacker, defender });
    session = resolveBattleRound(session, { attacker: { hits: 1, shields: 0 }, defender: { hits: 0, shields: 0 } });
    expect(session.status).toBe('attacker_won');

    const { state, note } = commitBattle(s, session);
    expect(state.legions.find((l) => l.faction === 'atreides')).toBeUndefined();
    expect(state.legions.find((l) => l.faction === 'harkonnen')!.units.regular).toBe(5);
    expect(state.sietches[0].destroyed).toBe(true);
    expect(state.sietches[0].revealed).toBe(true);
    expect(state.targetSietchId).toBeNull();
    expect(note).toMatch(/sietch destroyed/);
  });

  it('drops a wiped-out attacker and replenishes its casualties into the reserve', () => {
    const area = 'sihaya_ridge';
    // even strength so the Harkonnen engage (not ≤ half), then get wiped in one round.
    const attacker = leg('harkonnen', area, { regular: 5 });
    const defender = leg('atreides', area, { regular: 5 });
    const s = stateWith({ legions: [attacker, defender], sietches: [] });

    let session = beginBattle({ attacker, defender });
    session = resolveBattleRound(session, { attacker: { hits: 0, shields: 0 }, defender: { hits: 6, shields: 0 } });
    expect(session.status).toBe('attacker_eliminated');

    const { state } = commitBattle(s, session);
    expect(state.legions.find((l) => l.faction === 'harkonnen')).toBeUndefined();
    expect(state.harkonnenReserve.units.regular).toBe(s.harkonnenReserve.units.regular + 5);
  });

  it('spends reinforcement cards used from the deck', () => {
    const area = 'sihaya_ridge';
    const attacker = leg('harkonnen', area, { regular: 3 });
    const defender = leg('atreides', area, { regular: 1 });
    const s = stateWith({ legions: [attacker, defender], decks: { ...sampleState().decks, reinforcements: 5 } });

    let session = beginBattle({ attacker, defender, reinforcements: 5 });
    session = resolveBattleRound(session, { attacker: { hits: 1, shields: 0 }, defender: { hits: 0, shields: 0 } });
    const { state } = commitBattle(s, session);
    expect(state.decks.reinforcements).toBe(5 - session.reinforcementsUsed);
  });
});

describe('commitBattle — adjacent battles (rulebook positions)', () => {
  // gara_kulon and s1_11 are adjacent; carthag is a settlement.
  it('a cease leaves both survivors exactly where they started', () => {
    const attacker = leg('harkonnen', 's1_11', { regular: 3 });
    const defender = leg('atreides', 'gara_kulon', { regular: 3 });
    const s = stateWith({ legions: [attacker, defender], sietches: [] });

    let session = beginBattle({ attacker, defender });
    // Bleed the attacker below half the defender's power → they cease at the next round start.
    session = resolveBattleRound(session, { attacker: { hits: 0, shields: 0 }, defender: { hits: 2, shields: 0 } });
    expect(session.status).toBe('defender_survived');

    const { state } = commitBattle(s, session);
    expect(state.legions.find((l) => l.faction === 'harkonnen')!.area).toBe('s1_11');
    expect(state.legions.find((l) => l.faction === 'atreides')!.area).toBe('gara_kulon');
  });

  it('a victory advances the attacker into the taken area', () => {
    const attacker = leg('harkonnen', 's1_11', { regular: 4 });
    const defender = leg('atreides', 'gara_kulon', { regular: 1 });
    const s = stateWith({
      legions: [attacker, defender],
      sietches: [{ area: 'gara_kulon', rank: 2, revealed: true, destroyed: false }],
      targetSietchId: 'gara_kulon',
    });

    let session = beginBattle({ attacker, defender });
    session = resolveBattleRound(session, { attacker: { hits: 1, shields: 0 }, defender: { hits: 0, shields: 0 } });
    expect(session.status).toBe('attacker_won');

    const { state } = commitBattle(s, session);
    const hk = state.legions.find((l) => l.faction === 'harkonnen')!;
    expect(hk.area).toBe('gara_kulon');
    expect(state.sietches[0].destroyed).toBe(true);
  });

  it('advancing out of a live settlement drops the 2-token garrison from the pool', () => {
    const attacker = leg('harkonnen', 'carthag', { regular: 4 });
    const defender = leg('atreides', 'arsunt', { regular: 1 }); // carthag ↔ arsunt are adjacent
    const s = stateWith({
      legions: [attacker, defender],
      settlements: [{ area: 'carthag', rank: 2, destroyed: false }],
      sietches: [],
      harkonnenReserve: { ...sampleState().harkonnenReserve, deploymentTokens: 5 },
    });

    let session = beginBattle({ attacker, defender });
    session = resolveBattleRound(session, { attacker: { hits: 1, shields: 0 }, defender: { hits: 0, shields: 0 } });
    const { state, note } = commitBattle(s, session);
    expect(state.legions.find((l) => l.faction === 'harkonnen' && l.area === 'arsunt')).toBeTruthy();
    const garrison = state.legions.find((l) => l.faction === 'harkonnen' && l.area === 'carthag');
    expect(garrison?.deploymentTokens).toBe(2);
    expect(state.harkonnenReserve.deploymentTokens).toBe(3);
    expect(note).toMatch(/garrison/);
  });

  it('a victory advance MERGES with a friendly legion already in the taken area', () => {
    const attacker = leg('harkonnen', 's1_11', { regular: 4 });
    const occupant = { ...leg('harkonnen', 'gara_kulon', { regular: 2, elite: 1 }), deploymentTokens: 1 };
    const defender = leg('atreides', 'gara_kulon', { regular: 1 });
    const s = stateWith({ legions: [attacker, occupant, defender], sietches: [] });

    let session = beginBattle({ attacker, defender });
    session = resolveBattleRound(session, { attacker: { hits: 1, shields: 0 }, defender: { hits: 0, shields: 0 } });
    expect(session.status).toBe('attacker_won');

    const { state } = commitBattle(s, session);
    const hkAtDef = state.legions.filter((l) => l.faction === 'harkonnen' && l.area === 'gara_kulon');
    expect(hkAtDef).toHaveLength(1); // one legion per faction per area — never two
    expect(hkAtDef[0].units.regular).toBe(6);
    expect(hkAtDef[0].units.elite).toBe(1);
    expect(hkAtDef[0].deploymentTokens).toBe(1);
    expect(state.legions.some((l) => l.faction === 'harkonnen' && l.area === 's1_11')).toBe(false);
  });
});
