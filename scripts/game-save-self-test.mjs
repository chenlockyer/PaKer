import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const temporaryDirectory = await mkdtemp(join(tmpdir(), 'paker-save-test-'));
const bundlePath = join(temporaryDirectory, 'game-save-service.mjs');

const makeStorage = () => {
  const values = new Map();
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    raw: values,
  };
};

try {
  await build({
    entryPoints: ['services/gameSaveService.ts'],
    outfile: bundlePath,
    bundle: true,
    platform: 'node',
    format: 'esm',
    logLevel: 'silent',
  });

  const service = await import(`${pathToFileURL(bundlePath).href}?v=${Date.now()}`);
  const placedCard = {
    id: 'card-1',
    position: [9, 9, 9],
    rotation: [0, 0, 0],
    suit: 'spades',
    rank: 'A',
    color: 'black',
    locked: false,
  };
  const liveTransforms = new Map([
    ['card-1', {
      position: [1.25, 0.4, -2],
      rotation: [0.2, 0.3, 0.4],
    }],
  ]);

  const manual = service.createGameSave({
    slot: 'manual',
    cards: [placedCard],
    liveTransforms,
    cardSize: 'BRIDGE',
    currentPresetId: 'flat_portrait',
    isFreezeMode: false,
    savedAt: '2026-01-01T00:00:00.000Z',
  });

  assert.deepEqual(
    manual.cards[0].position,
    [1.25, 0.4, -2],
    'save must capture the current physics position',
  );
  assert.deepEqual(
    manual.cards[0].rotation,
    [0.2, 0.3, 0.4],
    'save must capture the current physics rotation',
  );

  const storage = makeStorage();
  service.persistGameSave(storage, manual);
  assert.equal(service.loadLatestGameSave(storage).save.cards.length, 1);

  const autosave = service.createGameSave({
    slot: 'autosave',
    cards: [placedCard],
    liveTransforms,
    cardSize: 'POKER',
    currentPresetId: 'flat_landscape',
    isFreezeMode: true,
    savedAt: '2026-01-02T00:00:00.000Z',
  });
  service.persistGameSave(storage, autosave);
  assert.equal(service.loadLatestGameSave(storage).save.slot, 'autosave');

  const newerManual = {
    ...manual,
    savedAt: '2026-01-03T00:00:00.000Z',
  };
  service.persistGameSave(storage, newerManual);
  storage.setItem('paker_build_save_manual_v1', '{broken');
  const recovered = service.loadGameSaveSlot(storage, 'manual');
  assert.equal(recovered.recoveredFromBackup, true);
  assert.equal(recovered.save.savedAt, manual.savedAt);

  assert.equal(service.validateGameSave({
    ...manual,
    cards: [{ ...placedCard, position: [Number.NaN, 0, 0] }],
  }), null);
  assert.equal(service.validateGameSave({
    ...manual,
    cards: [placedCard, placedCard],
  }), null);

  console.log('Game save self-test passed: live transforms, latest slot, backup recovery, and validation.');
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}
