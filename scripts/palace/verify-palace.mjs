/**
 * Physics verification for the palace save.
 *
 *   npm run dev:web                                  # in one terminal
 *   node scripts/palace/verify-palace.mjs            # headless Chromium
 *
 * The script seeds `saves/paper-palace.paker-save.json` into a throw-away
 * browser profile, loads it through the real UI, lets Rapier simulate it for a
 * few seconds and then asks the app to save the *live* transforms. Comparing the
 * two card sets tells us whether the palace stands: a stable structure keeps
 * every card within a couple of millimetres and a fraction of a degree.
 *
 * Exit code 0 means the palace stands, 1 means something fell over.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SAVE_PATH = join(ROOT, 'saves', 'paper-palace.paker-save.json');
const REPORT_PATH = join(ROOT, 'saves', 'paper-palace.verification.json');
const APP = process.env.PAKER_URL ?? 'http://127.0.0.1:5173/';
const LIBRARY_KEY = 'paker_build_save_library_v2';
const PROBE_NAME = '物理校验';
const SETTLE_MS = Number(process.env.PALACE_SETTLE_MS ?? 7000);

/* Tolerance for "did not move". The palace's tower floors press together under
 * load, so a few centimetres of settling are expected; a card that fell over
 * changes its up vector by tens of degrees. */
const MAX_DROP = 0.15;
const MAX_SHIFT = 0.16;
const MAX_TILT_DEGREES = 8;

const log = (...args) => console.log('[palace]', ...args);

const eulerToUp = ([x, y, z]) => {
  // Exactly the rotation the renderer applies to `card.rotation`.
  const vector = new THREE.Vector3(0, 1, 0).applyEuler(new THREE.Euler(x, y, z, 'XYZ'));
  return [vector.x, vector.y, vector.z];
};

const angleBetween = (a, b) => {
  const dot = Math.min(1, Math.max(-1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]));
  return (Math.acos(dot) * 180) / Math.PI;
};

const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

const compare = (before, after) => {
  const afterById = new Map(after.map(card => [card.id, card]));
  const rows = [];
  for (const card of before) {
    const live = afterById.get(card.id);
    if (!live) continue;
    rows.push({
      id: card.id,
      shift: distance(card.position, live.position),
      drop: card.position[1] - live.position[1],
      tilt: angleBetween(eulerToUp(card.rotation), eulerToUp(live.rotation)),
    });
  }
  rows.sort((left, right) => right.tilt - left.tilt || right.shift - left.shift);
  return {
    cards: rows.length,
    worst: rows.slice(0, 6),
    maxShift: Math.max(...rows.map(row => row.shift)),
    maxDrop: Math.max(...rows.map(row => row.drop)),
    maxTilt: Math.max(...rows.map(row => row.tilt)),
  };
};

/**
 * Pull the orbit camera back until the whole 17 m deep palace fits, then lift
 * the view a little. The app has no "fit view" button, so we drive the wheel and
 * the right-button orbit the same way a player would.
 */
const framePalace = async page => {
  const hint = page.getByRole('button', { name: /知道了/ });
  if (await hint.count()) await hint.first().click().catch(() => undefined);
  const box = await page.locator('canvas').first().boundingBox();
  const centreX = box.x + box.width / 2;
  const centreY = box.y + box.height / 2;
  await page.mouse.move(centreX, centreY);
  for (let step = 0; step < 24; step += 1) {
    await page.mouse.wheel(0, 120);
    await page.waitForTimeout(55);
  }
  // Three-quarter view: swing around and lift the camera a little.
  await page.mouse.down({ button: 'right' });
  await page.mouse.move(centreX + box.width * 0.18, centreY + box.height * 0.05, { steps: 14 });
  await page.mouse.up({ button: 'right' });
  await page.waitForTimeout(600);
};

const main = async () => {
  let chromium;
  try {
    ({ chromium } = await import('playwright'));
  } catch {
    console.error('[palace] playwright is not installed: npm i -D playwright && npx playwright install chromium');
    process.exitCode = 1;
    return;
  }

  const save = JSON.parse(await readFile(SAVE_PATH, 'utf8'));
  log(`loaded ${SAVE_PATH}: 「${save.name}」${save.cards.length} 张牌`);

  const browser = await chromium.launch({
    headless: true,
    args: [
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding',
    ],
  });

  const errors = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
    page.setDefaultTimeout(20000);
    page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
    page.on('console', message => {
      if (message.type() === 'error') errors.push(`console: ${message.text()}`);
    });

    await page.goto(APP, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /自由搭建/ }).waitFor({ state: 'visible', timeout: 60000 });

    // Seed the throw-away profile with exactly this save.
    await page.evaluate(([key, value]) => {
      localStorage.setItem(key, JSON.stringify([value]));
      localStorage.removeItem(`${key}_backup`);
    }, [LIBRARY_KEY, save]);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /自由搭建/ }).click();
    await page.waitForTimeout(1500);
    log('entered free build');

    await page.getByRole('button', { name: '读档', exact: true }).click();
    await page.waitForTimeout(500);
    const row = page.locator('.save-library-item').filter({ hasText: save.name }).first();
    await row.waitFor({ state: 'visible' });
    log('save is listed:', (await row.innerText()).replace(/\s+/g, ' ').trim());
    await row.getByRole('button', { name: '读取', exact: true }).click();
    await page.waitForTimeout(SETTLE_MS);
    log(`simulated ${SETTLE_MS} ms, capturing the live structure`);

    await page.mouse.move(30, 300);
    await page.waitForTimeout(300);
    await framePalace(page);
    await page.screenshot({ path: join(ROOT, 'docs', 'screenshots', 'palace-loaded.png') });

    // Ask the app to save the live transforms, which is the measurement.
    await page.getByRole('button', { name: '存档', exact: true }).click();
    await page.waitForTimeout(400);
    await page.locator('#new-save-name').fill(PROBE_NAME);
    await page.locator('.save-create-row button').click();
    await page.waitForTimeout(800);

    const library = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), LIBRARY_KEY);
    const probe = library.find(item => item.name === PROBE_NAME);
    if (!probe) {
      console.error('[palace] the app did not write the measurement save');
      process.exitCode = 1;
      return;
    }

    const result = compare(save.cards, probe.cards);
    const passed = result.maxTilt <= MAX_TILT_DEGREES
      && result.maxDrop <= MAX_DROP
      && result.maxShift <= MAX_SHIFT;

    const report = {
      verifiedAt: new Date().toISOString(),
      saveId: save.id,
      cards: result.cards,
      settleMs: SETTLE_MS,
      thresholds: { maxTiltDegrees: MAX_TILT_DEGREES, maxDropMetres: MAX_DROP, maxShiftMetres: MAX_SHIFT },
      measured: {
        maxTiltDegrees: Number(result.maxTilt.toFixed(3)),
        maxDropMetres: Number(result.maxDrop.toFixed(4)),
        maxShiftMetres: Number(result.maxShift.toFixed(4)),
      },
      worst: result.worst.map(row => ({
        id: row.id,
        tilt: Number(row.tilt.toFixed(2)),
        drop: Number(row.drop.toFixed(4)),
        shift: Number(row.shift.toFixed(4)),
      })),
      passed,
    };
    await writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

    log(`max tilt ${report.measured.maxTiltDegrees}°, max drop ${report.measured.maxDropMetres} m, max shift ${report.measured.maxShiftMetres} m`);
    for (const row of report.worst) log(`  ${row.id}: tilt ${row.tilt}°, drop ${row.drop} m, shift ${row.shift} m`);
    log(`report → ${REPORT_PATH}`);
    log(passed ? 'PASS: the palace stands' : 'FAIL: something moved beyond tolerance');
    if (errors.length) log('console errors:', errors.slice(0, 5));
    if (!passed) process.exitCode = 1;
  } finally {
    await browser.close();
  }
};

main().catch(error => {
  console.error('[palace] verification failed:', error);
  process.exitCode = 1;
});
