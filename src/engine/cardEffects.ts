// Planning-card effect resolution (Mahdi solo, Harkonnen decks).
//
// Turns each card's printed text into ordered, structured play STEPS the player executes on the
// board, auto-applying the unambiguous mechanical ones (see effectSteps.ts). Card DATA lives in
// planningCards.ts; this module encodes each card's effect as a step list.
//
// Cards printed with "of your choice" address the Harkonnen side — the bot. Those choices are
// made HERE by the AI (cardChoices.ts) so the player never has to pick against themselves: free
// placements are chosen and auto-applied, and move/attack choices come back as directives naming
// the exact legion, area, and target ("Mahdi's pick").

import type { GameState, Legion } from "./state";
import { cardById } from "./planningCards";
import {
  type EffectStep,
  type EffectResolution,
  placeUnits,
  placeOneEach,
  placeVehicles,
  placeLeader,
  discardWormsigns,
  replaceUnits,
  draw,
  manual,
  applyEffectSteps,
} from "./effectSteps";
import {
  chooseDeployLeader,
  harkonnenLegions,
  atreidesLegions,
} from "./harkonnenActions";
import { harkonnenNeighbors, harkonnenAreAdjacent } from "./movement";
import { combatPower } from "./combatPower";
import { areaLabel } from "./describeArea";
import {
  chooseFreeMountainArea,
  chooseEmptyDesertAreas,
  chooseSettlementForUnits,
  chooseWormsignDiscards,
  chooseLegionForLeader,
  chooseEliteSwaps,
  chooseTroopCarrierMove,
  chooseHunterSeekerTarget,
  chooseSpiesArea,
  chooseShigawire,
  sardaukarLegionAreas,
  harkonnenLeaderOnBoard,
  recommendMove,
  recommendMoveOrAttack,
  actionText,
  actionAreas,
} from "./cardChoices";

export type {
  EffectStep as CardStep,
  EffectResolution as CardResolution,
} from "./effectSteps";
export { applyEffectSteps as applyCardSteps } from "./effectSteps";

// Settlement / village area ids (fixed board data).
const ARRAKEEN = "arrakeen";
const CARTHAG = "carthag";
const NORTH_POLE = "north_pole";
const VILLAGES = ["arsunt", "hagga_basin", "imperial_basin", "north_pole"];

const PICK = " (Mahdi's pick)";
const TOKEN_HINT =
  "A facedown Deployment token may hide a Sardaukar — tap the area → Reveal tokens to flip it.";

const hasSardaukar = (l: Legion) => l.units.special_elite > 0;

/** Area of the Harkonnen legion containing the named leader, if on the board. */
function legionAreaOf(s: GameState, name: string): string | null {
  const leg = harkonnenLegions(s).find((l) =>
    l.leaders.some((ld) => ld.kind === "named" && ld.name === name && !ld.inRegenerationTank),
  );
  return leg?.area ?? null;
}

/** Manual step carrying a move recommendation, or the fallback text when no move helps. */
function moveStep(
  s: GameState,
  fallback: string,
  pred?: (l: Legion) => boolean,
): EffectStep {
  const mv = recommendMove(s, pred);
  const text = actionText(mv);
  return text
    ? manual(`${text}${PICK}.`, { ground: actionAreas(mv) })
    : manual(fallback);
}

/** Manual step carrying a full move-or-attack recommendation. */
function moveOrAttackStep(
  s: GameState,
  fallback: string,
  pred?: (l: Legion) => boolean,
  opts: { attackOnly?: boolean; suffix?: string } = {},
): EffectStep {
  const a = recommendMoveOrAttack(s, pred, { attackOnly: opts.attackOnly });
  const text = actionText(a);
  return text
    ? manual(`${text}${PICK}.${opts.suffix ? ` ${opts.suffix}` : ""}`, {
        ground: actionAreas(a),
      })
    : manual(fallback);
}

/** The strongest Atreides legion adjacent to any Harkonnen legion (or to `extraArea`). */
function artilleryTarget(s: GameState, extraArea?: string | null): string | null {
  const from = [
    ...harkonnenLegions(s).map((l) => l.area),
    ...(extraArea ? [extraArea] : []),
  ];
  const targets = atreidesLegions(s).filter((t) =>
    from.some((a) => harkonnenAreAdjacent(a, t.area)),
  );
  if (targets.length === 0) return null;
  targets.sort(
    (a, b) => combatPower(b) - combatPower(a) || a.area.localeCompare(b.area),
  );
  return targets[0].area;
}

/** Leader-placement step from the deploy priority (priority named → named → Bashar). */
function deployLeaderStep(s: GameState, area: string, fallback: string): EffectStep {
  const leader = chooseDeployLeader(s);
  return leader ? placeLeader(leader, area) : manual(fallback);
}

type CardBuilder = (s: GameState) => EffectStep[];

const CARD_STEPS: Record<string, CardBuilder> = {
  // --- House Harkonnen deck ---
  hard_times_and_oppression: () => [
    placeOneEach("regular", VILLAGES, "each Village"),
    placeOneEach("elite", [CARTHAG, ARRAKEEN], "both Carthag and Arrakeen"),
  ],
  forced_recruitment: (s) => [
    placeUnits({ elite: 3 }, ARRAKEEN),
    deployLeaderStep(
      s,
      ARRAKEEN,
      "No Leader left in the reserve — skip the leader placement.",
    ),
  ],
  beloved_feyd_rautha: (s) => {
    const feydArea = legionAreaOf(s, "Feyd-Rautha");
    if (feydArea)
      return [placeUnits({ elite: 2 }, feydArea, "(Feyd-Rautha's legion)")];
    return [
      manual(
        "Feyd-Rautha enters play; permanently remove Beast Rabban from play. Then play 1 Planning card.",
      ),
    ];
  },
  harkonnen_patrols: (s) => {
    const areas = chooseEmptyDesertAreas(s, 3);
    if (areas.length === 0)
      return [
        manual(
          "Place 3 Regular Units in empty Desert Areas (1 per Area) — no empty Desert Area available.",
        ),
      ];
    const label = `${areas.map((a) => areaLabel(a)).join(", ")}${PICK}`;
    return [placeOneEach("regular", areas, label)];
  },
  arsunt_legion: (s) => {
    const steps: EffectStep[] = [
      placeUnits({ elite: 1, regular: 1 }, "arsunt"),
      deployLeaderStep(
        s,
        "arsunt",
        "No Leader left in the reserve — skip the leader placement.",
      ),
    ];
    const after = applyEffectSteps(s, steps);
    steps.push(
      moveOrAttackStep(
        after,
        "Then move or attack with the Legion in the Arsunt Settlement.",
        (l) => l.area === "arsunt",
      ),
    );
    return steps;
  },
  barons_personal_guard: (s) => {
    const area =
      chooseSettlementForUnits(s, 2, [CARTHAG, ARRAKEEN]) ?? CARTHAG;
    const steps: EffectStep[] = [
      placeUnits({ elite: 2 }, area, "(Carthag or Arrakeen — Mahdi's pick)"),
    ];
    if (s.harkonnenReserve.namedLeaders.includes("Baron Harkonnen"))
      steps.push(placeLeader("Baron Harkonnen", area));
    else
      steps.push(
        manual(
          `Place Baron Harkonnen in ${areaLabel(area)} with the 2 Elite Units (skip if he is already in play elsewhere).`,
          { ground: [area] },
        ),
      );
    const after = applyEffectSteps(s, steps);
    steps.push(moveStep(after, "Then move any Legion — no useful move found; you may skip."));
    return steps;
  },
  hawats_scheming: () => [
    manual(
      "Free action: discard 2 or 3 Hawat's Scheming cards to remove Thufir Hawat from the game; then Gaius Helen Mohiam enters play. (Not played/discarded the usual way.)",
    ),
  ],
  evidence_of_rebellion: (s) => {
    const area = chooseSettlementForUnits(s, 2);
    return [
      area
        ? placeUnits({ elite: 2 }, area, PICK.trim())
        : manual("Place 2 Elite Units in any Settlement — no Settlement has room."),
      draw("house_harkonnen", 2),
    ];
  },
  polar_cap_factories: (s) => {
    const steps: EffectStep[] = [
      placeUnits({ regular: 2, elite: 1 }, NORTH_POLE),
      s.harkonnenReserve.bashars > 0
        ? placeLeader("Bashar", NORTH_POLE)
        : manual("No Bashar left in the reserve — skip the leader placement."),
    ];
    const adjacent = new Set(harkonnenNeighbors(NORTH_POLE));
    const signs = s.wormsigns.filter((w) => adjacent.has(w.area)).map((w) => w.area);
    steps.push(
      signs.length > 0
        ? discardWormsigns(signs)
        : manual("No Wormsigns adjacent to the North Pole Settlement — nothing to discard."),
    );
    return steps;
  },
  carthag_the_former_capital: (s) => [
    placeUnits({ regular: 3, elite: 1 }, CARTHAG),
    deployLeaderStep(
      s,
      CARTHAG,
      "No Leader left in the reserve — skip the leader placement.",
    ),
  ],
  workhorse_of_arrakis: (s) => [
    placeVehicles(s, { harvester: 1, carryall: 1 }),
    draw("house_harkonnen", 2),
  ],
  spotter_control: (s) => {
    const picks = chooseWormsignDiscards(s, 3);
    return [
      picks.length > 0
        ? discardWormsigns(picks)
        : manual("No Wormsigns on the board — nothing to discard."),
      draw("house_harkonnen", 2),
    ];
  },
  explosive_artillery: (s) => {
    const mv = recommendMove(s);
    const target = artilleryTarget(s, mv?.path[mv.path.length - 1]);
    return [
      mv
        ? manual(`${actionText(mv)}${PICK}.`, { ground: actionAreas(mv) })
        : manual("Move any Legion — no useful move found; you may skip."),
      manual(
        `Then make a special attack against ${
          target
            ? `the Atreides legion in ${areaLabel(target)}${PICK}`
            : "an adjacent enemy Legion (none in reach — skip)"
        }: roll 4 Combat dice, 1 Hit per sword and special result.`,
        target ? { ground: [target] } : undefined,
      ),
    ];
  },
  sandmasters: (s) => [
    placeVehicles(s, { harvester: 3 }),
    draw("house_harkonnen", 1),
  ],
  mudir_nahya_the_demon_ruler: (s) => {
    const area = chooseLegionForLeader(s);
    if (s.harkonnenReserve.namedLeaders.includes("Beast Rabban") && area) {
      const steps: EffectStep[] = [
        placeLeader("Beast Rabban", area),
        placeUnits({ elite: 1 }, area, PICK.trim()),
      ];
      const after = applyEffectSteps(s, steps);
      steps.push(
        moveOrAttackStep(
          after,
          `Make a Surprise Attack with the legion in ${areaLabel(area)}.`,
          (l) => l.area === area,
          { attackOnly: true },
        ),
      );
      return steps;
    }
    return [
      manual(
        `Place Beast Rabban and 1 Elite Unit in any Legion, then make a Surprise Attack with it. (If Rabban is removed instead: place 1 Leader and 2 Elite Units in any Legion${
          area ? ` — Mahdi's pick: the legion in ${areaLabel(area)}` : ""
        }.)`,
        area ? { ground: [area] } : undefined,
      ),
    ];
  },
  hunter_seeker: (s) => {
    const t = chooseHunterSeekerTarget(s);
    return [
      t
        ? manual(
            `Place ${t.leader} (in ${areaLabel(t.area)}) in the Regeneration Tank${PICK}.`,
            { ground: [t.area] },
          )
        : manual(
            "No enemy Named Leader shares a Sector with a Harkonnen Legion — no effect.",
          ),
    ];
  },

  // --- Corrino Ally deck ---
  rage_overcame_shaddam_iv_a: (s) => {
    if (harkonnenLeaderOnBoard(s, "Emperor Shaddam IV")) {
      const area = chooseSettlementForUnits(s, 4) ?? ARRAKEEN;
      return [
        manual(
          `Emperor Shaddam IV is already in play: place him and 4 Regular Units in ${areaLabel(area)}${PICK}.`,
          { ground: [area] },
        ),
      ];
    }
    return [manual("Emperor Shaddam IV enters play, then play 1 Planning card.")];
  },
  rage_overcame_shaddam_iv_b: (s) => {
    if (harkonnenLeaderOnBoard(s, "Emperor Shaddam IV")) {
      const area = chooseLegionForLeader(s);
      return [
        manual(
          `Emperor Shaddam IV is already in play: place him and 2 Sardaukar Units in the legion in ${
            area ? areaLabel(area) : "any Area"
          }${area ? PICK : ""}.`,
          area ? { ground: [area] } : undefined,
        ),
      ];
    }
    return [manual("Emperor Shaddam IV enters play, then play 1 Planning card.")];
  },
  rage_overcame_shaddam_iv_c: (s) => {
    if (harkonnenLeaderOnBoard(s, "Emperor Shaddam IV")) {
      const area = chooseLegionForLeader(s, hasSardaukar);
      const steps: EffectStep[] = [
        manual(
          `Emperor Shaddam IV is already in play: place him in the legion in ${
            area ? areaLabel(area) : "a Legion containing a Sardaukar"
          }${area ? PICK : ""}. ${TOKEN_HINT}`,
          area ? { ground: [area] } : undefined,
        ),
      ];
      if (area)
        steps.push(
          moveOrAttackStep(
            s,
            `Then move and make a Surprise Attack with the legion in ${areaLabel(area)}.`,
            (l) => l.area === area,
          ),
        );
      return steps;
    }
    return [manual("Emperor Shaddam IV enters play, then play 1 Planning card.")];
  },
  manipulation_of_others: () => [
    manual("Force your opponent to discard 2 Planning cards of their choice."),
    draw("corrino_ally", 2),
  ],
  breeding_program: () => [
    manual("Take 1 Bene Gesserit token from the reserve."),
    manual("Then play 1 Planning card."),
  ],
  troop_carriers: (s) => {
    const mv = chooseTroopCarrierMove(s);
    return [
      mv
        ? manual(
            `Move the legion in ${areaLabel(mv.from)} directly to ${areaLabel(mv.to)}${PICK} (a full move out of a live Settlement drops the 2 garrison tokens).`,
            { ground: [mv.from, mv.to] },
          )
        : manual(
            "Move a Legion from a Settlement directly to an Area containing one of your Legions — no settlement legion is behind the front; skip.",
          ),
    ];
  },
  shigawire: (s) => {
    const pick = chooseShigawire(s);
    if (pick) {
      return [
        pick.dest
          ? manual(
              `Move the Sardaukar legion in ${areaLabel(pick.legion)} to ${areaLabel(pick.dest)}${PICK}.`,
              { ground: [pick.legion, pick.dest] },
            )
          : manual(
              `The Sardaukar legion in ${areaLabel(pick.legion)} is already adjacent to ${pick.leader} — no move needed.`,
              { ground: [pick.legion] },
            ),
        manual(
          `Then place ${pick.leader} (in ${areaLabel(pick.leaderArea)}) in the Regeneration Tank${PICK}.`,
          { ground: [pick.leaderArea] },
        ),
      ];
    }
    return [
      manual(
        `Move a Legion containing a Sardaukar — no enemy Named Leader is within reach, so Mahdi advances instead. ${TOKEN_HINT}`,
      ),
      moveStep(
        s,
        "No Sardaukar legion has a useful move — skip.",
        hasSardaukar,
      ),
      manual(
        "Then, if that Legion ends adjacent to an enemy Named Leader, place that Leader in the Regeneration Tank.",
      ),
    ];
  },
  hope_clouds_observation: () => [
    manual(
      "Shuffle 1 revealed Prescience card back into the deck — Mahdi picks the one whose ongoing effect helps the Atreides most (extra dice or combat bonuses first).",
    ),
  ],
  reports_of_traitors: () => [
    manual("Discard 1 of your opponent's unused Action dice showing a House result."),
  ],
  sardaukar_pogrom: (s) => {
    const areas = sardaukarLegionAreas(s).slice(0, 3);
    if (areas.length === 0)
      return [
        manual(
          `Move 3 Legions each containing a Sardaukar — none visible on the board. ${TOKEN_HINT} Legions without a Sardaukar don't move.`,
        ),
      ];
    const steps = areas.map((area) =>
      moveStep(
        s,
        `The Sardaukar legion in ${areaLabel(area)} has no useful move — it may hold.`,
        (l) => l.area === area,
      ),
    );
    steps.push(manual(`Up to 3 Sardaukar legions move. ${TOKEN_HINT}`));
    return steps;
  },
  sardaukars_manner: (s) => [
    moveOrAttackStep(
      s,
      `Move or make a Surprise Attack with a Legion containing a Sardaukar — none visible with a useful action. ${TOKEN_HINT}`,
      hasSardaukar,
      { suffix: "(You may make it a Surprise Attack.)" },
    ),
  ],
  spies_all_over_arrakis: (s) => {
    const area = chooseSpiesArea(s);
    return [
      area
        ? manual(
            `Reveal the Sietch and/or all Deployment tokens in ${areaLabel(area)}${PICK}.`,
            { ground: [area] },
          )
        : manual("Nothing hidden to reveal — no unrevealed Sietch or facedown tokens."),
      draw("corrino_ally", 2),
    ];
  },
  full_control_of_the_air: (s) => {
    const veh = placeVehicles(s, { ornithopter: 2 });
    const after = applyEffectSteps(s, [veh]);
    return [
      veh,
      moveStep(after, "Then move a Legion — no useful move found; you may skip."),
    ];
  },
  moving_the_battle_group: (s) => {
    const area = chooseFreeMountainArea(s);
    if (!area)
      return [
        manual(
          "Place 1 Bashar Leader and 2 Elite Units in a free Mountain Area — no free Mountain Area available.",
        ),
      ];
    return [
      placeUnits({ elite: 2 }, area, PICK.trim()),
      s.harkonnenReserve.bashars > 0
        ? placeLeader("Bashar", area)
        : manual("No Bashar left in the reserve — skip the leader placement."),
    ];
  },
  killers_without_mercy: (s) => [
    moveOrAttackStep(
      s,
      `Attack with a Legion containing a Sardaukar — no favourable attack right now; Mahdi holds. ${TOKEN_HINT}`,
      hasSardaukar,
      {
        attackOnly: true,
        suffix:
          "At the end of each battle round, you may continue the battle without taking 1 Hit, even against a Sietch.",
      },
    ),
  ],
  sardaukar_disguised: (s) => {
    const swaps = chooseEliteSwaps(s, 2);
    if (swaps.length === 0)
      return [
        manual(
          "Replace 2 Elite Units on the board with 2 Sardaukar Units — no Elite Units on the board (or no Sardaukar in the reserve); skip.",
        ),
        manual(`Then move 2 Legions each containing a Sardaukar. ${TOKEN_HINT}`),
      ];
    const steps: EffectStep[] = swaps.map((sw) =>
      replaceUnits(sw.area, "elite", "special_elite", sw.count),
    );
    const after = applyEffectSteps(s, steps);
    const movers = sardaukarLegionAreas(after).slice(0, 2);
    for (const area of movers)
      steps.push(
        moveStep(
          after,
          `The Sardaukar legion in ${areaLabel(area)} has no useful move — it may hold.`,
          (l) => l.area === area,
        ),
      );
    return steps;
  },
  i_decide_what_best_serves_his_majesty: (s) => {
    const area = chooseLegionForLeader(s, hasSardaukar);
    if (s.harkonnenReserve.namedLeaders.includes("Captain Aramsham") && area) {
      const steps: EffectStep[] = [placeLeader("Captain Aramsham", area)];
      const after = applyEffectSteps(s, steps);
      steps.push(
        moveOrAttackStep(
          after,
          `Then move or make a Surprise Attack with the legion in ${areaLabel(area)}.`,
          (l) => l.area === area,
          { suffix: "(You may make it a Surprise Attack.)" },
        ),
      );
      return steps;
    }
    return [
      manual(
        `Place Captain Aramsham in a Legion containing a Sardaukar${
          area ? ` — Mahdi's pick: the legion in ${areaLabel(area)}` : ""
        }, then move or make a Surprise Attack with it. ${TOKEN_HINT}`,
        area ? { ground: [area] } : undefined,
      ),
    ];
  },
  seek_out_the_mahdi: (s) => [
    moveStep(s, "Move a Legion of your choice — no useful move found; you may skip."),
    manual(
      "Next Action turn, your opponent cannot place/deploy Paul, nor move/attack with a Legion containing him.",
    ),
  ],
};

/**
 * Resolve a Harkonnen planning card into ordered play steps for the given state.
 * Returns null for an unknown id. Cards without an encoding fall back to a single
 * manual step carrying the printed text.
 */
export function resolveCardPlay(
  id: string,
  s: GameState,
): EffectResolution | null {
  const card = cardById(id);
  if (!card) return null;
  const build = CARD_STEPS[id];
  const steps = build ? build(s) : [manual(card.text)];
  return { id, name: card.name, steps };
}

/** Which card ids have a structured (non-fallback) step encoding. */
export function hasCardEncoding(id: string): boolean {
  return id in CARD_STEPS;
}
