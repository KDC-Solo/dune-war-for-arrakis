// Marathon playtest: full games round 1 → victory, playing every planning card and named-leader
// special along the way. Keeps going until >=5 games AND every dropdown option has been used.
import { chromium } from 'playwright-core';
import fs from 'node:fs';

const BASE = 'http://localhost:4173/';
const KEY = 'dwfa.state.v1';
const OUT = '/tmp/claude-1000/-mnt-work-Projects-OSS-dune-war-for-arrakis/35ade973-fe43-4216-8499-7c9f1e59c39a/scratchpad';
const MIN_GAMES = 5;
const MAX_GAMES = 10;
const ROUND_CAP = 14;

const findings = [];
const note = (sev, title, detail) => { findings.push({ sev, title, detail }); console.log(`[${sev}] ${title} :: ${detail}`); };
const rnd = (n) => Math.floor(Math.random() * n);

const browser = await chromium.launch({ executablePath: '/usr/bin/chromium-browser' });
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
page.on('dialog', (d) => d.accept(d.type() === 'prompt' ? 'Marathon' : undefined));
await page.addInitScript(() => localStorage.setItem('dwfa.v2.welcomed', 'yes'));
page.setDefaultTimeout(12000);

const getState = () => page.evaluate((k) => JSON.parse(localStorage.getItem(k)), KEY);
const clickArea = (id) => page.locator(`path[data-area="${id}"]`).dispatchEvent('click');
const scene = page.locator('.victory');
const sceneUp = () => scene.isVisible().catch(() => false);

async function checkInvariants(where) {
  const st = await getState();
  const seen = new Set();
  for (const l of st.legions) {
    const k = `${l.faction}@${l.area}`;
    if (seen.has(k)) note('BUG', `invariant: duplicate legion ${k}`, where);
    seen.add(k);
    for (const [u, n] of Object.entries(l.units)) if (n < 0) note('BUG', `invariant: negative ${u} in ${k}`, where);
    if (l.deploymentTokens < 0) note('BUG', `invariant: negative tokens in ${k}`, where);
  }
  if (st.tracks.supremacy < 0 || st.tracks.supremacy > 10) note('BUG', `invariant: supremacy ${st.tracks.supremacy}`, where);
  if (st.spice.spiceReserve < 0) note('BUG', `invariant: negative spice reserve`, where);
  return st;
}

async function runBattle() {
  const bs = page.locator('.battle-screen');
  for (let j = 0; j < 14; j++) {
    if (!(await bs.isVisible().catch(() => false))) return;
    const rank = bs.getByRole('button', { name: /^Rank \d$/ });
    if (await rank.first().isVisible().catch(() => false)) { await rank.nth(rnd(3)).click(); continue; }
    // exercise the surprise checkbox (fix #3: must exist in the reveal panel too)
    const box = bs.locator('input[type="checkbox"]');
    if (await box.isVisible().catch(() => false) && Math.random() < 0.5) await box.check().catch(() => {});
    const reveal = bs.getByRole('button', { name: /Reveal & begin/ });
    if (await reveal.isVisible().catch(() => false)) {
      // reveal tokens as random unit mixes (sometimes zero)
      const plus = bs.locator('.bs-panel .mini-stepper button').filter({ hasText: '+' });
      const n = await plus.count();
      for (let i = 0; i < n; i++) if (Math.random() < 0.4) await plus.nth(i).click().catch(() => {});
      await reveal.click(); continue;
    }
    const begin = bs.getByRole('button', { name: /Begin battle/ });
    if (await begin.isVisible().catch(() => false)) { await begin.click(); continue; }
    const done = bs.getByRole('button', { name: 'Apply to the game' });
    if (await done.isVisible().catch(() => false)) { await done.click(); return; }
    const apply = bs.getByRole('button', { name: 'Apply round' });
    if (await apply.isVisible().catch(() => false)) {
      const hk = bs.locator('.bs-rollrow.harkonnen');
      const at = bs.locator('.bs-rollrow.atreides');
      for (let k = 0, n = 3 + rnd(4); k < n; k++) await hk.getByRole('button', { name: 'Swords +1' }).click();
      for (let k = 0, n = rnd(3); k < n; k++) await at.getByRole('button', { name: 'Swords +1' }).click();
      if (Math.random() < 0.3) await hk.getByRole('button', { name: 'Shields +1' }).click().catch(() => {});
      await apply.click(); continue;
    }
    await page.waitForTimeout(250);
  }
  // stuck battle → close
  note('BUG', 'battle did not finish within 14 iterations', 'closed manually');
  await bs.locator('.bs-close').click().catch(() => {});
}

// ---- card & leader coverage -----------------------------------------------------------------
const used = new Set();
let allOptions = null;

async function playCards(maxPlays) {
  await page.getByRole('button', { name: 'Turn' }).click();
  const select = page.locator('.ts-select');
  await select.waitFor();
  if (!allOptions) {
    allOptions = await select.locator('option').evaluateAll((os) => os.map((o) => o.value).filter(Boolean));
    console.log(`>> ${allOptions.length} card/leader options to cover`);
  }
  const remaining = allOptions.filter((v) => !used.has(v));
  for (const value of remaining.slice(0, maxPlays)) {
    await select.selectOption(value);
    const applyBtn = page.getByRole('button', { name: /Apply \d+ auto step/ });
    const manualHint = page.locator('.sheet').getByText('All steps are yours to resolve');
    const steps = page.locator('.ts-steps');
    try {
      await applyBtn.or(manualHint).or(steps).first().waitFor({ timeout: 5000 });
    } catch {
      note('BUG', `option ${value} rendered no resolution`, 'no steps, no apply button, no manual hint');
      used.add(value);
      continue;
    }
    if (await applyBtn.isVisible().catch(() => false)) await applyBtn.click();
    else await select.selectOption('');
    used.add(value);
    if (await sceneUp()) break; // a card effect ended the game
  }
  // close the sheet if still open
  await page.locator('.sheet-veil').click({ position: { x: 10, y: 10 } }).catch(() => {});
}

// ---- one full game ---------------------------------------------------------------------------
async function playGame(gameNo, style) {
  const t0 = Date.now();
  errors.length = 0;
  // fresh game: either from the victory scene or via More
  if (await sceneUp()) await scene.getByRole('button', { name: /Begin a new campaign/ }).click();
  else {
    await page.getByRole('button', { name: 'More' }).click();
    await page.getByRole('button', { name: /New game/ }).click();
  }
  await page.locator('.rb-round').filter({ hasText: 'R1' }).waitFor();

  const faces = ['Deployment', 'House', 'Mentat', 'Strategy', 'Leadership'];
  const step = async (re) => {
    const btn = page.getByRole('button', { name: re }).first();
    await btn.or(scene).first().waitFor({ timeout: 15000 });
    if (await sceneUp()) return true;
    await btn.click();
    return false;
  };

  let ended = await step(/Begin round 1$/);
  for (let round = 1; round <= ROUND_CAP && !ended; round++) {
    if (await step(/Vehicles placed/)) break;

    // objective-style game: enter the Secret Objective one box at a time (fix #2 regression)
    if (style === 'objective' && round === 1) {
      await page.getByRole('button', { name: 'You' }).click();
      const goals = page.locator('.dial-goal input');
      for (let i = 0; i < 3; i++) {
        await goals.nth(i).fill('2');
        await page.waitForTimeout(150);
        if (i < 2 && (await sceneUp())) note('BUG', 'REGRESSION: partial objective declared a victory', `after goal ${i + 1}`);
      }
      await page.locator('.sheet-veil').click({ position: { x: 10, y: 10 } });
    }

    // play unused cards / leader specials during the action phase
    if (!(await sceneUp())) await playCards(3 + rnd(2));
    if (await sceneUp()) break;

    let battleEnded = false;
    for (const face of faces) {
      await page.locator('.g-dice').getByRole('button', { name: face }).click();
      const card = page.locator('.directive-card');
      await card.waitFor();
      const confirm = card.getByRole('button', { name: /Confirm/ });
      const battle = card.getByRole('button', { name: /To battle/ });
      if (await confirm.isVisible().catch(() => false)) await confirm.click();
      else if (await battle.isVisible().catch(() => false)) { await battle.click(); await runBattle(); }
      else await card.getByRole('button', { name: 'Dismiss' }).click();
      if (await sceneUp()) { battleEnded = true; break; }
    }
    if (battleEnded) break;
    await checkInvariants(`game ${gameNo} round ${round} after actions`);

    // objective-style: claim prescience through the You sheet mid-game
    if (style === 'objective' && round >= 2 && !(await sceneUp())) {
      await page.getByRole('button', { name: 'You' }).click();
      const destroy = page.locator('.ys-danger', { hasText: 'Arrakeen' });
      if (await destroy.isVisible().catch(() => false)) await destroy.click();
      await page.waitForTimeout(200);
      if (!(await sceneUp())) await page.locator('.sheet-veil').click({ position: { x: 10, y: 10 } });
    }
    if (await sceneUp()) break;

    if (await step(/Actions done/)) break;
    const worms = page.getByRole('button', { name: /Apply wormsigns|Continue to storms/ });
    if (await worms.isVisible().catch(() => false)) await worms.click();
    const storms = page.getByRole('button', { name: 'Apply storms' });
    if (await storms.isVisible().catch(() => false)) {
      const plus = page.locator('.pp-storm .mini-stepper button').filter({ hasText: '+' });
      const n = await plus.count();
      for (let i = 0; i < n; i++) if (Math.random() < 0.5) await plus.nth(i).click().catch(() => {});
      await storms.click();
    }
    if (await step(/Hazards done/)) break;
    if (await step(/Apply harvest/)) break;
    if (await step(/Harvest applied/)) break;
    if (await step(new RegExp(`Start round ${round + 1}`))) break;
    if (round === ROUND_CAP) note('BUG', `game ${gameNo} hit the ${ROUND_CAP}-round cap without a winner`, `style=${style}`);
  }

  await scene.waitFor({ timeout: 15000 });
  const title = (await scene.locator('h1, h2').first().textContent().catch(() => '')) ?? '';
  const st = await checkInvariants(`game ${gameNo} end`);
  const errs = errors.filter((e) => !/favicon/.test(e));
  if (errs.length) note('BUG', `game ${gameNo}: console/page errors`, errs.slice(0, 4).join(' | '));
  const secs = Math.round((Date.now() - t0) / 1000);
  console.log(`== game ${gameNo} done (${style}): "${title.trim()}" round ${st.round}, ${secs}s, coverage ${used.size}/${allOptions?.length ?? '?'}`);
  return title;
}

// ---- run --------------------------------------------------------------------------------------
await page.goto(BASE);
const styles = ['aggressive', 'objective', 'aggressive', 'objective', 'aggressive'];
let games = 0;
const results = [];
while (games < MAX_GAMES) {
  const style = styles[games % styles.length];
  try {
    const title = await playGame(games + 1, style);
    results.push({ game: games + 1, style, title: title.trim() });
  } catch (e) {
    note('BUG', `game ${games + 1} aborted`, String(e).slice(0, 300));
    await page.screenshot({ path: `${OUT}/marathon-abort-g${games + 1}.png` }).catch(() => {});
    // try to recover: reload → new game
    await page.reload().catch(() => {});
    results.push({ game: games + 1, style, title: 'ABORTED' });
  }
  games++;
  const covered = allOptions ? allOptions.every((v) => used.has(v)) : false;
  if (games >= MIN_GAMES && covered) break;
}

const uncovered = allOptions ? allOptions.filter((v) => !used.has(v)) : ['(never enumerated)'];
console.log('\n================ MARATHON SUMMARY ================');
console.log(`games played: ${games}`);
for (const r of results) console.log(`  g${r.game} [${r.style}] → ${r.title}`);
console.log(`card/leader coverage: ${used.size}/${allOptions?.length ?? '?'}${uncovered.length ? ' — UNCOVERED: ' + uncovered.join(', ') : ''}`);
console.log(`findings: ${findings.length ? '' : 'none'}`);
for (const f of findings) console.log(`  - [${f.sev}] ${f.title} :: ${f.detail}`);
fs.writeFileSync(`${OUT}/marathon-results.json`, JSON.stringify({ results, used: [...used], uncovered, findings }, null, 2));
await browser.close();
