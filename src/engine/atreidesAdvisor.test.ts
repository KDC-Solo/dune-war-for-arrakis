import { describe, it, expect } from 'vitest';
import { adviseAtreides } from './atreidesAdvisor';
import { newGameState } from './newGame';
import { standardNeighbors } from './moveTargets';
import { AREA_IDS, AREAS } from './board';
import { emptyLegion, type GameState, type Faction } from './state';

/** A quiet action-phase board: garrisons only, every station already taken (tests add the rest). */
function bare(): GameState {
  const s = newGameState();
  s.phase = 'action_resolution';
  // Keep the standard 2-token garrison on every settlement; drop the Atreides sietch legions.
  s.legions = s.legions.filter((l) => l.faction === 'harkonnen');
  s.testingStations = s.testingStations.map((t) => ({ ...t, revealed: true }));
  return s;
}

function put(
  s: GameState,
  faction: Faction,
  area: string,
  regular: number,
  opts: { tokens?: number; naib?: boolean } = {},
): void {
  s.legions.push({
    ...emptyLegion(faction, area),
    units: { regular, elite: 0, special_elite: 0 },
    deploymentTokens: opts.tokens ?? 0,
    leaders: opts.naib ? [{ kind: 'generic', faction }] : [],
  });
}

/** A neighbor of `area` with no settlement or sietch printed on it (free to stand on). */
function freeNeighbor(area: string): string {
  const nb = standardNeighbors(area).find((n) => AREAS[n].settlement == null && !AREAS[n].sietch);
  if (!nb) throw new Error(`no free neighbor for ${area}`);
  return nb;
}

const village = AREA_IDS.find((id) => AREAS[id].settlement === 1)!;
const stationArea = AREA_IDS.find((id) => AREAS[id].testingStation)!;
const sietchArea = AREA_IDS.find((id) => AREAS[id].sietch)!;

describe('adviseAtreides', () => {
  it('has nothing to say without an Atreides legion', () => {
    expect(adviseAtreides(bare())).toBeNull();
  });

  it('suggests assaulting an adjacent settlement when the odds are clearly favorable', () => {
    const s = bare(); // village garrison cp 4 (+1 village rank)
    put(s, 'atreides', freeNeighbor(village), 7); // cp 7 → edge +2
    const advice = adviseAtreides(s)!;
    // (It may prefer a higher-rank settlement also adjacent — any favorable assault is the point.)
    expect(advice.suggestion).toMatchObject({ kind: 'assault_settlement', from: freeNeighbor(village) });
    expect(advice.why).toContain('prescience');
  });

  it('never suggests an attack without at least a +1 combat-power edge', () => {
    const s = bare(); // village defense 4 + 1 rank = 5
    put(s, 'atreides', freeNeighbor(village), 4); // cp 4 → edge −1: a coin flip, not advice
    const advice = adviseAtreides(s);
    expect(advice?.suggestion.kind).not.toBe('assault_settlement');
    expect(advice?.suggestion.kind).not.toBe('attack_legion');
  });

  it('sends an adjacent legion to claim an untaken testing station', () => {
    const s = bare();
    s.testingStations = s.testingStations.map((t) => ({ ...t, revealed: t.area !== stationArea }));
    put(s, 'atreides', freeNeighbor(stationArea), 3);
    const advice = adviseAtreides(s)!;
    expect(advice.suggestion).toMatchObject({ kind: 'move', to: stationArea, goal: 'testing_station' });
    expect(advice.why).toContain('testing station');
  });

  it('reinforces the hunted target sietch when its garrison is outmatched', () => {
    const s = bare();
    s.targetSietchId = sietchArea;
    put(s, 'atreides', sietchArea, 0, { tokens: 1, naib: true }); // garrison cp 3 (+2 assumed rank)
    put(s, 'harkonnen', freeNeighbor(sietchArea), 8); // pressure 8 → deficit 3
    const helperFrom = standardNeighbors(sietchArea).find(
      (n) => n !== freeNeighbor(sietchArea) && AREAS[n].settlement == null && !AREAS[n].sietch,
    )!;
    put(s, 'atreides', helperFrom, 2);
    const advice = adviseAtreides(s)!;
    expect(advice.suggestion).toMatchObject({ kind: 'move', from: helperFrom, goal: 'defend_sietch', goalArea: sietchArea });
    expect(advice.why).toContain('hunting');
  });

  it('is deterministic: the same state always gets the same advice', () => {
    const s = newGameState();
    s.phase = 'action_resolution';
    s.targetSietchId = 'gara_kulon';
    put(s, 'atreides', freeNeighbor(village), 6);
    const a1 = adviseAtreides(s);
    const a2 = adviseAtreides(s);
    expect(a1).toEqual(a2);
    expect(a1).not.toBeNull();
    expect(a1!.why.length).toBeGreaterThan(0);
  });
});
