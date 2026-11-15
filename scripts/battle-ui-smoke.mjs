/**
 * Optional headless UI check for Card Siege.
 *
 *   npm run dev:web            # in one terminal
 *   npm i -D playwright && npx playwright install chromium
 *   npm run test:battle:ui
 *
 * It drives the real app: menu → setup → blueprint quick-place inside the own
 * zone → both build phases → settle check → first turn, and writes screenshots
 * to docs/screenshots.
 */

import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHOTS = path.join(ROOT, 'docs', 'screenshots');
const APP = process.env.PAKER_URL ?? 'http://127.0.0.1:5173/';

const log = (...args) => console.log('[battle-ui]', ...args);

const main = async () => {
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding',
      '--disable-backgrounding-occluded-windows',
    ],
  });
  try {
    await drive(browser);
  } finally {
    await browser.close();
  }
};

const drive = async (browser) => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.setDefaultTimeout(10000);
  const errors = [];
  page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
  page.on('console', message => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });

  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  // The 3D shell loads lazily; wait for the menu button instead of network idle.
  await page.getByRole('button', { name: /纸牌攻城/ }).waitFor({ state: 'visible', timeout: 45000 });
  await page.waitForTimeout(800);

  await page.getByRole('button', { name: /纸牌攻城/ }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(SHOTS, 'battle-setup.png') });
  await page.locator('.battle-setup-grid input').first().fill('3');
  await page.getByRole('button', { name: '开始对战' }).click();
  await page.waitForTimeout(2000);

  const phaseName = async () => (await page.locator('.battle-phase-name').innerText()).replace(/\s+/g, ' ').trim();
  const clock = async () => (await page.locator('.battle-clock strong').innerText()).trim();
  const verdictText = async () => {
    if (!(await page.locator('.battle-verdict').count())) return 'none';
    return (await page.locator('.battle-verdict').first().innerText()).replace(/\s+/g, ' ').trim();
  };
  const budgetText = async index =>
    (await page.locator('.battle-budget div').nth(index).innerText()).replace(/\s+/g, ' ').trim();
  const collapseText = async index =>
    (await page.locator('.battle-core').nth(index).innerText()).replace(/\s+/g, ' ').trim();

  const canvas = page.locator('canvas').first();
  const box = await canvas.boundingBox();
  const clickAt = async (fx, fy) => {
    await page.mouse.move(box.x + box.width * fx, box.y + box.height * fy);
    await page.waitForTimeout(260);
    await page.mouse.click(box.x + box.width * fx, box.y + box.height * fy);
    await page.waitForTimeout(500);
  };
  const parkMouse = async () => {
    await page.mouse.move(box.x + 10, box.y + 10);
    await page.waitForTimeout(300);
  };

  /** Open the studio, switch to the library, quick place a blueprint, click in the zone. */
  const quickPlaceBlueprint = async (cardIndex, spots) => {
    await page.getByRole('button', { name: '蓝图' }).click();
    await page.waitForTimeout(600);
    await page.locator('.blueprint-tabs button').nth(1).click();
    await page.waitForTimeout(400);
    const cards = page.locator('.blueprint-library article');
    log('blueprints in the studio:', await cards.count());
    await cards.nth(cardIndex).getByRole('button', { name: '一键放置' }).click();
    await page.waitForTimeout(700);
    for (const [fx, fy] of spots) {
      await clickAt(fx, fy);
      if ((await verdictText()) === 'none') return [fx, fy];
    }
    return null;
  };

  log('phase after start:', await phaseName(), '| clock', await clock());

  // 1. The neutral band refuses placements and says why.
  await clickAt(0.5, 0.5);
  log('verdict inside the neutral band:', await verdictText());

  // 2. Frame the own zone, then drop a saved blueprint inside it.
  await page.getByRole('button', { name: '己方' }).click();
  await page.waitForTimeout(900);
  const before = await budgetText(0);
  const spot = await quickPlaceBlueprint(1, [[0.5, 0.78], [0.46, 0.82], [0.54, 0.74], [0.5, 0.7]]);
  log('blueprint placed at', spot, '| structure budget', before, '→', await budgetText(0));
  await page.waitForTimeout(1200);
  log('blue collapse:', await collapseText(0));
  await parkMouse();
  await page.screenshot({ path: path.join(SHOTS, 'battle-build.png') });

  // 3. Hand the build to red and place the same blueprint there.
  await page.getByRole('button', { name: '完成建造' }).click();
  await page.waitForTimeout(800);
  log('phase after finishing blue:', await phaseName());
  await page.getByRole('button', { name: '己方' }).click();
  await page.waitForTimeout(900);
  const redSpot = await quickPlaceBlueprint(1, [[0.5, 0.78], [0.46, 0.82], [0.54, 0.74], [0.5, 0.7]]);
  log('red blueprint placed at', redSpot, '| structure budget', await budgetText(0));
  await page.waitForTimeout(1000);
  log('red collapse:', await collapseText(1));

  // 4. Finish building and run the settle check.
  await page.getByRole('button', { name: '完成建造' }).click();
  await page.waitForTimeout(800);
  log('phase entering settle:', await phaseName(), '| clock', await clock());
  await page.waitForTimeout(2500);
  log('settle running:', await phaseName(), '| clock', await clock());
  await page.waitForTimeout(3500);
  log('after settle:', await phaseName(), '| clock', await clock());
  await page.waitForTimeout(1000);
  log('blue collapse:', await collapseText(0), '|| red:', await collapseText(1));
  await parkMouse();
  await page.screenshot({ path: path.join(SHOTS, 'battle-turn.png') });

  // 5. Resign to capture the result panel.
  page.on('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: '认输' }).click();
  await page.waitForTimeout(900);
  log('result:', (await page.locator('.result-card h2').innerText()).replace(/\s+/g, ' ').trim());
  await page.screenshot({ path: path.join(SHOTS, 'battle-result.png') });

  log('errors:', errors.length ? errors : 'none');
  if (errors.length) process.exitCode = 1;
};

main().catch(error => {
  console.error('[battle-ui] failed:', error);
  console.error('[battle-ui] install playwright with: npm i -D playwright && npx playwright install chromium');
  process.exitCode = 1;
});
