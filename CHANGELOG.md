# Changelog

All notable changes to this project are documented here. Format loosely follows
[Keep a Changelog](https://keepachangelog.com); versions follow [semver](https://semver.org).

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
