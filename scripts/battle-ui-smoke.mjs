/**
 * Optional headless UI check for Card Siege.
 *
 *   npm run dev:web            # in one terminal
 *   npm i -D playwright && npx playwright install chromium
 *   npm run test:battle:ui
 *
 * It drives the real app: menu → setup → build both sides → settle → turn
 * phases, and writes screenshots to docs/screenshots.
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
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
  page.on('console', message => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });

  await page.goto(APP, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);

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
  const coreButton = async () => (await page.locator('.battle-role-row button').first().innerText()).trim();
  const coreStatus = async index =>
    (await page.locator('.battle-core').nth(index).innerText()).replace(/\s+/g, ' ').trim();

  const canvas = page.locator('canvas').first();
  const box = await canvas.boundingBox();
  const moveTo = async (fx, fy) => {
    await page.mouse.move(box.x + box.width * fx, box.y + box.height * fy);
    await page.waitForTimeout(260);
  };
  const clickAt = async (fx, fy) => {
    await moveTo(fx, fy);
    await page.mouse.click(box.x + box.width * fx, box.y + box.height * fy);
    await page.waitForTimeout(380);
  };
  const parkMouse = async () => {
    await page.mouse.move(box.x + 10, box.y + 10);
    await page.waitForTimeout(300);
  };

  const placeCard = async ({ presetIndex, roleIndex, spots }) => {
    if (presetIndex !== null) {
      await page.locator('.battle-preset').nth(presetIndex).click();
      await page.waitForTimeout(150);
    }
    if (roleIndex !== null) {
      await page.locator('.battle-role-row button').nth(roleIndex).click();
      await page.waitForTimeout(150);
    }
    for (const [fx, fy] of spots) {
      await moveTo(fx, fy);
      if ((await verdictText()) !== 'none') continue;
      const before = [await budgetText(0), await budgetText(2)];
      await page.mouse.click(box.x + box.width * fx, box.y + box.height * fy);
      await page.waitForTimeout(380);
      const after = [await budgetText(0), await budgetText(2)];
      if (before[0] !== after[0] || before[1] !== after[1]) return [fx, fy];
    }
    return null;
  };

  const placeCore = async () => {
    await page.locator('.battle-role-row button').first().click();
    await page.waitForTimeout(200);
    for (const fy of [0.32, 0.38, 0.44, 0.5, 0.56, 0.62, 0.7, 0.78, 0.86]) {
      for (const fx of [0.5, 0.44, 0.56, 0.38, 0.62]) {
        await moveTo(fx, fy);
        if ((await verdictText()) !== 'none') continue;
        await page.mouse.click(box.x + box.width * fx, box.y + box.height * fy);
        await page.waitForTimeout(400);
        if ((await coreButton()).includes('核心已放置')) return [fx, fy];
      }
    }
    return null;
  };

  log('phase after start:', await phaseName(), '| clock', await clock());

  // Freeze physics so a legal core can be placed and holds until settle.
  await page.getByRole('button', { name: '物理生效' }).click();
  await page.waitForTimeout(300);

  await clickAt(0.5, 0.5);
  log('verdict inside the buffer:', await verdictText());

  await page.getByRole('button', { name: '己方' }).click();
  await page.waitForTimeout(800);
  log('blue standing card at', await placeCard({ presetIndex: 3, roleIndex: 1, spots: [[0.5, 0.62], [0.46, 0.66]] }));
  log('blue ammo card at', await placeCard({ presetIndex: null, roleIndex: 2, spots: [[0.6, 0.66], [0.64, 0.62]] }),
    '| ammo budget', await budgetText(2));
  log('blue core at', await placeCore(), '|', await coreStatus(0));
  await parkMouse();
  await page.screenshot({ path: path.join(SHOTS, 'battle-build.png') });

  await page.getByRole('button', { name: '物理暂停' }).click();
  await page.waitForTimeout(1600);
  log('after unfreeze:', await coreStatus(0));

  await page.getByRole('button', { name: '完成建造' }).click();
  await page.waitForTimeout(700);
  log('phase after finishing blue:', await phaseName());
  await page.getByRole('button', { name: '完成建造' }).click();
  await page.waitForTimeout(700);
  log('phase entering settle:', await phaseName(), '| clock', await clock());
  await page.waitForTimeout(6000);
  log('phase after settle:', await phaseName(), '| clock', await clock());
  await parkMouse();
  await page.screenshot({ path: path.join(SHOTS, 'battle-turn.png') });

  log('errors:', errors.length ? errors : 'none');
  await browser.close();
  if (errors.length) process.exitCode = 1;
};

main().catch(error => {
  console.error('[battle-ui] failed:', error);
  console.error('[battle-ui] install playwright with: npm i -D playwright && npx playwright install chromium');
  process.exitCode = 1;
});
