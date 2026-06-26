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

### Phase 0 — Board data  *(IN PROGRESS — at §3 Adjacency)*
> **Resume here (next session): trace s1 adjacency** from the numbered photos, then the other
> sectors; see §2.2/§3a in `BOARD_VERIFICATION.md`. Dense mountain core (s5/s8) may need the
> user's direct `s8_3`-style neighbour descriptions.
Living file: `BOARD_VERIFICATION.md`. Extracted from physical-board photos in `docs/map/`.
- [x] Area names + types (colour rule: orange=plateau, grey=mountain, sand=desert, + minor_erg)
- [x] Settlements (Arrakeen III, Carthag II, 4 Pyon villages I: Arsunt, Hagga Basin, Imperial Basin, North Pole)
- [x] All 8 sietches named
- [x] `deep` (deep-desert) flag per named desert (deep = Sihaya Ridge, Rock Outcroppings, The Great Flat)
- [x] §2 Sectors (s1–s8 = 4 outer + 4 inner) — every area assigned; **board has 101 areas** (not ~50: plateau/mountain have many unnamed areas too)
- [x] §2.1/§2.2 all 101 areas have ids + positions (user physically numbered the board `s#_N`; read off the marked `docs/map/*.jpg` tiles)
- [ ] **§3 Adjacency — IN PROGRESS, the active task.** Done so far in §3a: earlier edges (shield_wall_1/2, wind_pass, s8_3); **s1 (NE-outer)** traced + user-confirmed (open: Gara-Kulon/s5 junction); **s2 (SE-outer)** traced + user-confirmed & resolved (key finding: outer ring is BROKEN at the SE/SW corner — air zone, no s2↔s3 ground link; s2↔s6 air-zone-only at Pasty Mesa). Workflow: I trace clear edges + structural facts from the numbered photos, batch ambiguous-edge questions per sector, cross-check reciprocity + type counts. NEXT: trace s3 (SW-outer) from south-west.jpg.
- [ ] §4 Impassable borders (confirmed so far: Shield Wall #2 west; the red arc along Broken Land→Rimwall West north blocks s1↔s5)
- [ ] §5 Air zones (~8) — which two sectors each straddles

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

- **Phase 0 in progress.** Area list, types, settlements, and all 8 sietch names done.
  Remaining Phase 0: `deep` flags, sectors (§2), air zones (§5), adjacency/impassable cleanup.
- **Next action:** finish §2 sectors + §5 air zones + `deep` flags in `BOARD_VERIFICATION.md`,
  then move to Phase 1 (`board.ts`).

## 5. Key references

- `BOARD_VERIFICATION.md` — board data (source of truth for Phase 1).
- `board-extraction-notes.md` — how the board was read + raw findings.
- `docs/` — rulebook (p37 = solo), FAQ, fan rules summary (p9 = Mahdi solo AI). *(gitignored: large)*
- `docs/map/` — physical-board photos used for extraction. *(gitignored: large)*
- Memory index: see the project memory (`MEMORY.md`) — decisions, the colour rule, "always save to memory".
