# PRD — Dune: War for Arrakis Solo Companion **v2** ("Arrakis")

**Status:** Draft for build · **Branch:** `v2` · **Date:** 2026-07-03
**Predecessor:** v0.4.0 (main) — feature-complete, panel-based UI.

---

## 1. Vision

v1 proved the engine: a fully automated Mahdi-solo Harkonnen AI, both victory paths, and a
trustworthy rules core (275 unit tests + a CI-run full-game E2E suite). But the UI grew as a
**stack of form-like panels** — you *administer* the game.

v2 reimagines the app as a **game table, not a form**. The board map becomes the entire stage;
everything the player does happens *on* or *around* the board through one guided flow. It should
feel like a modern strategy-game companion: atmospheric, tactile, and so directive that a player
who has never read the solo rules can play their first game with zero friction.

> **One-line pitch:** open the app, and Arrakis tells you the one thing to do next — beautifully.

## 2. Goals & non-goals

### Goals
1. **Board-first UI.** The map is the home screen and fills the viewport; panels become
   contextual sheets and overlays anchored to it.
2. **One next action, always.** A persistent guide ("Now: roll the Harkonnen die and tap the
   face") replaces panel-hunting. Every game moment has exactly one highlighted affordance.
3. **Dune atmosphere, 100 % original art.** A complete visual identity — palette, custom icon
   set, textures, typography, motion — evocative of Arrakis without reproducing any
   CMON/GF9/franchise asset.
4. **Feature parity with v0.4.0** (§8) — nothing the engine can do gets lost.
5. **Phone-first.** Designed at 390 px first, enhanced for tablet/desktop; PWA install remains.

### Non-goals
- No rules-engine rewrite (see §10 — the engine is reused as-is).
- No multiplayer, no expansions (Smugglers / Spacing Guild / Possible Futures) — same scope as v1.
- No backend/accounts; local-first stays.
- No official artwork, card scans, or rulebook text — ever (legal policy unchanged).

## 3. Players

- **P1 — The owner (primary):** knows the board game, wants the Harkonnen bookkeeping gone and
  the table time to feel like Dune. Plays with the phone/tablet propped next to the board.
- **P2 — The newcomer:** bought the game, bounced off the solo rules. Needs the app to *teach
  while playing*.
- **P3 — The returner:** last played weeks ago; needs the app to reload state and re-orient them
  in ten seconds (status ribbon + "now do this").

## 4. Design principles

1. **The board is the truth, the app is the voice.** The physical table stays canonical; the app
   issues clear, confident directives and mirrors state.
2. **Show, don't list.** State lives on the map (pieces, halos, badges), not in tables. Text
   panels are a last resort.
3. **One tap when possible, two at most.** Confirmations are single-tap; every destructive path
   has Undo rather than "are you sure?".
4. **Guided, never locked.** The flow ribbon nudges the next step, but every tool stays reachable
   — advanced players can jump anywhere.
5. **Atmosphere with restraint.** Texture, motion, and sound set mood at the edges; the play
   surface stays high-contrast and legible in daylight and at night.

## 5. Visual identity ("sand & spice")

All artwork is **created for this project** (SVG/canvas, hand-drawn by us). Trademark hygiene:
the name is used nominatively; the existing disclaimer stays in footer + README.

### 5.1 Palette (design tokens)
| Token | Day | Night | Use |
|---|---|---|---|
| `--sand-0/1/2` | #F4E7C8 / #E4CD9E / #C9A66B | #2A2115 / #37291A / #4A3826 | surfaces, dunes |
| `--spice` | #E0731D | #F08A33 | primary accent, CTAs, "the next action" |
| `--night` | #1B2A3A | #0E1722 | deep backgrounds, battle screen |
| `--harkonnen` | #8B1F30 | #C03A44 | Harkonnen pieces, threats, directives |
| `--atreides` | #2F5D50 | #3F8A72 | Atreides pieces, player actions |
| `--fremen` | #B7783A | #D3A53F | prescience, worms, desert power |
| `--bone` | #FBF6EC | #ECDFC8 | text on dark, cards |

Spice orange is **reserved for "what you do next"** — the single most important affordance on
screen is always the only spice-colored element.

### 5.2 Typography
- **Display:** an OFL-licensed angular/geometric face for titles and directive headlines
  (candidates: *Orbitron*, *Rajdhani*, *Marcellus* — pick in M0 by mockup).
- **Text/UI:** system stack or *Inter* for body; tabular numerals for counters.
- Generous sizes: min 16 px body, 44 px touch targets.

### 5.3 Iconography (original set, ~24 glyphs)
Single-weight stroke SVG set drawn by us: die faces ×5, trooper, elite, Sardaukar/Fedaykin,
leader, deploy token, sietch arch, settlement keep, harvester, ornithopter, carryall, wormsign
ripple, sandworm maw, spice cluster, storm spiral, prescience eye, supremacy fist, ban seal,
objective seal, undo, map, history, settings. (v1's map silhouettes seeded this set; v2
normalizes them into one consistent family used across map *and* UI.)

### 5.4 Texture & motion
- Sand-grain + dune-ripple textures (procedural, already built) across surfaces, stronger at
  edges, never under text.
- Motion vocabulary: **drift** (sheets slide like dunes, 200–250 ms), **shimmer** (spice CTA
  pulse), **tremor** (worm/battle events, small shake), **sweep** (phase transitions wipe like
  blowing sand). All `prefers-reduced-motion` aware.
- Sound: keep v1's synth cues; add 2–3 more (die tap, battle start), still toggleable & subtle.

## 6. Information architecture

```
┌────────────────────────────────────────┐
│ STATUS RIBBON  R3 · Actions · ☠3/10 …  │  ← always visible, tap = round timeline
├────────────────────────────────────────┤
│                                        │
│              BOARD STAGE               │  ← full-viewport map (pan/zoom)
│    (pieces, halos, target, worms…)     │     tap area → AREA SHEET
│                                        │
│   ╭──────────────────────────────╮     │
│   │  GUIDE BAR — "Now: roll the  │     │  ← the one next action (spice)
│   │  Harkonnen die → tap a face" │     │
│   ╰──────────────────────────────╯     │
├────────────────────────────────────────┤
│ DOCK:  ⚔ Turn · 🜁 You · 📜 Log · ⚙      │  ← 4 fixed entries, open bottom sheets
└────────────────────────────────────────┘
```

- **Board stage** — the v1 map (geometry, walls, silhouettes) promoted to the app's canvas.
  Areas glow when they're the answer to "where?"; everything selectable-by-rule stays lit, the
  rest dims (v1 behavior, now the *primary* interaction).
- **Guide bar** — state-machine driven hint + primary button. During the Harkonnen turn it hosts
  the 5 die faces; after a roll it becomes the **directive card**.
- **Directive card** — the AI's order as a styled command (Harkonnen sigil, plain-English order,
  affected areas pulsing on the map behind it). One tap: *Confirm* (auto-apply) or *To battle*.
- **Area sheet** — tap any area: contents (with icons), terrain, adjacency, and contextual
  actions (*Move legion from here*, *Battle here*, *Edit*). Replaces most of the v1 editor for
  mid-game use.
- **Dock sheets:**
  - **⚔ Turn** — full round timeline (phases as a sand-swept progress bar), vehicles this round,
    dice remaining; round driver lives here.
  - **🜁 You (Atreides)** — prescience dial (3 rings), secret objective, stations, reveals,
    Desert Power, move tool. The v1 Atreides panel, redesigned as a tracker, not a form.
  - **📜 Log** — action history timeline with Undo; battle summaries expandable.
  - **⚙ More** — games/saves/import/export, theme, sound, guided setup, help, about+disclaimer.
- **Battle screen** — full-screen takeover (night palette): both legions as icon rows, leader
  strips shown as cards, big tap-to-count dice, round-by-round drama, outcome banner → applies.
- **Setup wizard & tutorial** — v1 wizard re-skinned into the new language; first-run auto-offer.
- **Game end** — full-screen victory scene (faction sigil, sand sweep, stats, new game).

## 7. Key flows (acceptance sketches)

1. **First run:** open → cinematic title beat (1 s) → "New here?" → wizard → board staged →
   guide bar: "Begin round 1". *A newcomer reaches their first Harkonnen directive in < 3 min.*
2. **Harkonnen turn:** guide bar shows die faces → tap face → directive card + map highlights →
   Confirm (auto actions) or To battle → log entry + toast + cue. *≤ 2 taps per turn.*
3. **Battle:** directive → battle screen pre-loaded (tokens flip first) → counters → outcome →
   apply. *No scrolling, no pair-hunting.*
4. **Atreides turn:** tap area → sheet actions (move w/ legal-destination glow, take station…) or
   🜁 sheet for track changes. *Every v1 "Your turn" action reachable in ≤ 2 taps from the board.*
5. **Round close:** hazards → storms → spice, each as guided steps in the same guide bar;
   "Start round N+1" sweeps the phase ribbon. *The player never wonders "what now?".*
6. **Game end:** either victory condition → scene → stats (rounds, battles, prescience) → new
   game / review board.

## 8. Functional parity checklist (must-have, from v0.4.0)

Engine-driven: action-die cascade, movement + tie-breakers, stacking (CHOAM), combat + casualty
priority + leader strips (both factions), deployment + garrison rule, vehicles, mentat, house,
cards & leader specials, wormsigns, storms, Spice Must Flow, supremacy, prescience economy,
secret objective, Bene Gesserit rule, voluntary-reveal rule, tactical draws & round structure.
App-level: map-first rule-filtered picks everywhere, undo/history, toasts+sound, auto-save +
named saves + export/import (same JSON envelope — **saves must round-trip between v1 and v2**),
PWA offline, dark/day themes, guided setup, disclaimer, favicon/app icons.

## 9. Non-functional

- **Performance:** first load < 150 KB gz JS (engine ~40 KB); map interactions 60 fps on a
  mid-range phone; no layout thrash on sheet open.
- **Accessibility:** WCAG AA contrast in both themes; full keyboard path; `prefers-reduced-motion`;
  icons always paired with labels in sheets.
- **Responsive:** 390 px phone (primary), 768 px tablet (board + persistent right rail), ≥1200 px
  desktop (board + two rails).
- **Quality bar:** engine tests untouched & green; new component tests for view-models; the
  5-journey Playwright suite rewritten against the new UI **before** v2 replaces v1.

## 10. Technical approach

- **Reuse `src/engine/` unchanged.** It is UI-agnostic, 275-tested, and correct. The reimagining
  is 100 % presentation + interaction. (This is the single biggest de-risking decision.)
- **New `src/ui2/`** built beside v1 (`src/ui/` stays until parity): React 18 + TS + Vite, no
  component framework; design tokens as CSS custom properties; state via a thin view-model layer
  (`useGame` reducer wrapping GameState + a `flow` state machine for the guide bar).
- **Board stage** grows from `BoardMap.tsx` (geometry, walls, silhouettes are v2-quality already)
  → extracted into `ui2/stage/` with a proper camera (inertial pan/zoom) and a highlight system.
- **Entry switch:** `main.tsx` mounts ui2; a `?classic` query param keeps v1 reachable during the
  transition. When parity ships, v1 UI is deleted and v2 becomes `v1.0.0`.
- **CI:** unchanged workflows; E2E spec forked to `e2e/v2-full-game.spec.ts` at M2.

## 11. Milestones

| M | Deliverable | Exit criteria |
|---|---|---|
| **M0** | Design system: tokens, typography pick, icon set v1, app shell (ribbon/stage/guide/dock) | Shell renders on phone; theme toggle; mockup approved by owner |
| **M1** | Board stage: camera, highlights, area sheet | Tap-to-inspect + rule-filtered pick works on stage |
| **M2** | Harkonnen loop: die faces → directive card → confirm; log; E2E fork | Full action phase playable; ≤2 taps/turn |
| **M3** | Battle screen + handoff | Battle E2E green on new UI |
| **M4** | Atreides sheet + victory scenes | Both victories reachable; prescience dial |
| **M5** | Hazards, storms, spice, round driver in guide bar | Full round E2E green |
| **M6** | Wizard re-skin, onboarding, polish (motion/sound), a11y pass | Newcomer flow < 3 min; AA contrast audit |
| **M7** | Parity sign-off → swap default UI, delete v1 UI, release **v1.0.0** | All §8 items checked; owner playtest approval |

## 12. Success metrics

- Taps per Harkonnen turn: **≤ 2** (v1: 3–6 + scrolling).
- Time to first directive for a newcomer: **< 3 min** (v1: ~10 with reading).
- "What do I do now?" moments: **zero** — guide bar always populated.
- Owner playtest verdict: *would not go back to v1.*

## 13. Risks

| Risk | Mitigation |
|---|---|
| Art scope creep (icon set, motion) | Icon set capped at ~24; motion vocabulary capped at 4 patterns |
| Rebuild stalls mid-way, two UIs linger | v1 stays default until M7 parity gate; each milestone is shippable on `v2` |
| Phone-first hurts desktop | Tablet/desktop rails specified from M0; stage is resolution-independent SVG |
| Font/licensing mistakes | OFL-only fonts, vendored; no icon fonts from unknown sources |
| Save incompatibility | Same GameState JSON + envelope; round-trip test in CI |

## 14. Open questions (owner input wanted — defaults will be used otherwise)

1. **Name the reimagining?** Default: keep the app name; v2 is a redesign, not a rebrand.
2. **Display font taste:** angular sci-fi (*Orbitron/Rajdhani*) vs classical epic (*Marcellus*)?
   Default: decide by side-by-side mockup in M0.
3. **Title beat / ambient background** (subtle drifting dunes behind the board): yes or too much?
   Default: build it behind a "reduce atmosphere" toggle.
4. **Tablet rail layout** (board left, turn rail right) — matches how you prop the device at the
   table? Default: yes.
