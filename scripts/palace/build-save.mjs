/**
 * Turn the palace geometry into a PaKer build save (schema v2) and optionally
 * print it for inspection.
 *
 *   node scripts/palace/build-save.mjs                  # write saves/paper-palace.paker-save.json
 *   node scripts/palace/build-save.mjs --stdout         # print the JSON instead
 *   node scripts/palace/build-save.mjs --check <file>   # validate an existing save
 *
 * The save is validated with the app's own `validateGameSave`, so anything this
 * script writes is guaranteed to load in the game.
 */

import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import * as THREE from 'three';
import { buildPalaceCards } from './palace-structure.mjs';

const ROOT = resolve(dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..', '..');
const OUTPUT = join(ROOT, 'saves', 'paper-palace.paker-save.json');
const SAVE_ID = 'paker-palace-paper-001';
const SAVE_NAME = '纸牌宫殿';

const argumentsList = process.argv.slice(2);
const flag = name => argumentsList.includes(`--${name}`);
const valueOf = name => {
  const index = argumentsList.indexOf(`--${name}`);
  return index >= 0 ? argumentsList[index + 1] : undefined;
};

/** Bundle the app's save service so validation matches the game exactly. */
const loadSaveService = async () => {
  const outfile = join(tmpdir(), `paker-palace-save-service-${process.pid}.mjs`);
  await build({
    entryPoints: [join(ROOT, 'services', 'gameSaveService.ts')],
    outfile,
    bundle: true,
    platform: 'node',
    format: 'esm',
    logLevel: 'silent',
  });
  const module = await import(`${pathToFileURL(outfile).href}?v=${Date.now()}`);
  return { module, outfile };
};

/** quaternion (w, x, y, z) → Euler XYZ, exactly like `instantiateBlueprintCards`. */
const rotationFromQuaternion = quaternion => {
  const euler = new THREE.Euler().setFromQuaternion(
    new THREE.Quaternion(quaternion[0], quaternion[1], quaternion[2], quaternion[3]).normalize(),
    'XYZ',
  );
  return [euler.x, euler.y, euler.z];
};

const round = (value, digits = 6) => Number(value.toFixed(digits));

export const createPalaceSave = ({ savedAt = new Date().toISOString() } = {}) => {
  const palace = buildPalaceCards();
  const cards = palace.cards.map(card => ({
    id: card.id,
    position: card.position.map(value => round(value)),
    rotation: rotationFromQuaternion(card.quaternion).map(value => round(value)),
    suit: card.suit,
    rank: card.rank,
    color: card.color,
    locked: false,
  }));
  return {
    palace,
    save: {
      schemaVersion: 2,
      kind: 'paker-build',
      id: SAVE_ID,
      name: SAVE_NAME,
      source: 'manual',
      savedAt,
      cardSize: 'BRIDGE',
      currentPresetId: 'flat_landscape',
      isFreezeMode: false,
      cards,
    },
  };
};

const main = async () => {
  const { module, outfile } = await loadSaveService();
  try {
    if (flag('check')) {
      const file = valueOf('check');
      const raw = await readFile(resolve(file), 'utf8');
      const validated = module.validateGameSave(JSON.parse(raw));
      if (!validated) {
        console.error(`✗ ${file} is not a valid PaKer save`);
        process.exitCode = 1;
        return;
      }
      console.log(`✓ ${file} is a valid PaKer save: 「${validated.name}」${validated.cards.length} 张牌`);
      return;
    }

    const { palace, save } = createPalaceSave({ savedAt: valueOf('saved-at') });
    const validated = module.validateGameSave(save);
    if (!validated) {
      console.error('✗ generated save failed validation');
      process.exitCode = 1;
      return;
    }

    if (flag('stdout')) {
      console.log(JSON.stringify(validated, null, 2));
      return;
    }

    await mkdir(dirname(OUTPUT), { recursive: true });
    await writeFile(OUTPUT, `${JSON.stringify(validated, null, 2)}\n`, 'utf8');

    const { bounds, minGap, overlaps } = palace;
    console.log(`✓ ${OUTPUT}`);
    console.log(`  名称：${validated.name}（${validated.id}）`);
    console.log(`  牌数：${validated.cards.length}`);
    console.log(`  尺寸：${(bounds.max[0] - bounds.min[0]).toFixed(2)} × ${(bounds.max[2] - bounds.min[2]).toFixed(2)} × ${(bounds.max[1] - bounds.min[1]).toFixed(2)} m`);
    console.log(`  最小间隙：${minGap.toFixed(4)} m，穿模：${overlaps.length === 0 ? '无' : overlaps.length}`);
    console.log(`  校验：通过（validateGameSave）`);
  } finally {
    await rm(outfile, { force: true });
  }
};

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
