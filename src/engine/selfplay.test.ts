// Self-play balance harness (M8): every brain plays full engine-level games — dice, directives,
// battles, hazards, harvest, round turnover — against a passive Atreides board. It proves each
// difficulty finishes real games without corrupting state, and gives a tempo baseline
// (rounds-to-win) to compare profiles.

import { describe, it, expect } from 'vitest';
import { newGameState } from './newGame';
import { setupRound, startNextRound, SUPREMACY_WIN } from './round';
import { availability, resolveSpiceHarvesting, totalHarvesterSpice, activeBans } from './spiceMustFlow';
import { placeWormsigns } from './wormsigns';
import { gameOutcome } from './victory';
import { decideHarkonnenAction, ensureBrainPlan, type BrainId } from './harkonnenBrain';
import { applyHarkonnenAction } from './applyAction';
import { beginBattle, resolveBattleRound, battleRoundSetup } from './combat';
import { commitBattle } from './battleApply';
import { AREAS } from './board';
import type { GameState, ActionResult } from './state';

const FACES: ActionResult[] = ['leadership', 'strategy', 'mentat', 'deployment', 'house'];

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Resolve an attack directive with statistically-average combat rolls. */
function fightItOut(s: GameState, attackerArea: string, defenderArea: string): GameState {
  // Attacking a sietch reveals its rank first (the physical flip).
  let st = s;
  const si = st.sietches.find((x) => x.area === defenderArea && !x.destroyed);
  if (si && !si.revealed) {
    st = { ...st, sietches: st.sietches.map((x) => (x.area === defenderArea ? { ...x, revealed: true } : x)) };
  }
  const attacker = st.legions.find((l) => l.faction === 'harkonnen' && l.area === attackerArea);
  const defender = st.legions.find((l) => l.faction === 'atreides' && l.area === defenderArea);
  if (!attacker || !defender) return st;
  const rank = st.sietches.find((x) => x.area === defenderArea && !x.destroyed)?.rank ?? undefined;
  let session = beginBattle({
    attacker,
    defender,
    defenderSettlementRank: rank,
    reinforcements: st.decks.reinforcements,
  });
  for (let i = 0; i < 12 && session.status === 'ongoing'; i++) {
    const setup = battleRoundSetup(session);
    session = resolveBattleRound(session, {
      attacker: { hits: Math.round(setup.attackerDice * 0.45), shields: Math.round(setup.attackerDice * 0.15) },
      defender: { hits: Math.round(setup.defenderDice * 0.45), shields: Math.round(setup.defenderDice * 0.15) },
    });
  }
  return commitBattle(st, session).state;
}

function checkInvariants(s: GameState, where: string): void {
  const seen = new Set<string>();
  for (const l of s.legions) {
    const k = `${l.faction}@${l.area}`;
    expect(seen.has(k), `duplicate legion ${k} at ${where}`).toBe(false);
    seen.add(k);
    for (const n of Object.values(l.units)) expect(n).toBeGreaterThanOrEqual(0);
    expect(l.deploymentTokens).toBeGreaterThanOrEqual(0);
  }
  expect(s.tracks.supremacy).toBeLessThanOrEqual(SUPREMACY_WIN);
}

/** Play one full solo game with the given brain; returns the rounds it took the Harkonnen. */
function playGame(brain: BrainId, seed: number): number {
  const rng = mulberry32(seed);
  let s = setupRound(newGameState(), rng);
  for (let round = 1; round <= 20; round++) {
    // Action phase: roll the whole pool.
    const dice = availability(s.spice.markers).diceAvailable;
    for (let i = 0; i < dice; i++) {
      const face = FACES[Math.floor(rng() * FACES.length)];
      s = ensureBrainPlan(s, brain); // plans persist across dice/rounds, exactly as the UI does it
      const a = decideHarkonnenAction(s, face, brain, rng);
      if (a.kind === 'attack_sietch') s = fightItOut(s, a.attacker, a.sietch);
      else if (a.kind === 'attack_legion') s = fightItOut(s, a.attacker, a.defender);
      else {
        const res = applyHarkonnenAction(s, a);
        if (res.applied) s = res.state;
      }
      if (gameOutcome(s).winner) return round;
    }
    // Hazards (wormsigns only — storms need player dice and average to little).
    s = placeWormsigns(s).state;
    // The spice must flow.
    const harvesters = s.vehicles.filter((v) => v.type === 'harvester').map((v) => ({ deep: !!AREAS[v.location]?.deep }));
    const collected = totalHarvesterSpice(harvesters);
    const out = resolveSpiceHarvesting(s.spice.markers, collected, s.spice.spiceReserve);
    s = {
      ...s,
      spice: { ...s.spice, markers: out.markers, spiceReserve: out.reserve, activeBans: activeBans(out.markers) },
      tracks: { ...s.tracks, supremacy: Math.min(SUPREMACY_WIN, s.tracks.supremacy + out.supremacyGained) },
    };
    if (gameOutcome(s).winner) return round;
    checkInvariants(s, `${brain} seed ${seed} round ${round}`);
    const next = startNextRound(s, rng);
    s = next.state;
    if (next.harkonnenWins) return round + 1;
  }
  return 21; // did not converge — flagged by the assertion below
}

describe('self-play: every brain finishes real games', () => {
  const GAMES = 12;
  const tempo: Record<string, number> = {};

  for (const brain of ['mahdi', 'recruit', 'bashar', 'baron', 'mentat'] as const) {
    it(`${brain} plays ${GAMES} full games to a win`, () => {
      let total = 0;
      for (let g = 0; g < GAMES; g++) {
        const rounds = playGame(brain, 1000 + g * 7919);
        expect(rounds, `${brain} game ${g} must end`).toBeLessThanOrEqual(14);
        total += rounds;
      }
      tempo[brain] = total / GAMES;
    });
  }

  it('difficulty ordering holds loosely: sharper brains are no slower than Recruit', () => {
    // All win via supremacy eventually; a sharper brain should not be materially slower.
    expect(tempo.baron).toBeLessThanOrEqual(tempo.recruit + 1);
    expect(tempo.mentat).toBeLessThanOrEqual(tempo.recruit + 1);
    // eslint-disable-next-line no-console
    console.log('mean rounds-to-win:', tempo);
  });
});
