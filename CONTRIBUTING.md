# Contributing

Thanks for helping with the *Dune: War for Arrakis* Mahdi‑solo companion.

## Ground rules

- **The physical board is the source of truth.** The app models the state the Harkonnen AI needs to
  make decisions — it never tries to be the authoritative game state. New features should respect
  that: the player can always correct the app via the editor.
- **Faithful to the rules.** Behavior should trace to the rulebook (cite page/section in comments and
  PRs). When the rules are ambiguous, document the interpretation in a test.

## Project layout

- `src/engine/` — the **headless, pure‑TypeScript rules engine**. No React imports here; every rule
  is unit‑tested. This is where game logic lives.
- `src/ui/` — the **React UI**. It renders engine output and edits state; it should contain no game
  rules (call into the engine instead).
- `src/engine/board.ts`, `boardPositions.ts` — generated board graph + map coordinates (see
  `scripts/`); don't hand‑edit. Regenerate with `npm run gen:board` / `npx tsx scripts/gen_positions.mjs`.

## Setup

```bash
npm install
npm run dev        # http://localhost:5173
```

## Before you push

```bash
npm test           # the full engine test suite must pass
npm run typecheck  # tsc --noEmit, no errors
npm run build      # production build must succeed
```

- **Add tests** for engine changes — prefer a focused unit test next to the module
  (`src/engine/<name>.test.ts`). Bug fixes should come with a regression test.
- **Match the surrounding code** — naming, comment density, and idioms. The engine favors small pure
  functions returning new state.
- **UI changes** that affect behavior: verify in the running app and, when helpful, attach a
  screenshot (the `screenshots/` ones are produced with Playwright against the prod build).

## Commits & PRs

- Small, focused commits with a clear imperative subject (e.g. `Phase 3: …`, `fix: …`,
  `chore: …`). Describe *why* in the body when it isn't obvious.
- Open a PR against `main`. CI runs type‑check, tests, and a build; keep it green.

## Releasing

Maintainers cut versioned releases with `npm version` — see [RELEASING.md](RELEASING.md). Add a
`CHANGELOG.md` entry for user‑facing changes; the release notes are read from it.
