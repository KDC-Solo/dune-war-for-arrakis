import { describe, it, expect } from "vitest";
import { ATREIDES_LEADERS, atreidesLeaderByName } from "./atreidesLeaders";
import { resolveCombatRoll } from "./combatRoll";

describe("Atreides named leaders", () => {
  it("captures all 8 leaders (Wild Maker is not a legion leader)", () => {
    expect(ATREIDES_LEADERS).toHaveLength(8);
    expect(ATREIDES_LEADERS.filter((l) => l.faction === "house_atreides")).toHaveLength(5);
    expect(ATREIDES_LEADERS.filter((l) => l.faction === "fremen_ally")).toHaveLength(3);
  });

  it("combat strips match the physical cards", () => {
    expect(atreidesLeaderByName("Paul Atreides")?.combatAbility).toEqual({ hits: 1, shields: 0 });
    expect(atreidesLeaderByName("Lady Jessica")?.combatAbility).toEqual({ hits: 0, shields: 1 });
    expect(atreidesLeaderByName("Gurney Halleck")?.combatAbility).toEqual({ hits: 2, shields: 1 });
    expect(atreidesLeaderByName("Reverend Mother Jessica")?.combatAbility).toEqual({ hits: 0, shields: 2 });
    expect(atreidesLeaderByName("Alia")?.combatAbility).toEqual({ hits: 1, shields: 0 });
    expect(atreidesLeaderByName("Stilgar")?.combatAbility).toEqual({ hits: 2, shields: 0 });
    expect(atreidesLeaderByName("Chani")?.combatAbility).toEqual({ hits: 1, shields: 1 });
    expect(atreidesLeaderByName("Paul-Muad'Dib")?.combatAbility).toEqual({ hits: 2, shields: 1 });
  });

  it("resolveCombatRoll converts an Atreides special via the leader's strip", () => {
    // Stilgar converts 1 special into 2 hits (no opposing Sardaukar).
    const r = resolveCombatRoll(
      { hits: 1, shields: 0, specials: 1 },
      [{ kind: "named", faction: "atreides", name: "Stilgar" }],
      0,
    );
    expect(r).toEqual({ hits: 3, shields: 0 });
    // An unknown/placeholder name still falls back to the generic 1 hit.
    const g = resolveCombatRoll(
      { hits: 0, shields: 0, specials: 1 },
      [{ kind: "named", faction: "atreides", name: "Named" }],
      0,
    );
    expect(g).toEqual({ hits: 1, shields: 0 });
  });
});
