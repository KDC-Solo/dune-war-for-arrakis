// AI decision-making for planning-card choices (Mahdi solo).
//
// Cards printed with "of your choice" address the card's controller — the Harkonnen side, which
// in solo is the Mahdi bot. Left to the human (Atreides) player those choices would drift toward
// whatever hurts the bot least, so this module makes them for the bot: each helper returns a
// concrete pick that most benefits the Harkonnen, using the same heuristics the die-driven AI
// plays by (march on the target sietch, mass combat power, prefer sheltered terrain).
// cardEffects.ts turns the picks into auto-applied steps or directives naming exact areas.

import type { GameState, Legion } from "./state";
import { unitCount } from "./state";
import { AREAS, AREA_IDS } from "./board";
import { harkonnenDistance, harkonnenNeighbors, harkonnenAreAdjacent } from "./movement";
import { combatPower } from "./combatPower";
import { stackingLimit } from "./imperiumBans";
import { areaLabel } from "./describeArea";
import { atreidesLeaderByName } from "./atreidesLeaders";
import {
  type HarkonnenAction,
  harkonnenLegions,
  atreidesLegions,
  legionAt,
  effectiveTarget,
  selectMove,
  selectSietchAttack,
  selectLegionAttack,
} from "./harkonnenActions";

// ---------------------------------------------------------------------------
// Shared ranking primitives
// ---------------------------------------------------------------------------

/** Where the Harkonnen are heading: the effective target sietch, else the live sietch nearest a Harkonnen legion. */
export function marchTarget(s: GameState): string | null {
  const t = effectiveTarget(s);
  if (t) return t;
  const legs = harkonnenLegions(s);
  let best: string | null = null;
  let bestD = Infinity;
  for (const si of s.sietches) {
    if (si.destroyed) continue;
    for (const l of legs) {
      const d = harkonnenDistance(l.area, si.area);
      if (d < bestD) {
        bestD = d;
        best = si.area;
      }
    }
  }
  return best;
}

function distTo(area: string, target: string | null): number {
  if (!target) return 0;
  const d = harkonnenDistance(area, target);
  return isFinite(d) ? d : 999;
}

function cmpKeys(a: number[], b: number[]): number {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i];
  return 0;
}

/** Stable, deterministic sort: numeric key vector, then area-id order. */
function rankAreas(ids: string[], key: (id: string) => number[]): string[] {
  return [...ids].sort((a, b) => cmpKeys(key(a), key(b)) || a.localeCompare(b));
}

/** A state where only the Harkonnen legions matching `pred` may act (for restricted recommendations). */
function restrictHarkonnen(s: GameState, pred: (l: Legion) => boolean): GameState {
  return { ...s, legions: s.legions.filter((l) => l.faction !== "harkonnen" || pred(l)) };
}

/** True if the named Harkonnen leader is currently in a legion on the board. */
export function harkonnenLeaderOnBoard(s: GameState, name: string): boolean {
  return harkonnenLegions(s).some((l) =>
    l.leaders.some((ld) => ld.kind === "named" && ld.name === name && !ld.inRegenerationTank),
  );
}

// ---------------------------------------------------------------------------
// Placement choices
// ---------------------------------------------------------------------------

/**
 * "…a free Mountain Area of your choice" (Moving the Battle Group): a free area holds no legion,
 * live sietch, live settlement, or sandworm. Pick the one closest to the march target — a forward
 * staging post (mountains are storm-sheltered, so terrain carries no downside).
 */
export function chooseFreeMountainArea(s: GameState): string | null {
  const occupied = new Set(s.legions.map((l) => l.area));
  const liveSietches = new Set(s.sietches.filter((si) => !si.destroyed).map((si) => si.area));
  const liveSettlements = new Set(s.settlements.filter((st) => !st.destroyed).map((st) => st.area));
  const worms = new Set(s.sandworms.map((w) => w.area));
  const target = marchTarget(s);
  const free = AREA_IDS.filter(
    (id) =>
      AREAS[id].terrain === "mountain" &&
      !occupied.has(id) &&
      !liveSietches.has(id) &&
      !liveSettlements.has(id) &&
      !worms.has(id),
  );
  if (free.length === 0) return null;
  return rankAreas(free, (id) => [distTo(id, target)])[0];
}

/**
 * "…empty Desert Areas of your choice" (Harkonnen Patrols): empty = no legion or sandworm.
 * Prefer areas without a wormsign, then shallow over deep desert, then closest to the march
 * target. Returns up to `n` distinct areas.
 */
export function chooseEmptyDesertAreas(s: GameState, n: number): string[] {
  const occupied = new Set(s.legions.map((l) => l.area));
  const signs = new Set(s.wormsigns.map((w) => w.area));
  const worms = new Set(s.sandworms.map((w) => w.area));
  const target = marchTarget(s);
  const cands = AREA_IDS.filter(
    (id) => AREAS[id].terrain === "desert" && !occupied.has(id) && !worms.has(id),
  );
  return rankAreas(cands, (id) => [
    signs.has(id) ? 1 : 0,
    AREAS[id].deep ? 1 : 0,
    distTo(id, target),
  ]).slice(0, n);
}

/**
 * "…any Settlement of your choice" (unit placement): live settlement with stacking room, ranked
 * like the DEPLOYMENT priority — room for the whole drop first, then highest-CP legion, then
 * closest to the march target.
 */
export function chooseSettlementForUnits(
  s: GameState,
  count: number,
  among?: string[],
): string | null {
  const limit = stackingLimit(s.spice.activeBans);
  const target = marchTarget(s);
  const options = s.settlements
    .filter((st) => !st.destroyed && (!among || among.includes(st.area)))
    .map((st) => {
      const leg = legionAt(s, st.area, "harkonnen");
      return {
        area: st.area,
        cp: leg ? combatPower(leg) : 0,
        room: limit - (leg ? unitCount(leg) : 0),
      };
    })
    .filter((o) => o.room > 0);
  if (options.length === 0) return null;
  options.sort(
    (a, b) =>
      (a.room >= count ? 0 : 1) - (b.room >= count ? 0 : 1) ||
      b.cp - a.cp ||
      distTo(a.area, target) - distTo(b.area, target) ||
      a.area.localeCompare(b.area),
  );
  return options[0].area;
}

/**
 * "Discard N Wormsigns of your choice": wormsigns hinder the Harkonnen march, so discard the ones
 * nearest a Harkonnen legion (most likely to be stepped on), then nearest the march target.
 * Returns up to `n` areas (one entry per token, so an area can repeat).
 */
export function chooseWormsignDiscards(s: GameState, n: number): string[] {
  const legs = harkonnenLegions(s);
  const target = marchTarget(s);
  const nearestLegion = (area: string) =>
    legs.length
      ? Math.min(
          ...legs.map((l) => {
            const d = harkonnenDistance(l.area, area);
            return isFinite(d) ? d : 999;
          }),
        )
      : 999;
  const ranked = [...s.wormsigns].sort(
    (a, b) =>
      nearestLegion(a.area) - nearestLegion(b.area) ||
      distTo(a.area, target) - distTo(b.area, target) ||
      a.area.localeCompare(b.area),
  );
  return ranked.slice(0, n).map((w) => w.area);
}

/**
 * Which legion should receive a joining leader (± escort units): the legion that could attack
 * right now (per the LEADERSHIP/STRATEGY selectors, so the leader lands where the punch is),
 * else the legion nearest the march target, strongest on ties.
 */
export function chooseLegionForLeader(
  s: GameState,
  pred: (l: Legion) => boolean = () => true,
): string | null {
  const legs = harkonnenLegions(s).filter(pred);
  if (legs.length === 0) return null;
  const st = restrictHarkonnen(s, pred);
  const attack = selectSietchAttack(st) ?? selectLegionAttack(st);
  if (attack && (attack.kind === "attack_sietch" || attack.kind === "attack_legion")) {
    if (legs.some((l) => l.area === attack.attacker)) return attack.attacker;
  }
  const target = marchTarget(s);
  const ranked = [...legs].sort(
    (a, b) =>
      distTo(a.area, target) - distTo(b.area, target) ||
      combatPower(b) - combatPower(a) ||
      a.area.localeCompare(b.area),
  );
  return ranked[0].area;
}

// ---------------------------------------------------------------------------
// Move / attack recommendations
// ---------------------------------------------------------------------------

/** The standard move recommendation, optionally restricted to legions matching `pred`. */
export function recommendMove(
  s: GameState,
  pred?: (l: Legion) => boolean,
): Extract<HarkonnenAction, { kind: "move" }> | null {
  const st = pred ? restrictHarkonnen(s, pred) : s;
  const a = selectMove(st);
  return a && a.kind === "move" ? a : null;
}

/** The full LEADERSHIP-style cascade (attack sietch → attack legion → move), optionally restricted. */
export function recommendMoveOrAttack(
  s: GameState,
  pred?: (l: Legion) => boolean,
  opts: { attackOnly?: boolean } = {},
): HarkonnenAction | null {
  const st = pred ? restrictHarkonnen(s, pred) : s;
  return (
    selectSietchAttack(st) ??
    selectLegionAttack(st) ??
    (opts.attackOnly ? null : selectMove(st))
  );
}

/** Harkonnen legions currently showing a Sardaukar unit. */
export function sardaukarLegionAreas(s: GameState): string[] {
  return harkonnenLegions(s)
    .filter((l) => l.units.special_elite > 0)
    .map((l) => l.area);
}

/**
 * "Replace N Elite Units on the board with Sardaukar" — a straight upgrade, so put it where it
 * fights soonest: elites in legions closest to the march target (strongest first on ties).
 * Capped by the Sardaukar left in the reserve.
 */
export function chooseEliteSwaps(
  s: GameState,
  n: number,
): { area: string; count: number }[] {
  const target = marchTarget(s);
  let left = Math.min(n, s.harkonnenReserve.units.special_elite);
  const cands = harkonnenLegions(s)
    .filter((l) => l.units.elite > 0)
    .sort(
      (a, b) =>
        distTo(a.area, target) - distTo(b.area, target) ||
        combatPower(b) - combatPower(a) ||
        a.area.localeCompare(b.area),
    );
  const out: { area: string; count: number }[] = [];
  for (const l of cands) {
    if (left <= 0) break;
    const count = Math.min(left, l.units.elite);
    out.push({ area: l.area, count });
    left -= count;
  }
  return out;
}

/**
 * Troop Carriers: teleport a settlement legion to a friendly legion nearer the front. Only pairs
 * where the destination is strictly closer to the march target than the source qualify (moving
 * troops backwards never helps); the destination must have stacking room.
 */
export function chooseTroopCarrierMove(
  s: GameState,
): { from: string; to: string } | null {
  const target = marchTarget(s);
  const limit = stackingLimit(s.spice.activeBans);
  const liveSettlements = new Set(
    s.settlements.filter((st) => !st.destroyed).map((st) => st.area),
  );
  const legs = harkonnenLegions(s);
  const sources = legs.filter((l) => liveSettlements.has(l.area) && unitCount(l) > 0);
  const dests = legs.filter((l) => unitCount(l) < limit);
  let best: { from: string; to: string; key: number[] } | null = null;
  for (const src of sources) {
    for (const dst of dests) {
      if (dst.area === src.area) continue;
      if (distTo(dst.area, target) >= distTo(src.area, target)) continue;
      const key = [distTo(dst.area, target), -unitCount(src)];
      if (!best || cmpKeys(key, best.key) < 0 || (cmpKeys(key, best.key) === 0 && src.area.localeCompare(best.from) < 0))
        best = { from: src.area, to: dst.area, key };
    }
  }
  return best ? { from: best.from, to: best.to } : null;
}

/**
 * Hunter-Seeker: the enemy Named Leader (sharing a sector with a Harkonnen legion) whose combat
 * ability hurts most — hits weighted over shields.
 */
export function chooseHunterSeekerTarget(
  s: GameState,
): { leader: string; area: string } | null {
  const harkSectors = new Set(harkonnenLegions(s).map((l) => AREAS[l.area].sector));
  const opts: { leader: string; area: string; value: number }[] = [];
  for (const l of atreidesLegions(s)) {
    if (!harkSectors.has(AREAS[l.area].sector)) continue;
    for (const ld of l.leaders) {
      if (ld.kind !== "named" || !ld.name || ld.inRegenerationTank) continue;
      const def = atreidesLeaderByName(ld.name);
      const value = def ? def.combatAbility.hits * 2 + def.combatAbility.shields : 1;
      opts.push({ leader: ld.name, area: l.area, value });
    }
  }
  if (opts.length === 0) return null;
  opts.sort((a, b) => b.value - a.value || a.area.localeCompare(b.area));
  return { leader: opts[0].leader, area: opts[0].area };
}

/**
 * Spies All Over Arrakis ("…in an Area of your choice"): the most informative single area —
 * the unrevealed target sietch, else the Atreides legion hiding the most deployment tokens,
 * else any unrevealed sietch nearest a Harkonnen legion.
 */
export function chooseSpiesArea(s: GameState): string | null {
  const unrevealed = s.sietches.filter((si) => !si.destroyed && !si.revealed);
  const t = s.targetSietchId;
  if (t && unrevealed.some((si) => si.area === t)) return t;
  const tokenHolders = atreidesLegions(s)
    .filter((l) => l.deploymentTokens > 0)
    .sort((a, b) => b.deploymentTokens - a.deploymentTokens || a.area.localeCompare(b.area));
  if (tokenHolders.length > 0) return tokenHolders[0].area;
  if (unrevealed.length > 0) {
    const legs = harkonnenLegions(s);
    const nearest = (area: string) =>
      legs.length
        ? Math.min(...legs.map((l) => distTo(l.area, area)))
        : 0;
    return rankAreas(unrevealed.map((si) => si.area), (id) => [nearest(id)])[0];
  }
  return null;
}

/**
 * Shigawire: move a Sardaukar legion so it ends adjacent to an enemy Named Leader, then tank that
 * leader. Returns the pick when some Sardaukar legion is within reach (distance ≤ 2 — one move
 * ends adjacent); `dest` is null when the legion is already adjacent and staying put suffices.
 */
export function chooseShigawire(s: GameState): {
  legion: string;
  dest: string | null;
  leader: string;
  leaderArea: string;
} | null {
  const sard = harkonnenLegions(s).filter((l) => l.units.special_elite > 0);
  const targets: { leader: string; area: string }[] = [];
  for (const l of atreidesLegions(s))
    for (const ld of l.leaders)
      if (ld.kind === "named" && ld.name && !ld.inRegenerationTank)
        targets.push({ leader: ld.name, area: l.area });
  let best: { legion: string; leader: string; leaderArea: string; d: number } | null = null;
  for (const a of sard)
    for (const t of targets) {
      const d = harkonnenDistance(a.area, t.area);
      if (isFinite(d) && (!best || d < best.d))
        best = { legion: a.area, leader: t.leader, leaderArea: t.area, d };
    }
  if (!best || best.d > 2) return null;
  if (best.d <= 1) return { ...best, dest: null };
  const blockedAreas = new Set([
    ...atreidesLegions(s).map((l) => l.area),
    ...s.sietches.filter((si) => !si.destroyed).map((si) => si.area),
    ...s.sandworms.map((w) => w.area),
  ]);
  const steps = harkonnenNeighbors(best.legion).filter(
    (n) => !blockedAreas.has(n) && harkonnenAreAdjacent(n, best!.leaderArea),
  );
  if (steps.length === 0) return null;
  return { ...best, dest: rankAreas([...steps], () => [0])[0] };
}

// ---------------------------------------------------------------------------
// Directive text for recommendations
// ---------------------------------------------------------------------------

/** One-line imperative text for a recommended action (null for none/deploy/etc.). */
export function actionText(a: HarkonnenAction | null): string | null {
  if (!a) return null;
  switch (a.kind) {
    case "move":
      return `Move the legion in ${areaLabel(a.path[0])} to ${areaLabel(a.path[a.path.length - 1])}`;
    case "attack_sietch":
      return `Attack the sietch in ${areaLabel(a.sietch)} with the legion in ${areaLabel(a.attacker)}${a.useOrnithopter ? " (troop transport via ornithopter)" : ""}`;
    case "attack_legion":
      return `Attack the Atreides legion in ${areaLabel(a.defender)} with the legion in ${areaLabel(a.attacker)}`;
    default:
      return null;
  }
}

/** Board areas involved in a recommended action (for map chips). */
export function actionAreas(a: HarkonnenAction | null): string[] {
  if (!a) return [];
  switch (a.kind) {
    case "move":
      return [a.path[0], a.path[a.path.length - 1]];
    case "attack_sietch":
      return [a.attacker, a.sietch];
    case "attack_legion":
      return [a.attacker, a.defender];
    default:
      return [];
  }
}
