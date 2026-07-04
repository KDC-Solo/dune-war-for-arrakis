// Revealing deployment tokens at the start of a battle.
//
// Rulebook (Battle Rounds Sequence, p24): "flip any Deployment tokens involved in the battle,
// replacing them with the corresponding Units." A token is facedown until it fights — its hidden
// side shows the units it stands for, which only the player can read off the physical token, so the
// caller supplies the revealed composition.
//
// This closes a correctness gap: combat.ts only ever removes units/leaders as casualties (never
// deployment tokens), so a legion that entered a battle with tokens still on it could never be
// ground down. Tokens must therefore become units before `beginBattle`.
//
// Harkonnen marker tokens return to the solo pool when revealed (p42: "Revealed Deployment tokens
// are shuffled back in the pool"). Atreides tokens are removed from the game (p18), so no pool is
// credited for them.

import type { GameState, Legion, UnitType } from './state';

export const HARKONNEN_TOKEN_POOL = 12; // the two sets of Harkonnen Starting Deployment tokens

/**
 * Reveal a legion's deployment tokens, replacing them with `revealed` units. Returns a new state
 * with that legion's `deploymentTokens` cleared and its units increased; for the Harkonnen, the
 * freed token markers return to the reserve pool (capped at the pool size). A no-op if the legion
 * has no tokens (or isn't found).
 *
 * Harkonnen tokens can also show a Bashar Leader on their hidden side (rulebook p15 token
 * symbols) — pass `bashars` to add that many generic leaders; they come out of the reserve's
 * Bashar figures when any are there.
 */
export function revealDeploymentTokens(
  s: GameState,
  area: string,
  faction: Legion['faction'],
  revealed: Record<UnitType, number>,
  bashars = 0,
): GameState {
  const target = s.legions.find((l) => l.faction === faction && l.area === area);
  if (!target || target.deploymentTokens === 0) return s;

  const newLeaders = faction === 'harkonnen' && bashars > 0
    ? Array.from({ length: bashars }, () => ({ kind: 'generic' as const, faction }))
    : [];
  const legions = s.legions.map((l) =>
    l === target
      ? {
          ...l,
          deploymentTokens: 0,
          units: {
            regular: l.units.regular + revealed.regular,
            elite: l.units.elite + revealed.elite,
            special_elite: l.units.special_elite + revealed.special_elite,
          },
          leaders: [...l.leaders, ...newLeaders],
        }
      : l,
  );

  let harkonnenReserve = s.harkonnenReserve;
  if (faction === 'harkonnen') {
    harkonnenReserve = {
      ...harkonnenReserve,
      deploymentTokens: Math.min(
        HARKONNEN_TOKEN_POOL,
        harkonnenReserve.deploymentTokens + target.deploymentTokens,
      ),
      bashars: Math.max(0, harkonnenReserve.bashars - newLeaders.length),
    };
  }

  return { ...s, legions, harkonnenReserve };
}
