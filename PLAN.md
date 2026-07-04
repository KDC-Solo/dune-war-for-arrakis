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
- **Mobile:** native wrapping (Capacitor/React Native) is **scrapped (2026-07-03)** — the app
  stays a responsive web app. If installable/offline is ever wanted, do a PWA pass instead.

## 3. Build phases

### Phase 0 — Board data _(✅ COMPLETE 2026-06-27 — all of §1–§5 done & user-verified)_

> **Resume here (next session): Phase 1 — generate `board.ts`** from `BOARD_VERIFICATION.md` §3a (adjacency),
> §4 (impassable), §5 (air zones), plus §1/§2 (areas, types, sectors, settlements/sietches). Delete §3b
> (old unreliable draft) when porting. A well-formedness test already passed via `scripts/gen_map.py`
> (symmetric edges, no isolated nodes, every id resolves). See also `BOARD_GRAPH.md` for the visual map.
> Living file: `BOARD_VERIFICATION.md`. Extracted from physical-board photos in `docs/images/`.

- [x] Area names + types (colour rule: orange=plateau, grey=mountain, sand=desert, + minor_erg)
- [x] Settlements (Arrakeen III, Carthag II, 4 Pyon villages I: Arsunt, Hagga Basin, Imperial Basin, North Pole)
- [x] All 8 sietches named
- [x] `deep` (deep-desert) flag per named desert (deep = Sihaya Ridge, Rock Outcroppings, The Great Flat)
- [x] §2 Sectors (s1–s8 = 4 outer + 4 inner) — every area assigned; **board has 101 areas** (not ~50: plateau/mountain have many unnamed areas too)
- [x] §2.1/§2.2 all 101 areas have ids + positions (user physically numbered the board `s#_N`; read off the marked `docs/images/*.jpg` tiles)
- [x] **§3 Adjacency — ✅ COMPLETE (2026-06-27).** All 8 sectors + North Pole (**101 areas**) traced and
      **user-verified area-by-area**: the user read each area's neighbour list and confirmed/corrected it; every
      list in `BOARD_VERIFICATION.md` §3a is ✅, cross-sector edges mirrored both ways, one commit per area.
      Method that worked: seed each area from the marked photos + prior cross-sector mirrors → present list →
      user corrects → record + commit. (Earlier batched-question rounds got cities/North Pole/outer ring; the
      area-by-area pass then verified/repaired everything.) §3b is the OLD unreliable draft — delete in Phase 1.
- [x] §4 Impassable borders — **DONE & user-verified exhaustive (2026-06-27): 11 red pairs** in `BOARD_VERIFICATION.md` §4 (one continuous arc on the N+W face of the central mass).
- [x] §5 Air zones — **DONE & user-confirmed (2026-06-27): 8 zones** in `BOARD_VERIFICATION.md` §5 (4 inner-ring links + 4 outer→inner spokes; each connects a specific 2–3 areas, not whole sectors/pole).

### Phase 1 — `board.ts` _(✅ DONE 2026-06-27)_

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

### Phase 2 — Headless Harkonnen AI engine _(the core value)_

Pure TS + tests, no UI. Model the round and the priority cascades from fan-summary p9:

- [x] **Spice Must Flow board** (`src/engine/spiceMustFlow.ts`, 13 tests): data captured from the
      physical SMF board (5 rows; per-row dice + harvester/ornithopter/carryall counts; bottom =
      Imperium Ban). `activeRow`/`availability`/`activeBans`; `resolveSpiceHarvesting` (solo
      allocation: keep lowermost first @2, raise surplus @3, all-top+7 → supremacy, reserve ≤1).
      Per-row dice availability [8,7,6,5,4] user-confirmed (top row = all 8, 1 set aside per row down).
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
- [x] **Movement** = shortest-path to target sietch + tie-breakers (the hard part).
      Primitives (`src/engine/movement.ts`, 15 tests): Harkonnen adjacency ignoring impassable
      borders, BFS distance/shortest-path with occupancy, `nearestByDistance`, ornithopter
      troop-transport. Policy (`selectMove`/`effectiveTarget`/`pickNextStep` in harkonnenActions.ts):
      target validation w/ temporary-target fallback (closest-to-target then highest rank), legion
      selection (nearest, CP tie-break, skip target-adjacent unless mergeable), 5 step tie-breakers
      (merge → closest-to-sietch → mountain → plateau/erg → desert w/o wormsign), merge rule. +4 tests.
- [x] **Combat** resolver (`src/engine/combat.ts`, 18 tests): `combatDiceCount` (units+discards
      +settlement rank, cap 6), `harkonnenShouldContinueAttack` (cease at ≤½ fine power; never
      retreat), `applyHarkonnenHits` (solo casualty priority: shed extra leaders→downgrade
      elite/sardaukar→remove regulars, keep last leader, named→regen), `applyDefaultHits` (defender),
      `resolveBattle` multi-round loop with injected `DiceProvider` (reinforcement discards to 6
      unless Landsraad ban, surprise +1, shields cancel hits, settlement continue-surcharge).
      **Leader-ability/special-elite resolution done** (`src/engine/combatRoll.ts`, 9 tests):
      `resolveCombatRoll` (generic leader special→1 hit, named→its combat strip, excess specials
      miss, opponent Sardaukar/Fedaykin cancel specials first) + `netHits` (shields cancel hits).
- [x] **Deployment** placement priority (`resolveDeployment` in harkonnenActions.ts, 4 tests):
      3 units + 1 leader (priority named Beast Rabban/Feyd-Rautha → any named → Bashar); settlement
      priority highest-CP legion → closest to target; unit substitution to next-higher tier;
      stacking-limit (6) overflow. Added `HarkonnenReserve` to GameState.
- [x] **Vehicle placement** (`src/engine/vehiclePlacement.ts`, 15 tests): `placeHarvesters`
      (4-tier priority + adjacency demotion + adjacent-sector overflow), `placeCarryalls` (zones
      protecting most harvesters), `placeOrnithopters` (threaten 2-away sietches → cover target
      sector → adjacent sectors central-first), `placeVehicles` orchestrator.
- [x] **Card data modules** (from `docs/images/` card photos): `leaders.ts` (7 named leaders +
      Bashar: action slot, entry condition, special, combat-ability hits/shields — all captured),
      `imperiumBans.ts` (3 bans; CHOAM→stacking 5 wired into deploy/move), `planningCards.ts`
      (36-card catalog: 18 House Harkonnen + 18 Corrino). Effect _resolution_ deferred.
- [x] **Planning-card effect resolution** (`src/engine/cardEffects.ts`, 9 tests): every Harkonnen
      card (18 House Harkonnen + 18 Corrino Ally) encoded as ordered play STEPS. Auto-applies the
      deterministic ones (fixed-location unit placement, vehicle placement via the placement engine,
      deck draws); moves/attacks/leader-entries/choices render as player directives. `resolveCardPlay` + `applyCardSteps`; wired into the UI "Play a planning card" panel (auto/you badges). Shared
      `areaLabel` moved to `engine/describeArea.ts`.
- [x] **Named-leader special-action resolution** (`src/engine/leaderEffects.ts`, 5 tests): each
      named leader's red action (from `leaders.ts`) encoded as ordered steps via the shared
      `effectSteps.ts` machinery; auto-draws apply (Thufir 3, Gaius 2), moves/attacks/deploys/
      replacements stay player-resolved. `resolveLeaderSpecial`. The card + leader step builders were
      extracted to `effectSteps.ts` (shared by `cardEffects.ts` and `leaderEffects.ts`).
- [x] **Coriolis Storms** (`src/engine/storms.ts`, 11 tests): the 5 storm-exempt central plateaus
      are DERIVED from the board graph (plateaus encircled only by mountains/plateau = Arrakeen,
      Carthag, Imperial Basin, Hagga Basin, Arsunt — no board re-read needed). `isStormVulnerable`,
      per-special terrain hits (deep 2 / desert 1 / erg+plateau 0), `resolveCoriolisStorms` applies
      the standard Harkonnen casualty priority. UI: a "Coriolis Storms" Desert-Hazards panel where
      the player enters each exposed legion's 2-die result and the app applies the casualties.
- [x] **Tests against worked examples** (`src/engine/rulebookExamples.test.ts`, 4 tests): the
      rulebook combat-dice-count example (p24: 5 dice/side, 6 after a discard) and the leader-ability
      example (p25: Bashar special→1 hit, Baron→2 shields, Fedaykin cancels a special, Harkonnen
      score 3 hits). Noted the p25 example's printed "Atreides 3 Hits" nets to 2 by the written
      mechanics (a single rolled Harkonnen shield the text seems to drop).

### Phase 3 — React + TS UI

- [x] Project scaffold (Vite 6 + React 18 + TS; `npm run dev`/`build`/`preview`). `src/ui/`
      decoupled from the pure `src/engine/`. Build + dev server verified; 136 tests pass.
- [x] "Resolve Harkonnen turn" flow: `App.tsx` — this-round panel (dice/vehicles/bans from SMF),
      tap a die result → `resolveAction` → `describeAction` directive, then "Confirm & apply"
      mutates state via `applyHarkonnenAction` (`src/engine/applyAction.ts`, 8 tests: move/deploy/
      house/vehicles; attacks+mentat stay player-resolved). vehicle-placement panel. State persists.
- [x] Board-state editor (`src/ui/StateEditor.tsx`): state lifted into App; edit imperium markers
      (auto-derives bans), harvesting sector, target sietch, add/edit/remove legions (area, unit
      counts, generic/named leaders), sietch rank/revealed/destroyed + settlement destroyed toggles
      (destroying the target sietch clears the target), the Harkonnen reserve (off-board units/
      deploy-tokens/bashars/named leaders that deployment draws from), and add/remove wormsigns &
      sandworms (which the movement + vehicle-placement engine consume). Resolver + panels react live.
- [x] **New game preset** (`src/engine/newGame.ts`, 7 tests): `newGameState()` builds a fresh
      Mahdi-solo starting position (settlements/sietches/testing-stations derived from board.ts; 8
      Atreides legions = token + Naib per sietch; markers at top; 12 starting deployment tokens +
      start-in-play named leaders in the reserve pool; Harkonnen settlements empty per the solo
      pool rule). Wired to a "New game" button in the editor (undoable via `commit`).
- [x] Sync the few Atreides-side changes the AI depends on — **DONE (2026-07-03):**
  `AtreidesPanel` ("Your turn (Atreides)", action phase): prescience markers + secret-objective
  goals, take testing stations, destroy settlements (all markers +rank), reveal sietches
  (voluntary reveal → +1 reinforcements unless Spacing Guild ban), Harkonnen Bene Gesserit solo
  rule. Legion moves via the move tool; wormsigns via Desert Power.
- [x] Moving Harkonen legion should respect stacking limit — **DONE (2026-07-03):** AI path
  (`applyMove` splits at the limit, move tie-break prefers non-full merges, deployment overflows)
  AND the manual map-move (`moveLegionUnits` clamps to destination room, highest-value units first,
  faction-aware limit via `stackingLimitFor`: CHOAM ban binds Harkonnen only).
- [x] When moving legion, the area selection should be using the map just like when adding wormsigns. Anything that requires area selection let's use the map. Then limit which areas can be selected should be based on rules including sandriding via sandworms and troop-transport via ornithopter.
  **DONE (2026-07-03):** `moveTargets.ts` `legalMoveDestinations` (ground/troop-transport/
  sandriding, faction-aware, excludes full friendly stacks) drives the map pick; and **every**
  area input is now map-first + rule-filtered — target sietch (live sietches) and deploy-from-
  reserve (`reserveDeployAreas`: live settlements / Harkonnen areas with stacking room, no
  Atreides) converted from dropdowns per user decision 2026-07-03 (reversing 2026-07-01).

### Phase 4 — Persistence _(✅ DONE 2026-06-27)_

- [x] Save/restore game state (`src/ui/persistence.ts`, 12 tests): single auto-saved game in
      localStorage (versioned key, shape-validated, storage-injectable) + Reset. Export/Import:
      `exportState` (versioned envelope) downloads a JSON file; `importState` (accepts the envelope
      or a bare GameState) loads it via a file picker. **Multiple named saves** (`SAVES_KEY` map:
      `listSaves`/`saveNamedGame`/`loadNamedGame`/`deleteNamedGame`, most-recent-first) with a
      "Saved games" panel in the editor (name + Save, per-row Load/Delete).

### Phase 5 — Polish & mobile

- [~] UX polish: **Undo** (header button, bounded 20-deep history) reverts the last applied
  Harkonnen action — resolve/card/leader/next-round apply through `commit` (snapshots first);
  import/named-load/reset start a fresh history via `loadGame`. See the UX backlog in §4.
  (Capacitor mobile wrap scrapped 2026-07-03.)

### Phase 6 — Onboarding & teaching _(future)_

Lower the barrier for a brand-new solo player picking up the app cold.

- [x] **Guided board setup — DONE (2026-07-03).** `SetupWizard`: 7-step modal walking through
      the physical Mahdi-solo layout (SMF board + markers, sietch garrisons, settlement tokens,
      stations/decks/leaders, secret objective) with clickable 📍 area chips pulsing the board
      map; finishes by applying `newGameState()`. Launched from the help panel or Games.
- [x] **Teach solo mode — DONE (2026-07-03, first pass).** The wizard's welcome + "How a round
      flows" steps teach the loop (you play Atreides; the app decides Harkonnen actions; dice →
      actions → battles → hazards → spice → end), on top of the existing phase-gated walkthrough
      and help panel. A deeper interactive tutorial can come later if playtesting wants it.

## 3.5 v2 reimagining (branch `v2` — see PRD.md)

Board-first rebuild per PRD.md; engine reused unchanged; v1 reachable via `?classic`.

- [x] **M0** design system (tokens, Rajdhani, 27-glyph icon set) + living shell (2026-07-03)
- [x] **M1** stage camera-fill + glow system + area sheet (edit/move with legal-destination glow)
- [x] **M2** directive flow: die faces → directive card → confirm; chronicle + undo
- [x] **M3** battle screen (night takeover, token reveal, counters, outcome)
- [x] **M4** Atreides tracker sheet + victory scenes
- [x] **M5** phase flows in the guide bar (vehicles/hazards/storms/spice), TurnSheet
      (markers/reserve/cards), saves + import/export; v2 E2E suite (4 journeys; 9 total green)
- [x] **M6** onboarding: first-run welcome, reskinned guided setup, win cue
- [ ] **M7 — PARITY GATE (owner sign-off required):** playtest v2, tick the §8 parity list in
      PRD.md, then swap the default, delete src/ui (v1), and release v1.0.0. Known deltas from
      v1 noted in the M6 report (deep editor coverage vs area-sheet editing; deploy-from-reserve
      conservation UI; wormsign placement via area sheets).

## 4. Current status (update me each session)

- **Phases 0–2 and 4 complete; Phase 3 nearly complete.** 256 tests pass; v0.3.0 shipped
  2026-07-01 and is being playtested. A full Mahdi-solo round runs end-to-end in the app
  (dice → actions → cards/leaders → battles → spice → storms → next round), with undo,
  saves, and the map-first area-picker convention.

### Next up (roadmap, 2026-07-03)

1. ~~Close out the committed WIP~~ **✅ DONE 2026-07-03:** manual move clamped to the
   destination's stacking room; every area input map-first + rule-filtered (target sietch,
   deploy-from-reserve); 262 tests.
2. **Atreides-turn sync panel** _(last unchecked Phase 3 item — biggest playability win)_
   A compact "Your turn" panel so mid-game state upkeep never needs the StateEditor:
   record only what the AI depends on — Atreides legion moves (reuse the move tool;
   sandriding already modeled), battle outcomes (reuse BattlePanel), sietch
   revealed/destroyed, testing stations, imperium-marker/spice changes, wormsign &
   sandworm placement/movement. Phase-gated like the Harkonnen panels.
3. **UX backlog (from the 2026-07-03 UI/UX pass)** — ordered by playability impact:
   - [x] **Sticky status strip** _(DONE 2026-07-03)_: round · phase · supremacy · dice ·
         target · bans, always visible under the header (`StatusStrip`).
   - [x] **One round driver** _(DONE 2026-07-03)_: Begin round / Start round N moved into
         the Round walkthrough's stepper (This round is info-only now).
   - [x] **Attack → Battle handoff** _(DONE 2026-07-03)_: attack directives offer
         "⚔ Move attacker & open battle" — applies the attacker's move into the defender's
         area, scrolls to the Battle panel, and pulses that fight. (Surprise stays a manual
         checkbox: it's a distinct Leadership option in the rules, not implied by the AI
         attack.) Also fixed the move/split form layout (one-line "Reg / 3" captions,
         compact inputs outside the editor, wrapping header row).
   - [x] **Tap-friendly number entry** _(DONE 2026-07-03)_: Counter steppers for battle
         rolls, token reveals, and storm dice. (Editor NumInputs keep plain number fields.)
   - [x] **Toast every applied action** + directive auto-scroll _(DONE 2026-07-03)_. Battle
         commit, token reveals, wormsigns, storms, and spice now also log to history.
   - [x] **Proper game-end screen** _(DONE 2026-07-03)_: GameOverOverlay for both victory
         paths (alert removed); re-arms on undo/new game.
   - [x] **Capacity feedback** _(DONE 2026-07-03)_: deploy form shows "N slots free".
   - [x] **Manual Harkonnen settlement-exit rule** _(DONE 2026-07-03)_: manual full moves
         out of a live settlement drop the 2 garrison tokens (pool-permitting).
   - [x] **Group setup panels** _(DONE 2026-07-03)_: Games + editor collapse into a
         "Setup" group that auto-opens at phase start.
   - [x] **PWA pass** _(DONE 2026-07-03)_: vite-plugin-pwa manifest + auto-updating service
         worker + icons; installable & offline.
4. **Game-end completeness — ✅ DONE (2026-07-03).** `victory.ts`: `gameOutcome` (supremacy
   10 / all prescience markers ≥ the player-entered Secret Objective), prescience economy
   (cards via steppers, stations +1 chosen marker, settlements +rank to all), plus solo
   bookkeeping (voluntary-reveal reinforcements, Harkonnen Bene Gesserit rule).
   `GameState.atreidesObjective` holds the secret card's targets (player-entered; no card
   photos exist).
5. **Rules audit vs fan-summary p9 — ✅ DONE (2026-07-03).** Fixed: Gaius solo special is
   draw-3-Corrino (was base-game draw-2-play-1). Added: BG-token rule, voluntary-reveal
   bonus, settlement-exit garrison on manual moves. **Still open (small):**
   - [ ] Deployment-token pool exhaustion (p9): when the pool is empty and tokens must be
         placed, reveal 2 tokens of choice on the board first, then place. The app
         currently just places fewer/none — surface a directive for this edge.
   - [ ] Wormsign reveal when a Harkonnen legion enters a wormsign area is resolved
         physically; add a help note pointing at the hazard tools for recording outcomes.
6. **E2E full-game suite — ✅ DONE (2026-07-03, user request).** Playwright
   (`e2e/full-game.spec.ts`, 5 journeys): full round from a fresh game (all 5 dice, attack
   handoff, battle, hazards, storms, spice, next round), battle from token reveal to
   commit, rule-filtered map move + garrison drop, guided-setup wizard, both victory paths
   to the game-over screen. Runs in CI (`.github/workflows/e2e.yml`) on push/PR — first
   run green in 1m03s. Local: `PLAYWRIGHT_CHROMIUM=/usr/bin/chromium-browser npm run test:e2e`.
7. **Playtest feedback pass → v0.4.0.** Fold in findings from the current playtest; tag
   the release (everything above is live on main/Pages already).

## 5. Key references

- `BOARD_VERIFICATION.md` — board data (source of truth for Phase 1).
- `board-extraction-notes.md` — how the board was read + raw findings.
- `docs/` — rulebook (p37 = solo), FAQ, fan rules summary (p9 = Mahdi solo AI). _(gitignored: large)_
- `docs/images/` — physical-board photos used for extraction. _(gitignored: large)_
- Memory index: see the project memory (`MEMORY.md`) — decisions, the colour rule, "always save to memory".
