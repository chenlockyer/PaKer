/**
 * Dump the blueprint library of the real client (read only).
 */
import { writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const require = createRequire(import.meta.url);
const { _electron: electron } = await import('playwright');

const env = { ...process.env, ELECTRON_RENDERER_URL: process.env.PAKER_URL ?? 'http://127.0.0.1:5173/' };
delete env.ELECTRON_RUN_AS_NODE;

const app = await electron.launch({
  executablePath: require('electron'),
  args: ['electron/main.cjs'],
  cwd: ROOT,
  env,
});
try {
  const page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  const data = await page.evaluate(() => {
    const raw = localStorage.getItem('hoc_blueprints_v1');
    const list = raw ? JSON.parse(raw) : [];
    return list.map(bp => ({
      id: bp.id,
      name: bp.name,
      cardSize: bp.cardSize,
      cardCount: bp.cardCount ?? bp.snapshot?.cards?.length,
      tags: bp.tags,
      status: bp.status,
      steps: bp.steps?.length,
      bounds: bp.snapshot?.bounds,
      cards: bp.snapshot?.cards,
    }));
  });
  await writeFile(join(ROOT, 'scripts', 'palace', 'blueprints.dump.json'), `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  console.log(`blueprints: ${data.length}`);
  for (const bp of data) {
    const size = bp.bounds?.size;
    console.log(`- ${bp.name}  ${bp.cardCount} 张  ${size ? size.map(v => v.toFixed(2)).join(' × ') : '?'}  ${bp.cardSize}  ${bp.status}`);
  }
} finally {
  await app.close();
}
