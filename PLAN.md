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

### Phase 1 — `board.ts`
- [ ] Generate typed board module from the verified `BOARD_VERIFICATION.md`
      (areas, types, adjacency graph, sectors, air zones, impassable, settlement/sietch slots)
- [ ] Adjacency/air/impassable helpers + a unit test asserting the graph is well-formed
      (symmetric edges, every id resolves, no dangling refs)

### Phase 2 — Headless Harkonnen AI engine  *(the core value)*
Pure TS + tests, no UI. Model the round and the priority cascades from fan-summary p9:
- [ ] Game-state types (legions w/ composition→combat power, sietches, settlements,
      Atreides legions, harvesters/carryalls/ornithopters, tracks, deployment pool, decks)
- [ ] Round structure (Mahdi sequence: tactical/target-sietch draw → vehicle placement →
      action resolution → desert hazards → spice harvesting → end of round)
- [ ] Action-die resolver (Leadership/Strategy → attack sietch / attack legion / move; Mentat; House)
- [ ] **Movement** = shortest-path to target sietch + tie-breakers (the hard part)
- [ ] **Combat** resolver (dice count, casualty removal priority, when to stop, retreat)
- [ ] **Deployment** placement priority
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
- **Next action: Phase 1 — generate the typed `board.ts`** (areas, types, adjacency, impassable, air zones,
  sectors, settlement/sietch slots) from `BOARD_VERIFICATION.md`, plus the graph well-formedness unit test.
  Drop the §3b legacy draft during the port.

## 5. Key references

- `BOARD_VERIFICATION.md` — board data (source of truth for Phase 1).
- `board-extraction-notes.md` — how the board was read + raw findings.
- `docs/` — rulebook (p37 = solo), FAQ, fan rules summary (p9 = Mahdi solo AI). *(gitignored: large)*
- `docs/map/` — physical-board photos used for extraction. *(gitignored: large)*
- Memory index: see the project memory (`MEMORY.md`) — decisions, the colour rule, "always save to memory".
