/**
 * Put the palace save into the real PaKer app's save library.
 *
 *   npm run dev:web                        # the app needs its renderer
 *   node scripts/palace/seed-save.mjs      # writes into the desktop app profile
 *
 * The desktop client stores its save library in the Electron profile's
 * localStorage (`%APPDATA%\Electron` for `electron electron/main.cjs`). This
 * script starts exactly that app, writes the save into that storage with the
 * app's own schema, reloads, and proves the palace shows up and loads by driving
 * the real 读档 UI.
 *
 * Existing saves are preserved: the new entry replaces only the same id, and the
 * previous library is copied to the app's backup key first, the same way the
 * game's own save code does.
 */

import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const require = createRequire(import.meta.url);
/** `require('electron')` from Node resolves to the app's own Electron binary. */
const electronPath = require('electron');
const SAVE_PATH = join(ROOT, 'saves', 'paper-palace.paker-save.json');
const LIBRARY_KEY = 'paker_build_save_library_v2';
const APP = process.env.PAKER_URL ?? 'http://127.0.0.1:5173/';
const SCREENSHOT = join(ROOT, 'docs', 'screenshots', 'palace-in-app.png');

const log = (...args) => console.log('[palace]', ...args);

const main = async () => {
  let electron;
  try {
    ({ _electron: electron } = await import('playwright'));
  } catch {
    console.error('[palace] playwright is not installed: npm i -D playwright && npx playwright install chromium');
    process.exitCode = 1;
    return;
  }

  const save = JSON.parse(await readFile(SAVE_PATH, 'utf8'));
  log(`seeding 「${save.name}」${save.cards.length} 张牌`);

  // DSH itself is an Electron app and exports ELECTRON_RUN_AS_NODE=1 to its
  // children, which would turn this launch into a plain Node process.
  const env = { ...process.env, ELECTRON_RENDERER_URL: APP };
  delete env.ELECTRON_RUN_AS_NODE;

  const app = await electron.launch({
    executablePath: electronPath,
    args: ['electron/main.cjs'],
    cwd: ROOT,
    env,
  });

  try {
    const page = await app.firstWindow();
    page.setDefaultTimeout(30000);
    await page.waitForLoadState('domcontentloaded');

    const before = await page.evaluate(key => {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw).map(item => `${item.name} (${item.cards.length})`) : [];
    }, LIBRARY_KEY);
    log(`existing saves: ${before.length ? before.join(', ') : '(none)'}`);

    const after = await page.evaluate(([key, value]) => {
      const raw = localStorage.getItem(key);
      const list = raw ? JSON.parse(raw) : [];
      const next = [value, ...list.filter(item => item.id !== value.id)];
      if (raw) localStorage.setItem(`${key}_backup`, raw);
      localStorage.setItem(key, JSON.stringify(next));
      return next.map(item => `${item.name} (${item.cards.length})`);
    }, [LIBRARY_KEY, save]);
    log(`library now: ${after.join(', ')}`);

    // Prove it through the real UI: reload, enter free build, open 读档, load.
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /自由搭建/ }).waitFor({ state: 'visible' });
    await page.getByRole('button', { name: /自由搭建/ }).click();
    await page.waitForTimeout(1500);
    await page.getByRole('button', { name: '读档', exact: true }).click();
    await page.waitForTimeout(500);

    const row = page.locator('.save-library-item').filter({ hasText: save.name }).first();
    await row.waitFor({ state: 'visible' });
    log('读档 lists:', (await row.innerText()).replace(/\s+/g, ' ').trim());
    await row.getByRole('button', { name: '读取', exact: true }).click();
    await page.waitForTimeout(6000);
    log('palace loaded and simulated');

    await page.mouse.move(20, 400);
    const hint = page.getByRole('button', { name: /知道了/ });
    if (await hint.count()) await hint.first().click().catch(() => undefined);
    await page.waitForTimeout(300);

    const canvas = await page.locator('canvas').first().boundingBox();
    const centreX = canvas.x + canvas.width / 2;
    const centreY = canvas.y + canvas.height / 2;
    await page.mouse.move(centreX, centreY);
    for (let step = 0; step < 24; step += 1) {
      await page.mouse.wheel(0, 120);
      await page.waitForTimeout(55);
    }
    await page.mouse.down({ button: 'right' });
    await page.mouse.move(centreX + canvas.width * 0.18, centreY + canvas.height * 0.05, { steps: 16 });
    await page.mouse.up({ button: 'right' });
    await page.waitForTimeout(700);
    await page.screenshot({ path: SCREENSHOT });
    log(`screenshot → ${SCREENSHOT}`);

    const cardCount = await page.evaluate(() => {
      const text = document.body.innerText;
      const match = text.match(/牌数\s*(\d+)/);
      return match ? Number(match[1]) : null;
    });
    log(`app reports ${cardCount} cards on the table`);
    if (cardCount !== save.cards.length) {
      console.error(`[palace] expected ${save.cards.length} cards, the app shows ${cardCount}`);
      process.exitCode = 1;
    }
  } finally {
    await app.close();
  }
};

main().catch(error => {
  console.error('[palace] seeding failed:', error);
  process.exitCode = 1;
});
