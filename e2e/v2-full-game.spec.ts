// v2 (board-first UI) end-to-end: the same player journeys as the v1 suite, driven through the
// guide bar / sheets / battle screen. Runs against the default UI (v2 on this branch).

import { test, expect, type Page } from '@playwright/test';
import { newGameState } from '../src/engine/newGame';
import type { GameState } from '../src/engine/state';
import { STORAGE_KEY } from '../src/ui/persistence';

async function seed(page: Page, state: GameState) {
  await page.addInitScript(
    ([key, json]) => localStorage.setItem(key, json),
    [STORAGE_KEY, JSON.stringify(state)] as const,
  );
}

/** Fight the open battle screen to the end with max Harkonnen swords. */
async function runBattle(page: Page) {
  const bs = page.locator('.battle-screen');
  await expect(bs).toBeVisible();
  const reveal = bs.getByRole('button', { name: /Reveal & begin/ });
  const begin = bs.getByRole('button', { name: /Begin battle/ });
  const apply = bs.getByRole('button', { name: 'Apply round' });
  const done = bs.getByRole('button', { name: 'Apply to the game' });

  // An unrevealed sietch demands its rank first (defender adds it to their dice).
  const rank = bs.getByRole('button', { name: 'Rank 2' });
  await expect(rank.or(reveal).or(begin).or(apply).first()).toBeVisible();
  if (await rank.isVisible()) await rank.click();
  await expect(reveal.or(begin).or(apply).first()).toBeVisible();
  if (await reveal.isVisible()) await reveal.click();
  else if (await begin.isVisible()) await begin.click();

  for (let i = 0; i < 8; i++) {
    await expect(apply.or(done).first()).toBeVisible();
    if (await done.isVisible()) break;
    const hk = bs.locator('.bs-rollrow.harkonnen');
    for (let j = 0; j < 6; j++) await hk.getByRole('button', { name: 'Swords +1' }).click();
    await apply.click();
  }
  await done.click();
  await expect(bs).toBeHidden();
}

test('v2: a full round plays through the guide bar', async ({ page }) => {
  page.on('dialog', (d) => d.accept());
  await page.goto('/');
  // First visit: the welcome sheet offers guided setup — take the demo path here.
  const demo = page.getByRole('button', { name: /I know the drill/ });
  if (await demo.isVisible().catch(() => false)) await demo.click();
  // Fresh game via More sheet.
  await page.getByRole('button', { name: 'More' }).click();
  await page.getByRole('button', { name: /New game/ }).click();
  await expect(page.locator('.rb-round')).toHaveText('R1');

  // Round driver in the guide bar.
  await page.getByRole('button', { name: /Begin round 1/ }).click();
  await expect(page.locator('.rb-phase.on')).toHaveText('Vehicles');
  await page.getByRole('button', { name: /Vehicles placed/ }).click();

  // All five dice; handle whichever directive appears.
  for (const face of ['Deployment', 'House', 'Mentat', 'Strategy', 'Leadership']) {
    await page.locator('.g-dice').getByRole('button', { name: face }).click();
    const card = page.locator('.directive-card');
    await expect(card).toBeVisible();
    const confirm = card.getByRole('button', { name: /Confirm/ });
    const battle = card.getByRole('button', { name: /To battle/ });
    if (await confirm.isVisible().catch(() => false)) await confirm.click();
    else if (await battle.isVisible().catch(() => false)) {
      await battle.click();
      await runBattle(page);
    } else await card.getByRole('button', { name: 'Dismiss' }).click();
    await expect(card).toBeHidden();
  }
  await page.getByRole('button', { name: /Actions done/ }).click();

  // Hazards: wormsigns then storms inside the guide slot.
  const worms = page.getByRole('button', { name: /Apply wormsigns|Continue to storms/ });
  if (await worms.isVisible().catch(() => false)) await worms.click();
  const storms = page.getByRole('button', { name: 'Apply storms' });
  if (await storms.isVisible().catch(() => false)) await storms.click();
  await page.getByRole('button', { name: /Hazards done/ }).click();

  // Spice, then the next round.
  await page.getByRole('button', { name: /Apply harvest/ }).click();
  await page.getByRole('button', { name: /Harvest applied/ }).click();
  await page.getByRole('button', { name: /Start round 2/ }).click();
  await expect(page.locator('.rb-round')).toHaveText('R2');
});

test('v2: an adjacent battle advances the victor into the taken sietch', async ({ page }) => {
  const s = newGameState();
  s.phase = 'action_resolution';
  s.legions = [
    ...s.legions,
    {
      faction: 'harkonnen',
      area: 's1_11', // adjacent to gara_kulon — battles are fought from next door
      units: { regular: 4, elite: 0, special_elite: 0 },
      deploymentTokens: 0,
      leaders: [{ kind: 'generic', faction: 'harkonnen' }],
    },
  ];
  await seed(page, s);
  await page.goto('/');
  await page.locator('path[data-area="gara_kulon"]').dispatchEvent('click');
  await page.getByRole('button', { name: /Battle — Harkonnen attack from/ }).click();
  await runBattle(page);
  // Victory → the attacker advanced into the sietch area; the chronicle logged it.
  await page.locator('path[data-area="gara_kulon"]').dispatchEvent('click');
  await expect(page.locator('.area-sheet')).toContainText('Harkonnen');
  await expect(page.locator('.area-sheet')).toContainText('destroyed');
});

test('v2: a ceased attack leaves both legions where they started', async ({ page }) => {
  const s = newGameState();
  s.phase = 'action_resolution';
  s.legions = [
    // Beef up the defenders (no tokens → no reveal step) and send a lone attacker.
    ...s.legions.filter((l) => l.area !== 'gara_kulon'),
    {
      faction: 'atreides',
      area: 'gara_kulon',
      units: { regular: 3, elite: 0, special_elite: 0 },
      deploymentTokens: 0,
      leaders: [{ kind: 'generic', faction: 'atreides' }],
    },
    {
      faction: 'harkonnen',
      area: 's1_11',
      units: { regular: 1, elite: 0, special_elite: 0 },
      deploymentTokens: 0,
      leaders: [],
    },
  ];
  await seed(page, s);
  await page.goto('/');
  await page.locator('path[data-area="gara_kulon"]').dispatchEvent('click');
  await page.getByRole('button', { name: /Battle — Harkonnen attack from/ }).click();
  const bs = page.locator('.battle-screen');
  const rank = bs.getByRole('button', { name: 'Rank 1' });
  if (await rank.isVisible().catch(() => false)) await rank.click();
  const begin = bs.getByRole('button', { name: /Begin battle/ });
  if (await begin.isVisible().catch(() => false)) await begin.click();
  // Outnumbered ≥2:1, the Harkonnen cease — possibly before any round is rolled.
  const apply = bs.getByRole('button', { name: 'Apply round' });
  const done = bs.getByRole('button', { name: 'Apply to the game' });
  for (let i = 0; i < 4; i++) {
    await expect(apply.or(done).first()).toBeVisible();
    if (await done.isVisible()) break;
    const at = bs.locator('.bs-rollrow.atreides');
    await at.getByRole('button', { name: 'Swords +1' }).click();
    await apply.click();
  }
  await expect(bs).toContainText(/defenders hold|attackers are wiped/);
  await done.click();
  // Rulebook: survivors remain where they started — never co-located.
  await page.locator('path[data-area="gara_kulon"]').dispatchEvent('click');
  const sheet = page.locator('.area-sheet');
  await expect(sheet).toContainText('Atreides');
  await expect(sheet).not.toContainText('Harkonnen attack from here');
});

test('v2: entering the objective and destroying Arrakeen wins the game', async ({ page }) => {
  page.on('dialog', (d) => d.accept());
  const s = newGameState();
  s.phase = 'action_resolution';
  await seed(page, s);
  await page.goto('/');
  await page.getByRole('button', { name: 'You' }).click();
  const goals = page.locator('.dial-goal input');
  for (let i = 0; i < 3; i++) await goals.nth(i).fill('2');
  await page.getByRole('button', { name: /Arrakeen/ }).click();
  const scene = page.locator('.victory');
  await expect(scene).toContainText('The Sleeper Awakens');
  await scene.getByRole('button', { name: /Begin a new campaign/ }).click();
  await expect(scene).toBeHidden();
  await expect(page.locator('.rb-round')).toHaveText('R1');
  // The You sheet we won from must be gone — the fresh board is immediately playable.
  await expect(page.locator('.sheet-veil')).toBeHidden();
  await page.getByRole('button', { name: /Begin round 1/ }).click();
  await expect(page.locator('.rb-phase.on')).toHaveText('Vehicles');
});

test('v2: a legion moves via the glowing legal destinations', async ({ page }) => {
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
  s.harkonnenReserve = { ...s.harkonnenReserve, deploymentTokens: 4 };
  await seed(page, s);
  await page.goto('/');
  await page.locator('path[data-area="carthag"]').dispatchEvent('click');
  await page.getByRole('button', { name: /Move/ }).first().click();
  await expect(page.locator('.guide')).toContainText('Choose a destination');
  await page.locator('path[data-area="arsunt"]').dispatchEvent('click');
  await expect(page.locator('.toast2')).toContainText('Legion moved');
  // Garrison rule: leaving Carthag dropped 2 tokens there.
  await page.locator('path[data-area="carthag"]').dispatchEvent('click');
  await expect(page.locator('.area-sheet')).toContainText('2 tok');
});


test('v2: battling an unrevealed sietch demands the rank and adds it to the defender dice', async ({ page }) => {
  const s = newGameState();
  s.phase = 'action_resolution';
  s.legions = [
    ...s.legions,
    {
      faction: 'harkonnen',
      area: 's1_11',
      units: { regular: 4, elite: 0, special_elite: 0 },
      deploymentTokens: 0,
      leaders: [],
    },
  ];
  await seed(page, s);
  await page.goto('/');
  await page.locator('path[data-area="gara_kulon"]').dispatchEvent('click');
  await page.getByRole('button', { name: /Battle — Harkonnen attack from/ }).click();
  const bs = page.locator('.battle-screen');
  // Rank prompt gates everything.
  await expect(bs).toContainText('rank token');
  await bs.getByRole('button', { name: 'Rank 3' }).click();
  await bs.getByRole('button', { name: /Reveal & begin/ }).click();
  // Defender: 1 revealed regular + rank 3 = 4 dice.
  await expect(bs).toContainText('4 Atreides dice');
});

test('v2: a named Atreides leader added via the area-sheet chips fights with its combat strip', async ({ page }) => {
  const s = newGameState();
  s.phase = 'action_resolution';
  s.legions = [
    ...s.legions.filter((l) => l.area !== 'gara_kulon'),
    {
      faction: 'atreides',
      area: 'gara_kulon',
      units: { regular: 4, elite: 0, special_elite: 0 },
      deploymentTokens: 0,
      leaders: [],
    },
    {
      faction: 'harkonnen',
      area: 's1_11',
      units: { regular: 4, elite: 0, special_elite: 0 },
      deploymentTokens: 0,
      leaders: [],
    },
  ];
  s.sietches = s.sietches.map((si) => (si.area === 'gara_kulon' ? { ...si, revealed: true, rank: 1 as const } : si));
  await seed(page, s);
  await page.goto('/');
  // Add Stilgar (⚔2) to the defenders through the edit chips.
  await page.locator('path[data-area="gara_kulon"]').dispatchEvent('click');
  const sheet = page.locator('.area-sheet');
  await sheet.locator('.as-legion.atreides').getByRole('button', { name: 'Edit' }).click();
  await sheet.getByRole('button', { name: 'Stilgar', exact: true }).click();
  await expect(sheet.locator('.as-named')).toContainText('Stilgar');
  // Fight: 1 Atreides Special converts to 2 hits; +1 sietch assault hit → attacker 4 → 1.
  await page.getByRole('button', { name: /Battle — Harkonnen attack from/ }).click();
  const bs = page.locator('.battle-screen');
  await expect(bs.locator('.bs-col.atreides .bs-named')).toContainText('Stilgar');
  await bs.getByRole('button', { name: /Begin battle/ }).click();
  await bs.locator('.bs-rollrow.atreides').getByRole('button', { name: 'Specials +1' }).click();
  await bs.getByRole('button', { name: 'Apply round' }).click();
  await expect(bs.locator('.bs-col.harkonnen')).toContainText('1');
  await expect(bs.locator('.bs-col.atreides')).toContainText('4');
});

test('v2: a campaign plays from round 1 until someone wins', async ({ page }) => {
  test.setTimeout(300_000);
  page.on('dialog', (d) => d.accept());
  await page.goto('/');
  const demo = page.getByRole('button', { name: /I know the drill/ });
  if (await demo.isVisible().catch(() => false)) await demo.click();
  await page.getByRole('button', { name: 'More' }).click();
  await page.getByRole('button', { name: /New game/ }).click();
  await expect(page.locator('.rb-round')).toHaveText('R1');

  const scene = page.locator('.victory');
  // Wait until either the named step button or the victory scene appears; click the button if
  // that's what came. Returns true when the game has ended (caller breaks out).
  const stepOrScene = async (name: RegExp): Promise<boolean> => {
    const btn = page.getByRole('button', { name }).first();
    await expect(btn.or(scene).first()).toBeVisible({ timeout: 15_000 });
    if (await scene.isVisible()) return true;
    await btn.click();
    return false;
  };

  // Round 1 begins from 'start'; later rounds land directly in Vehicles. Supremacy climbs at
  // least 1/round, so a decision arrives by round 10.
  let ended = await stepOrScene(/Begin round 1$/);
  for (let round = 1; round <= 12 && !ended; round++) {
    if (await stepOrScene(/Vehicles placed/)) break;

    let battleBroke = false;
    for (const face of ['Deployment', 'House', 'Mentat', 'Strategy', 'Leadership']) {
      await page.locator('.g-dice').getByRole('button', { name: face }).click();
      const card = page.locator('.directive-card');
      await expect(card).toBeVisible();
      const confirm = card.getByRole('button', { name: /Confirm/ });
      const battle = card.getByRole('button', { name: /To battle/ });
      if (await confirm.isVisible().catch(() => false)) await confirm.click();
      else if (await battle.isVisible().catch(() => false)) {
        await battle.click();
        await runBattle(page);
        if (await scene.isVisible().catch(() => false)) { battleBroke = true; break; }
      } else await card.getByRole('button', { name: 'Dismiss' }).click();
      await expect(card).toBeHidden();
    }
    if (battleBroke) break;

    if (await stepOrScene(/Actions done/)) break;

    const worms = page.getByRole('button', { name: /Apply wormsigns|Continue to storms/ });
    if (await worms.isVisible().catch(() => false)) await worms.click();
    const storms = page.getByRole('button', { name: 'Apply storms' });
    if (await storms.isVisible().catch(() => false)) await storms.click();
    if (await stepOrScene(/Hazards done/)) break;

    // The harvest itself can push supremacy to 10 (surplus) — both steps are scene-aware.
    if (await stepOrScene(/Apply harvest/)) break;
    if (await stepOrScene(/Harvest applied/)) break;
    if (await stepOrScene(new RegExp(`Start round ${round + 1}`))) break;
  }

  await expect(scene).toBeVisible({ timeout: 15_000 });
  await expect(scene).toContainText(/Baron|Sleeper/);
});
