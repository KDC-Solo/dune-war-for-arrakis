// Mobile (phone-portrait, touch) journeys — runs under the `mobile` Playwright project
// (390×844, isMobile, hasTouch). The PWA's real table form factor: everything must work by
// tap and never scroll sideways.

import { test, expect, type Page } from '@playwright/test';
import { newGameState } from '../src/engine/newGame';
import type { GameState } from '../src/engine/state';
import { STORAGE_KEY } from '../src/ui/persistence';

async function seed(page: Page, state: GameState) {
  await page.addInitScript(
    ([key, json]) => {
      localStorage.setItem(key, json);
      localStorage.setItem('dwfa.v2.welcomed', 'yes');
    },
    [STORAGE_KEY, JSON.stringify(state)] as const,
  );
}

/** The page must never scroll horizontally on a phone. */
async function expectNoSidewaysScroll(page: Page, where: string) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, `horizontal overflow at ${where}`).toBeLessThanOrEqual(1);
}

test('mobile: a full round plays through the guide bar without sideways scroll', async ({ page }) => {
  page.on('dialog', (d) => d.accept());
  await page.goto('/');
  const demo = page.getByRole('button', { name: /I know the drill/ });
  if (await demo.isVisible().catch(() => false)) await demo.click();
  await page.getByRole('button', { name: 'More' }).click();
  await page.getByRole('button', { name: /New game/ }).click();
  await expect(page.locator('.rb-round')).toHaveText('R1');
  await expectNoSidewaysScroll(page, 'fresh game');

  await page.getByRole('button', { name: /Begin round 1/ }).click();
  await page.getByRole('button', { name: /Vehicles placed/ }).click();

  for (const face of ['Deployment', 'Mentat', 'House']) {
    const dieBtn = page.locator('.g-dice').getByRole('button', { name: face });
    if (!(await dieBtn.isEnabled().catch(() => false))) break;
    await dieBtn.click();
    const card = page.locator('.directive-card');
    await expect(card).toBeVisible();
    await expectNoSidewaysScroll(page, `directive (${face})`);
    const confirm = card.getByRole('button', { name: /Confirm/ });
    if (await confirm.isVisible().catch(() => false)) await confirm.click();
    else await card.getByRole('button', { name: 'Dismiss' }).click();
  }
  await page.getByRole('button', { name: /Actions done/ }).click();

  const worms = page.getByRole('button', { name: /Apply wormsigns|Continue to storms/ });
  if (await worms.isVisible().catch(() => false)) await worms.click();
  const storms = page.getByRole('button', { name: 'Apply storms' });
  if (await storms.isVisible().catch(() => false)) await storms.click();
  await expectNoSidewaysScroll(page, 'hazards');
  await page.getByRole('button', { name: /Hazards done/ }).click();
  await page.getByRole('button', { name: /Apply harvest/ }).click();
  await page.getByRole('button', { name: /Harvest applied/ }).click();
  await page.getByRole('button', { name: /Start round 2/ }).click();
  await expect(page.locator('.rb-round')).toHaveText('R2');
  await expectNoSidewaysScroll(page, 'round 2');
});

test('mobile: area sheet and battle screen work by tap and fit the phone', async ({ page }) => {
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
  s.sietches = s.sietches.map((si) => (si.area === 'gara_kulon' ? { ...si, revealed: true, rank: 1 as const } : si));
  await seed(page, s);
  await page.goto('/');

  await page.locator('path[data-area="gara_kulon"]').dispatchEvent('click');
  await expect(page.locator('.area-sheet')).toBeVisible();
  await expectNoSidewaysScroll(page, 'area sheet');
  // edit panel (steppers + leader chips) must fit too
  await page.locator('.area-sheet .as-legion.atreides').getByRole('button', { name: 'Edit' }).click();
  await expectNoSidewaysScroll(page, 'area edit panel');

  await page.getByRole('button', { name: /Battle — Harkonnen attack from/ }).click();
  const bs = page.locator('.battle-screen');
  await expect(bs).toBeVisible();
  const reveal = bs.getByRole('button', { name: /Reveal & begin/ });
  const begin = bs.getByRole('button', { name: /Begin battle/ });
  if (await reveal.isVisible().catch(() => false)) await reveal.click();
  else await begin.click();
  await expectNoSidewaysScroll(page, 'battle screen');
  await bs.locator('.bs-rollrow.harkonnen').getByRole('button', { name: 'Swords +1' }).click();
  await bs.getByRole('button', { name: 'Apply round' }).click();
  const done = bs.getByRole('button', { name: 'Apply to the game' });
  const apply = bs.getByRole('button', { name: 'Apply round' });
  await expect(done.or(apply).first()).toBeVisible();
  await bs.locator('.bs-close').click();
  await expect(bs).toBeHidden();
});

test('mobile: all four dock sheets open and fit', async ({ page }) => {
  const s = newGameState();
  s.phase = 'action_resolution';
  await seed(page, s);
  await page.goto('/');
  for (const dock of ['Harkonnen', 'Atreides', 'Log', 'More']) {
    await page.getByRole('button', { name: dock, exact: true }).click();
    await expect(page.locator('.sheet')).toBeVisible();
    await expectNoSidewaysScroll(page, `${dock} sheet`);
    await page.locator('.sheet-veil').click({ position: { x: 10, y: 10 } });
    await expect(page.locator('.sheet')).toBeHidden();
  }
});
