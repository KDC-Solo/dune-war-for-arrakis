# Changelog

All notable changes to this project are documented here. Format loosely follows
[Keep a Changelog](https://keepachangelog.com); versions follow [semver](https://semver.org).

## [Unreleased]

### Fixed
- **Troop transport now consumes the ornithopter** (rulebook: "Remove the ornithopter and either
  move or attack with the legion up to 1 additional area away") — both on manual 2‑area moves and
  when an AI sietch‑attack directive rides an ornithopter into battle.
- **Wormsigns now resolve every Desert Hazards phase** — new "Flip & resolve" step in the guide:
  flip all signs on the physical board, record sandworm appearances by tapping the area, then
  "Signs resolved" shuffles every token back into the pool (they no longer pile up round after
  round). Discarding a wormsign anywhere now returns it to the pool.

### Added
- **Sandworm resolution tools on the area sheet** — one‑tap "Sandworm appears (discard sign)",
  "Sandworm (devours harvester)", and "Sandworm (carryall saves harvester)" (spends a carryall
  from a connected air zone, per the Desert Hazards rescue rule); plus manual +/− Harvester for
  board fix‑ups.
- **The AI makes the card choices** — planning cards printed with "of your choice" address the
  Harkonnen side, so the Mahdi bot now decides them instead of the player (who would otherwise
  pick against themselves). Free placements are chosen and auto‑applied (Battle Group's mountain
  area, Patrols' desert areas, Evidence of Rebellion's settlement, Spotter Control's wormsign
  discards, Sardaukar Disguised's elite→Sardaukar swaps, leader drops from the deploy priority);
  move/attack choices come back as directives naming the exact legion, destination, and target
  ("Mahdi's pick") — including the Sardaukar cards, Troop Carriers, Shigawire's leader hunt,
  Hunter‑Seeker's victim, and Spies All Over Arrakis' reveal area (`cardChoices.ts`, 27 new tests).
- **Mentat difficulty** — a fifth Harkonnen brain above Baron: lowest temperature, the longest
  plans, and a one‑ply lookahead that avoids moves leaving a legion or settlement hanging to the
  best visible Atreides reply. Still honest: it reads only what a human opponent could see.
- **Brain plans** — the human‑like brains now hold a multi‑round intention (push a sietch /
  defend a settlement) that persists through saves and undo, and bias their dice decisions
  toward it instead of re‑deciding from zero on every die.
- **Deployment variants** — brains weigh three drop schemes (Mahdi's default, reinforce the
  push, shore up the threatened settlement) instead of always copying the Mahdi placement.

### Changed
- **The guide bar floats over the map** — the board now keeps the entire stage height. The
  guide hovers bottom‑center, drags anywhere by its grip strip (position remembered), and
  collapses to a small pill; it re‑expands on its own when the game moves to a new phase,
  directive, or map pick.
- Watchful brains no longer count Naib garrisons sitting in their sietches as threats to
  settlements, so Baron stops cowering in the early game.

## [1.0.0] — 2026-07-04

**The board‑first reimagining ships as the app.** The v2 interface (full‑viewport stage, guide
bar, sheets, battle takeover) replaces the v1 panel UI, after two days of autonomous + owner
playtesting. Saves from 0.x load unchanged.

### Added
- **Board‑first interface** — the map is the app: status ribbon, spice‑orange guide bar that
  always shows the one next action (die faces → directive cards → phase panels), 4‑dock bottom
  sheets (Turn / You / Log / More), tap‑any‑area sheets with in‑place editing, full‑screen
  night‑palette battle screen, victory scenes, first‑run welcome + reskinned setup wizard.
- **Atreides‑initiated battles** — attack adjacent Harkonnen legions from the area sheet; cease
  any round after the first; taking a settlement destroys it (+prescience by rank) and removes
  harvesters; faction‑aware casualty rules and reserve refunds.
- **Battle model per rulebook p26** — battles fight from adjacency (no attacker pre‑move), cease
  keeps both survivors in place, the victor advances (merging with friendlies; garrison drop on
  leaving a settlement); the settlement‑assault continue cost lands at the start of rounds 2+.
- **Named‑leader chips** — add/remove all 15 named leader cards (7 Harkonnen/Corrino +
  8 Atreides/Fremen) on any legion from the area sheet; combat strips verified in battle.
- **Atreides planning deck** — all 36 cards (18 House Atreides incl. the three Smugglers
  variants + 18 Fremen Ally incl. Shai‑Hulud ×3) modeled and browsable from the You sheet.
- **Dice accounting, both sides** — the Harkonnen pool is counted per round (die taps land in
  the chronicle, faces disable when spent), and your action dice drive a live **Desert Power
  availability** badge; both counters have correction steppers.
- **Battle‑screen clarity** — labeled unit rows (Reg/Elite/Fedaykin/Tokens/Naib…) and an inline
  dice‑math explainer (units roll; leaders convert ✴ Specials; rank and surprise bonuses).

### Changed
- Undo now checkpoints quiet tracker edits (markers, reserve, area edits) as coalesced chronicle
  entries, and phase advances are logged steps — nothing is silently swallowed.
- A partial Secret Objective (any goal still 0) never declares an Atreides victory.
- Starting/loading/importing a game clears every leftover sheet, move pick, and battle overlay.

### Removed
- The v1 panel UI (`?classic`), its state editor, and the v1 E2E suite. The engine, saves, and
  all shared modules (board map, wizard, persistence) are unchanged — 0.x saves load as‑is.

## [0.4.0] — 2026-07-03

The "everything in the plan" release: both victory paths, the Atreides turn panel, guided
onboarding, an original‑art map, dark theme, PWA install, and a CI‑run full‑game E2E suite.

### Added
- **Victory engine** — the Atreides Secret Objective (player‑entered targets) joins the Harkonnen
  supremacy track; prescience economy (cards, testing stations, settlement destruction) and a
  proper **end‑of‑game screen** for both winners (the `alert()` is gone).
- **"Your turn (Atreides)" panel** — prescience markers + objective, take testing stations,
  destroy settlements, reveal sietches (voluntary‑reveal reinforcement rule), and the solo
  Bene Gesserit rule — no more mid‑game editor digging.
- **Atreides named leaders** — all 8 House Atreides / Fremen Ally leaders with their real combat
  strips resolve in battles; editor picker for Atreides legions.
- **Attack → battle handoff** — attack directives move the attacker in and open the Battle panel
  focused on that fight.
- **Guided setup wizard** — 7 steps from an empty table to a running game, with tappable area
  chips and a "how a round flows" primer.
- **Map art pass (all original)** — hand‑drawn piece silhouettes (troopers with counts, sietch
  arches, settlement keeps, harvester crawlers, sandworm maw vs wormsign ripple, air‑zone wing
  marks), sand‑grain texture, deep‑desert ripples, and the board's double‑red impassable walls
  traced along full shared borders.
- **Night on Arrakis** dark theme (full contrast sweep; Harkonnen‑crimson accent) and subtle
  WebAudio **sound cues** (both toggleable in the header).
- **PWA** — installable, offline‑capable (manifest + auto‑updating service worker) — replaces the
  old Capacitor plan. Favicon + app icons (original art).
- **Full‑game E2E suite** — 5 Playwright journeys (full round, battle, rule‑filtered map move,
  wizard, both victories) running on every push/PR in CI.
- Sticky **status strip**; single **round driver** in the walkthrough; toasts + history entries
  for every applied action; tap‑friendly −/+ steppers for all dice entry; footer version + GitHub
  link.

### Changed
- **Map‑first everywhere:** every area selection opens the board map with only rule‑legal areas
  selectable (moves respect sandriding/troop‑transport/stacking room; deploys respect settlements
  and capacity). The last dropdowns (target sietch, deploy destination) are gone.
- Manual moves respect the stacking limit (destination‑capacity clamp, CHOAM‑aware) and drop the
  2‑token garrison when fully leaving a settlement; "This round" is info‑only; Games/editor
  collapse into a Setup group; the Reset‑to‑demo button was removed.

### Fixed
- Gaius Helen Mohiam's solo special is the p9 override (draw 3 Corrino cards).
- Battle token‑reveal labels are faction‑correct (Fedaykin, not Sardaukar, for Atreides).
- Impassable walls no longer render as short stubs/ticks.
- Pages deploys auto‑retry after GitHub's transient "try again later" error.

### Engine
- **275 unit tests** (victory, stacking, garrison, Atreides leaders, reserve‑deploy areas) plus
  the 5‑journey Playwright suite.

[0.4.0]: https://github.com/ianpogi5/dune-war-for-arrakis/releases/tag/v0.4.0

## [0.3.0] — 2026-07-01

A playtesting pass: the board map became a floating pop-over used for every area pick, deployment
and round-setup got the rules right, and the editor gained safety rails.

### Added
- **Floating board map** — the map now opens as a full-screen overlay from a 🗺 button (bottom-right)
  anywhere on the page, and automatically whenever you set an area. Picking an area closes it and
  returns you to your exact scroll position, with a confirmation toast.
- **Map-first area pickers** — legions, wormsigns and sandworms are set by tapping the board (a
  📍 field showing the current area) instead of a dropdown of (often unnamed) area names. Adding one
  opens the picker straight away.
- **Deploy from reserve** — a form that moves units + a leader onto the board while drawing them
  down from the reserve pool, so board and reserve totals stay in sync.
- **Figure-budget drift indicator** — the reserve section reconciles unit figures (board + reserve)
  against the game's component counts and flags a total that goes over budget.
- **Desert Power wormsigns** — an exposed action-phase panel to place wormsign tokens on the board.
- **Phase-gated panels** — only the current round phase's action panels show (with a "show all"
  toggle), and each sietch now displays its Atreides defender (1 token + Naib).

### Fixed
- **Carryall placement** — a carryall protects harvesters in *both* sectors its air zone borders
  (rulebook), not just the zone's member areas.
- **Round 1 setup** — a new game now has a "Begin round" step that draws the harvesting sector +
  target sietch without ending a round; the +1 supremacy (an end-of-round step) no longer fires
  before round 1 is played.
- **Target sietch pick** restricted to live sietches; **harvesting-sector** options limited to the
  values a tactical draw can produce (`central`, `s1`–`s4`).
- Numeric inputs no longer show a stray leading zero (`03`), and legion unit boxes stay on one row.

### Engine
- Test suite grown to **245 tests** (new `figureBudget` module; `setupRound` split out from
  `startNextRound`).

[0.3.0]: https://github.com/ianpogi5/dune-war-for-arrakis/releases/tag/v0.3.0

## [0.2.0] — 2026-06-30

A board‑map overhaul, a completed in‑app round, locating polish, and a battle‑rules fix.

### Added
- **Real board geometry** — the map now draws each of the 101 areas as its actual traced shape
  (replacing the earlier Voronoi cells), arranged in the board's radial sector structure, with
  impassable walls along shared edges and board‑accurate blue air‑zone circles.
- **Spice Must Flow harvesting panel** — previews the solo spice allocation as a before→after marker
  table and applies it (markers, reserve, bans, supremacy). This was the last round‑completing piece,
  so a full Mahdi‑solo round now runs end‑to‑end in the app.
- **Locate from anywhere** — every area name in the app is a clickable chip that jumps to the board
  map and pulses the area; air‑zone names (vehicle placement, area details) are now clickable too and
  pulse their circle. A "by sector" colour view and a full‑window map view were also added.

### Changed
- Locating an area no longer force‑zooms the map — it re‑centres at the current zoom and shows a
  larger, readable label that scales with the map.
- Map palette matched to the printed components; whole located/selected areas highlight (not just a
  dot).

### Fixed
- **Deployment tokens in battle** — tokens are now revealed to their units at the start of a battle
  (rulebook p24) before combat. Previously the casualty code never removed tokens, so a legion that
  carried tokens into a fight had immortal tokens (a tokens‑only attacker could never be eliminated).
  Harkonnen marker tokens return to the solo pool on reveal.

### Engine
- Test suite grown to **238 tests** (new `revealTokens` module covering the battle‑reveal fix).

[0.2.0]: https://github.com/ianpogi5/dune-war-for-arrakis/releases/tag/v0.2.0

## [0.1.0] — 2026-06-28

First tagged release. The Mahdi‑solo Harkonnen companion is feature‑complete.

### Added
- **Harkonnen decision engine** (pure TypeScript, fully tested): action‑die resolution cascade,
  shortest‑path movement, the "cease attack" rule, deployment, vehicle placement, planning‑card and
  named‑leader special abilities.
- **Battle resolver** — round‑by‑round dice entry with Harkonnen casualty priority, leader combat
  abilities, reinforcement spending, reserve replenishment, and sietch capture.
- **Desert Hazards** — official wormsign placement (terrain + occupancy rules) and Coriolis storms.
- **Spice Must Flow** — imperium markers driving action‑dice/vehicle availability and bans.
- **Interactive board map** — all 101 areas plotted and colored by terrain, game‑state overlays,
  hover/tap details card, "find an area", pinch‑zoom & pan, and an area picker for the editor.
- **Locating labels** for unnamed areas and air zones (named after nearby board landmarks).
- **Game management** — auto‑save, multiple named saves, JSON export/import.
- **Round walkthrough** guiding play phase‑by‑phase.

### Infrastructure
- Continuous deploy to GitHub Pages at https://dune-war-for-arrakis.kdc.sh (custom domain via
  `public/CNAME`).
- Tag‑driven release workflow (GitHub Release with notes + built `dist/` zip).

[0.1.0]: https://github.com/ianpogi5/dune-war-for-arrakis/releases/tag/v0.1.0
