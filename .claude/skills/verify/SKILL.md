---
name: verify
description: Build, launch, and drive this app in a real browser to verify a UI/engine change end-to-end.
---

# Verify — Dune: War for Arrakis companion

The app is a Vite + React SPA (a solo-play companion; the player acts on a physical board, the
app runs the Harkonnen AI). Verify changes by driving the built app in a browser.

## Launch

1. `npm run build`
2. `npm run preview -- --port 4173` (run in background)

## Drive

Use **playwright-core** (already in node_modules — NOT full `playwright`) with the **system
Chromium**: `chromium.launch({ executablePath: '/usr/bin/chromium-browser' })`.

The driver script MUST run from the repo root (node can't resolve `playwright-core` from /tmp);
copy the `.mjs` in, run it, delete it afterwards.

## Gotchas / handles

- Fresh visitor: `localStorage.clear()` then set `dwfa.v2.welcomed = 'yes'` to skip the welcome
  veil, then reload.
- Saved game lives at `localStorage['dwfa.state.v1']`; to craft a scenario, mutate that JSON
  (e.g. push a legion into `.legions`) and reload — `src/ui/sampleState.ts` is the default state
  (round 3, `action_resolution`, target sietch `gara_kulon`).
- Settings keys: `dwfa.aiBrain`, `dwfa.advisor`, `dwfa.theme`, `dwfa.atmosphere`.
- Surfaces: dock buttons `.dock-btn` ("Harkonnen" / "Atreides" / "Log" / "More") open `.sheet` over a
  `.sheet-veil` (click the veil at its top-left corner to close). The guide bar (`.guide`) hosts
  the die faces `.g-die` and the directive card `.directive-card`. The Advisor floats over the
  stage as `.advisor-float` (drag by `.adv-head`; `.advisor-float.min` is the collapsed pill;
  position/collapse persist at `dwfa.advisorPos` / `dwfa.advisorMin`).
- Area chips (`.loc-chip`) pan/pulse the board — after clicking, wait ~700ms before screenshot.
- Steppers use aria-labels, e.g. `[aria-label="Atreides dice used +1"]` in the You sheet.

Flows worth driving: tap a die face → directive card → confirm/battle; area tap → AreaSheet →
Move (glowing destinations); More sheet toggles; advisor card (needs `dwfa.advisor = 'on'` and
an Atreides legion with a worthwhile move).

E2E suite (CI-covered, don't re-run as verification): `PLAYWRIGHT_CHROMIUM=/usr/bin/chromium-browser
npm run test:e2e`.
