// End-to-end: everything a player + the app need to complete a Mahdi-solo game, driven through
// the real UI against the production build. Four journeys:
//   1. a full round from a fresh game (setup → vehicles → all 5 action dice → hazards → storms →
//      spice → next round),
//   2. a battle from co-located legions (token reveal → dice rounds → commit),
//   3. a manual map move with the rule-filtered picker (+ the settlement garrison drop),
//   4. both victory paths ending in the game-over screen (Atreides objective, Harkonnen supremacy).
//
// Where the engine draws randomly (target sietch, harvesting sector) the tests handle every
// branch a die resolution can produce instead of pinning outcomes.

import { test, expect, type Page, type Locator } from '@playwright/test';
import { newGameState } from '../src/engine/newGame';
import type { GameState } from '../src/engine/state';
import { STORAGE_KEY } from '../src/ui/persistence';

/** Seed the app's saved game before load, so a test starts from a known state. */
async function seed(page: Page, state: GameState) {
  await page.addInitScript(
    ([key, json]) => localStorage.setItem(key, json),
    [STORAGE_KEY, JSON.stringify(state)] as const,
  );
}

async function open(page: Page) {
  await page.goto('/');
  // Collapse the help panel so panel headings are near the viewport.
  const help = page.locator('details.help[open] summary');
  if (await help.count()) await help.click();
}

const panel = (page: Page, heading: string | RegExp): Locator =>
  page.locator('section.panel', { has: page.getByRole('heading', { name: heading }) });

/** Click +N times on a Counter stepper (aria-label "<label> +1") inside `scope`. */
async function bump(scope: Locator, label: string, times: number) {
  const btn = scope.getByRole('button', { name: `${label} +1` });
  for (let i = 0; i < times; i++) await btn.click();
}

/** Fight the currently-open battle to its end: reveal tokens if asked, max Harkonnen swords
 *  each round, apply until an outcome banner appears, then commit it. */
async function runBattle(page: Page) {
  const battle = panel(page, /^Battle$/);
  const fight = battle.getByRole('button', { name: 'Fight' }).first();
  const reveal = battle.getByRole('button', { name: 'Reveal & begin battle' });
  const applyRound = battle.getByRole('button', { name: 'Apply round' });
  const banner = battle.locator('.win-banner');

  // The attack handoff focuses the pair but the player still taps Fight; and a battle whose
  // legions hold facedown deployment tokens flips them to units first.
  await expect(fight.or(reveal).or(applyRound).first()).toBeVisible();
  if (await fight.isVisible()) await fight.click();
  await expect(reveal.or(applyRound).first()).toBeVisible();
  if (await reveal.isVisible()) await reveal.click();

  for (let round = 0; round < 8; round++) {
    await expect(applyRound.or(banner).first()).toBeVisible();
    if (await banner.isVisible()) break;
    await bump(battle.locator('.storm-row', { hasText: 'Harkonnen roll' }), 'Swords', 6);
    await applyRound.click();
  }
  await expect(banner).toBeVisible();
  await battle.getByRole('button', { name: 'Apply to game state' }).click();
}

test('a full round plays end-to-end from a fresh game', async ({ page }) => {
  page.on('dialog', (d) => d.accept()); // "Start a fresh game?" confirm
  await open(page);

  // Setup: start a real new game (the seedless page loads the demo state).
  const setup = page.locator('details.setup-group');
  if (!(await setup.getAttribute('open'))) await setup.locator('summary.setup-summary').click();
  await page.getByRole('button', { name: 'New game', exact: true }).click();
  await expect(page.locator('.status-strip')).toContainText('R1');
  await expect(page.locator('.status-strip')).toContainText('Setup');

  // Round driver: begin round 1 (draws the tactical cards), then step to Actions.
  const walkthrough = panel(page, 'Round walkthrough');
  await walkthrough.getByRole('button', { name: /Begin round 1/ }).click();
  await expect(page.locator('.status-strip')).toContainText('Vehicles');
  await expect(panel(page, 'Vehicle placement')).toBeVisible();
  await walkthrough.getByRole('button', { name: /Next: Actions/ }).click();

  // Resolve every die face once, handling whichever directive the AI produces.
  const resolve = panel(page, 'Resolve Harkonnen turn');
  for (const face of ['Deployment', 'House', 'Mentat', 'Strategy', 'Leadership']) {
    await resolve.locator('.die-row').getByRole('button', { name: face }).click();
    await expect(resolve.locator('.directive')).toBeVisible();
    const confirm = resolve.getByRole('button', { name: 'Confirm & apply' });
    const attack = resolve.getByRole('button', { name: /open battle/ });
    if (await confirm.isVisible().catch(() => false)) {
      await confirm.click();
    } else if (await attack.isVisible().catch(() => false)) {
      await attack.click();
      await runBattle(page);
    } // else: a player-resolved directive (e.g. Mentat card draws) — nothing to apply here.
  }

  // Desert hazards: wormsigns (if any are placeable) then storms (apply zero-dice results).
  await walkthrough.getByRole('button', { name: /Next: Hazards/ }).click();
  const wormsigns = panel(page, /^Wormsigns$/);
  const place = wormsigns.getByRole('button', { name: 'Place wormsigns' });
  if (await place.isEnabled().catch(() => false)) await place.click();
  const storms = panel(page, 'Coriolis Storms');
  const applyStorms = storms.getByRole('button', { name: 'Apply storm casualties' });
  if (await applyStorms.isVisible().catch(() => false)) await applyStorms.click();

  // Spice Must Flow, then roll into round 2 (supremacy +1 is the end-of-round rule).
  await walkthrough.getByRole('button', { name: /Next: Spice/ }).click();
  await panel(page, 'Spice Must Flow').getByRole('button', { name: 'Apply harvesting' }).click();
  await walkthrough.getByRole('button', { name: /Next: End/ }).click();
  await walkthrough.getByRole('button', { name: /Start round 2/ }).click();

  await expect(page.locator('.status-strip')).toContainText('R2');
  await expect(page.locator('.status-strip')).toContainText('Supremacy 1/10');
});

test('a battle runs from token reveal to a committed result', async ({ page }) => {
  // A Harkonnen strike force stands on Gara Kulon with its Atreides defenders (1 token + Naib).
  const s = newGameState();
  s.phase = 'action_resolution';
  s.legions = [
    ...s.legions,
    {
      faction: 'harkonnen',
      area: 'gara_kulon',
      units: { regular: 4, elite: 0, special_elite: 0 },
      deploymentTokens: 0,
      leaders: [{ kind: 'generic', faction: 'harkonnen' }],
    },
  ];
  await seed(page, s);
  await open(page);

  const battle = panel(page, /^Battle$/);
  await expect(battle).toContainText('Gara Kulon');
  await battle.getByRole('button', { name: 'Fight' }).click();
  // The defender's facedown deployment token flips to units first.
  await expect(battle.getByRole('button', { name: 'Reveal & begin battle' })).toBeVisible();
  await runBattle(page);
  // Defender was 1 token + a Naib vs 6 swords: the Harkonnen take the sietch.
  await expect(page.locator('.toast')).toContainText('applied');
});

test('a manual map move is rule-filtered and drops the settlement garrison', async ({ page }) => {
  const s = newGameState();
  s.phase = 'action_resolution';
  s.legions = [
    ...s.legions.filter((l) => l.area !== 'carthag'),
    {
      faction: 'harkonnen',
      area: 'carthag',
      units: { regular: 2, elite: 0, special_elite: 0 },
      deploymentTokens: 0,
      leaders: [],
    },
  ];
  // A fresh game's token pool is empty (all 12 start on the settlements) — give the pool a few
  // back, as if some were revealed earlier, so the garrison drop has tokens to draw.
  s.harkonnenReserve = { ...s.harkonnenReserve, deploymentTokens: 4 };
  await seed(page, s);
  await open(page);

  const move = panel(page, 'Move a legion');
  const row = move.locator('.move-row', { hasText: 'Carthag' }).first();
  await row.getByRole('button', { name: 'Move / split' }).click();
  await row.getByRole('button', { name: /Pick destination on map/ }).click();

  // The map overlay opens in pick mode; Arsunt is an adjacent free area → legal.
  const overlay = page.locator('.map-modal');
  await expect(overlay).toBeVisible();
  await expect(overlay.locator('.map-pick-banner')).toContainText('legal move destinations');
  await overlay.locator('path[data-area="arsunt"]').click();

  // Move applied: legion now at Arsunt, and leaving the Carthag settlement dropped 2 garrison
  // deployment tokens there (solo rule).
  await expect(page.locator('.toast')).toContainText('Moved');
  await expect(move.locator('.move-row', { hasText: 'Arsunt' })).toContainText('2 reg');
  await expect(move.locator('.move-row', { hasText: 'Carthag' })).toContainText('2 tokens');
});

test('the guided setup wizard walks through and starts a fresh game', async ({ page }) => {
  await open(page);
  // The help panel offers guided setup for first-time players; the Games panel also has it
  // (the help panel is collapsed by open(), so use the Games one).
  const setup = page.locator('details.setup-group');
  if (!(await setup.getAttribute('open'))) await setup.locator('summary.setup-summary').click();
  await page.getByRole('button', { name: '🧭 Guided setup' }).click();
  const wizard = page.locator('.wizard');
  await expect(wizard).toContainText('Welcome to Mahdi solo');
  // Step through every page (7 steps → 6 Next clicks), then start the game.
  for (let i = 0; i < 6; i++) await wizard.getByRole('button', { name: 'Next →' }).click();
  await expect(wizard).toContainText('How a round flows');
  await wizard.getByRole('button', { name: 'Start the game' }).click();
  await expect(wizard).toBeHidden();
  await expect(page.locator('.status-strip')).toContainText('R1');
  await expect(page.locator('.status-strip')).toContainText('Setup');
  await expect(page.locator('.toast')).toContainText('New game applied');
});

test('both victory paths end in the game-over screen', async ({ page }) => {
  // Atreides: enter the secret objective, then destroying Arrakeen (+3 to all markers) wins.
  const s = newGameState();
  s.phase = 'action_resolution';
  await seed(page, s);
  await open(page);

  const atreides = panel(page, 'Your turn (Atreides)');
  const goals = atreides.locator('.pm-objective input');
  for (let i = 0; i < 3; i++) await goals.nth(i).fill('2');
  await atreides.getByRole('button', { name: /Arrakeen \(rank 3\)/ }).click();

  const gameover = page.locator('.gameover');
  await expect(gameover).toContainText('Atreides victory');
  await expect(gameover).toContainText('Secret Objective');
  // "Keep reviewing" dismisses; undoing the win re-arms the overlay next time it happens.
  await gameover.getByRole('button', { name: 'Keep reviewing the board' }).click();
  await expect(gameover).toBeHidden();

  // Harkonnen: supremacy 9 at round end → starting the next round reaches 10.
  const h = newGameState();
  h.phase = 'end';
  h.round = 6;
  h.tracks = { ...h.tracks, supremacy: 9 };
  await seed(page, h);
  await open(page);
  await panel(page, 'Round walkthrough').getByRole('button', { name: /Start round 7/ }).click();
  await expect(page.locator('.gameover')).toContainText('Harkonnen victory');
  // Start a new game from the overlay: back to a fresh setup.
  page.on('dialog', (d) => d.accept());
  await page.locator('.gameover').getByRole('button', { name: 'Start a new game' }).click();
  await expect(page.locator('.gameover')).toBeHidden();
  await expect(page.locator('.status-strip')).toContainText('R1');
});
