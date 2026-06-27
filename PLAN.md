# Dune: War for Arrakis — Solo Companion — PLAN

A web app (React + TypeScript) that runs the **Mahdi solo-mode Harkonnen "AI"** so the
solo player (playing Atreides) doesn't have to execute the Harkonnen priority rules by hand.

> **New session? Start here:** read this file, then `BOARD_VERIFICATION.md` (board data),
> then the memory index. Pick up at the first unchecked item under "Current status".

---

## 1. Problem & approach

- Solo play = player runs **Atreides**; the **Harkonnen are a deterministic AI** (rulebook
  p37 / fan-summary p9 in `docs/`). The friction is executing its nested priority lists every turn.
- The app is a **co-processor over the physical board**: it holds enough board state to apply
  the AI rules, tells the player exactly what the Harkonnen do, and the player executes it on
  the real board and confirms. The physical board stays the source of truth.

## 2. Architecture decisions (locked)

- **Stack:** React + TypeScript (local-first, no backend; AI logic runs client-side).
- **Scope first target:** base game **Mahdi solo only**. Expansions later (Smugglers,
  Spacing Guild [note: incompatible with Mahdi solo], Possible Futures).
- **Engine is headless & pure-TS**, decoupled from the UI, so it can be unit-tested against
  the rulebook's priority lists before any UI exists.
- **Mobile** (Capacitor/React Native wrapper) is a future goal, not now.

## 3. Build phases

### Phase 0 — Board data  *(✅ COMPLETE 2026-06-27 — all of §1–§5 done & user-verified)*
> **Resume here (next session): Phase 1 — generate `board.ts`** from `BOARD_VERIFICATION.md` §3a (adjacency),
> §4 (impassable), §5 (air zones), plus §1/§2 (areas, types, sectors, settlements/sietches). Delete §3b
> (old unreliable draft) when porting. A well-formedness test already passed via `scripts/gen_map.py`
> (symmetric edges, no isolated nodes, every id resolves). See also `BOARD_GRAPH.md` for the visual map.
Living file: `BOARD_VERIFICATION.md`. Extracted from physical-board photos in `docs/map/`.
- [x] Area names + types (colour rule: orange=plateau, grey=mountain, sand=desert, + minor_erg)
- [x] Settlements (Arrakeen III, Carthag II, 4 Pyon villages I: Arsunt, Hagga Basin, Imperial Basin, North Pole)
- [x] All 8 sietches named
- [x] `deep` (deep-desert) flag per named desert (deep = Sihaya Ridge, Rock Outcroppings, The Great Flat)
- [x] §2 Sectors (s1–s8 = 4 outer + 4 inner) — every area assigned; **board has 101 areas** (not ~50: plateau/mountain have many unnamed areas too)
- [x] §2.1/§2.2 all 101 areas have ids + positions (user physically numbered the board `s#_N`; read off the marked `docs/map/*.jpg` tiles)
- [x] **§3 Adjacency — ✅ COMPLETE (2026-06-27).** All 8 sectors + North Pole (**101 areas**) traced and
      **user-verified area-by-area**: the user read each area's neighbour list and confirmed/corrected it; every
      list in `BOARD_VERIFICATION.md` §3a is ✅, cross-sector edges mirrored both ways, one commit per area.
      Method that worked: seed each area from the marked photos + prior cross-sector mirrors → present list →
      user corrects → record + commit. (Earlier batched-question rounds got cities/North Pole/outer ring; the
      area-by-area pass then verified/repaired everything.) §3b is the OLD unreliable draft — delete in Phase 1.
- [x] §4 Impassable borders — **DONE & user-verified exhaustive (2026-06-27): 11 red pairs** in `BOARD_VERIFICATION.md` §4 (one continuous arc on the N+W face of the central mass).
- [x] §5 Air zones — **DONE & user-confirmed (2026-06-27): 8 zones** in `BOARD_VERIFICATION.md` §5 (4 inner-ring links + 4 outer→inner spokes; each connects a specific 2–3 areas, not whole sectors/pole).

### Phase 1 — `board.ts`  *(✅ DONE 2026-06-27)*
- [x] Generated typed board module `src/engine/board.ts` from `BOARD_VERIFICATION.md` via
      `scripts/gen_board.py` (`npm run gen:board`): 101 `AREAS` (id/name/sector/terrain/deep/
      settlement/sietch), symmetric `ADJACENCY` (265 edges), `IMPASSABLE` (11), `AIR_ZONES` (8).
      ✅ **Terrain complete (2026-06-27):** all 101 areas typed via §6 of `BOARD_VERIFICATION.md`
      (per-sector TERRAIN/DEEP lines, user-dictated). Totals: plateau 12 · mountain 19 · minor_erg 5 ·
      desert 65 (deep 23) — match §2. No untyped areas remain.
- [x] Helpers in `src/engine/graph.ts` (neighbors / areAdjacent / isImpassable / airZonesOf /
      shortestGroundPath) + Vitest suite `board.test.ts` — **14 tests pass**: 101 areas, symmetric &
      connected graph, no isolated nodes, impassable disjoint from passable, air zones valid.
      Toolchain: Node 22, TypeScript (strict, `tsc --noEmit` clean), Vitest. (Vite+React deferred to Phase 3.)

### Phase 2 — Headless Harkonnen AI engine  *(the core value)*
Pure TS + tests, no UI. Model the round and the priority cascades from fan-summary p9:
- [x] Game-state types (`src/engine/state.ts`): legions (units/deploy tokens/leaders),
      settlements/sietches/testing-stations state, vehicles, wormsign/sandworm, tactical cards,
      Spice Must Flow + imperium bans, tracks, decks, action dice, round phases, `GameState`.
      Combat power (`combatPower.ts`: coarse + fine tie-break + diff) — 7 tests. (2026-06-27)
- [x] Round structure (`src/engine/round.ts`): phase sequence (`PHASE_ORDER`/`nextPhase`),
      8 tactical cards generated from board (one per sietch; 2 central = Hobars Gap + Windgap),
      start-of-round draw (harvesting sector + target sietch w/ re-draw constraints),
      mid-round target reselection, end-of-round supremacy/prescience constants. 12 tests. (2026-06-27)
- [~] Action-die resolver (`src/engine/harkonnenActions.ts`, 10 tests): LEADERSHIP/STRATEGY
      cascade — `selectSietchAttack` (reach incl. ornithopter "if necessary"; priority rank→CP
      diff→no-ornithopter→target sietch), `selectLegionAttack` (adjacent only, priority CP→named
      leader), `selectMove` (basic: nearest legion steps toward target), `resolveLeadershipOrStrategy`.
      Plus accessors (harkonnen/atreides legions, ornithopter zones, blocked-areas). MENTAT
      (`resolveMentat`), HOUSE (`resolveHouse`: replace 2 regulars→elites by legion priority, else
      place vehicles), DEPLOYMENT, and top-level `resolveAction` dispatch — all done. TODO: full
      movement tie-breakers + merge; "activate named-leader special first"; card-effect resolution.
- [~] **Movement** = shortest-path to target sietch + tie-breakers (the hard part).
      Primitives DONE (`src/engine/movement.ts`, 10 tests): Harkonnen adjacency ignoring impassable
      borders, BFS distance/shortest-path with occupancy (`blocked`/`allowBlockedTarget`),
      `nearestByDistance`; ornithopter troop-transport (`airZoneSectors`/`airZonesConnectedToSector`/
      `canTroopTransport`/`withinAttackReach` — air-zone↔sector derived from verified §5 straddles).
      15 tests. TODO: the 5 shortest-path tie-breakers (belong with the action resolver's movement policy).
- [~] **Combat** resolver (`src/engine/combat.ts`, 9 tests): `combatDiceCount` (units+discards
      +settlement rank, cap 6), `harkonnenShouldContinueAttack` (cease at ≤½ fine power; never
      retreat), `applyHarkonnenHits` (solo casualty priority: shed extra leaders→downgrade
      elite/sardaukar→remove regulars, keep last leader, named→regen). TODO: dice-roll/hit
      tally (inject RNG; Hit/Shield/Special faces + leader Special abilities), full battle loop.
- [x] **Deployment** placement priority (`resolveDeployment` in harkonnenActions.ts, 4 tests):
      3 units + 1 leader (priority named Beast Rabban/Feyd-Rautha → any named → Bashar); settlement
      priority highest-CP legion → closest to target; unit substitution to next-higher tier;
      stacking-limit (6) overflow. Added `HarkonnenReserve` to GameState.
- [x] **Vehicle placement** (`src/engine/vehiclePlacement.ts`, 15 tests): `placeHarvesters`
      (4-tier priority + adjacency demotion + adjacent-sector overflow), `placeCarryalls` (zones
      protecting most harvesters), `placeOrnithopters` (threaten 2-away sietches → cover target
      sector → adjacent sectors central-first), `placeVehicles` orchestrator.
- [ ] Tests against worked examples / rulebook edge cases

### Phase 3 — React + TS UI
- [ ] Project scaffold (Vite + React + TS + test runner)
- [ ] Board-state editor (set/track positions the engine needs)
- [ ] "Resolve Harkonnen turn" flow: tap die result → show the dictated action → confirm
- [ ] Sync the few Atreides-side changes the AI depends on

### Phase 4 — Persistence
- [ ] Save/restore game state (localStorage/IndexedDB), multiple saves

### Phase 5 — Polish & mobile
- [ ] UX polish, then Capacitor wrapper for mobile

## 4. Current status (update me each session)

- **✅ Phase 0 COMPLETE (2026-06-27).** All board data captured & user-verified in `BOARD_VERIFICATION.md`:
  areas/types/settlements/sietches/`deep` (§1), 101 areas + sectors + positional ids (§2/§2.1/§2.2),
  full adjacency graph (§3a, area-by-area verified), 11 impassable borders (§4), 8 air zones (§5).
  Visual map + graph well-formedness check in `BOARD_GRAPH.md` (`scripts/gen_map.py`/`gen_graph.py`).
- **✅ Phase 1 COMPLETE (2026-06-27).** Typed `board.ts` generated from `BOARD_VERIFICATION.md` via
  `scripts/gen_board.py`; all 101 areas terrain-typed; graph helpers + Vitest suite. Plus: 6 ecological
  testing stations added (`Area.testingStation`, §1 `STATIONS` line) — 16 tests pass.
- **Next action: Phase 2 — headless Harkonnen AI engine.** Start with game-state types (see Phase 2 list),
  built pure-TS + tests against fan-summary p9 (Mahdi solo). No UI yet.

## 5. Key references

- `BOARD_VERIFICATION.md` — board data (source of truth for Phase 1).
- `board-extraction-notes.md` — how the board was read + raw findings.
- `docs/` — rulebook (p37 = solo), FAQ, fan rules summary (p9 = Mahdi solo AI). *(gitignored: large)*
- `docs/map/` — physical-board photos used for extraction. *(gitignored: large)*
- Memory index: see the project memory (`MEMORY.md`) — decisions, the colour rule, "always save to memory".
