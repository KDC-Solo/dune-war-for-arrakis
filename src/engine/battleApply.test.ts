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
