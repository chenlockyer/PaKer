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
    removeItem: key => values.delete(key),
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
  const makeSave = ({
    id,
    name,
    source = 'manual',
    savedAt,
    cardSize = 'BRIDGE',
  }) => service.createGameSave({
    id,
    name,
    source,
    cards: [placedCard],
    liveTransforms,
    cardSize,
    currentPresetId: 'flat_portrait',
    isFreezeMode: false,
    savedAt,
  });

  const first = makeSave({
    id: 'save-1',
    name: 'A 字架',
    savedAt: '2026-01-01T00:00:00.000Z',
  });
  assert.deepEqual(
    first.cards[0].position,
    [1.25, 0.4, -2],
    'save must capture the current physics position',
  );
  assert.deepEqual(
    first.cards[0].rotation,
    [0.2, 0.3, 0.4],
    'save must capture the current physics rotation',
  );

  const storage = makeStorage();
  service.persistGameSave(storage, first);
  const second = makeSave({
    id: 'save-2',
    name: '双层房屋',
    savedAt: '2026-01-02T00:00:00.000Z',
  });
  service.persistGameSave(storage, second);

  let library = service.loadGameSaveLibrary(storage);
  assert.deepEqual(
    library.manualSaves.map(save => save.id),
    ['save-2', 'save-1'],
    'multiple manual saves must coexist and be sorted newest first',
  );

  const overwrittenFirst = makeSave({
    id: 'save-1',
    name: 'A 字架',
    savedAt: '2026-01-03T00:00:00.000Z',
    cardSize: 'POKER',
  });
  service.persistGameSave(storage, overwrittenFirst);
  library = service.loadGameSaveLibrary(storage);
  assert.equal(library.manualSaves.length, 2, 'overwrite must not create a duplicate slot');
  assert.equal(library.manualSaves[0].id, 'save-1');
  assert.equal(library.manualSaves[0].cardSize, 'POKER');

  library = service.renameManualGameSave(storage, 'save-2', '  防风   小屋  ');
  assert.equal(
    library.manualSaves.find(save => save.id === 'save-2').name,
    '防风 小屋',
  );

  const autosave = makeSave({
    id: 'autosave',
    name: '自动存档',
    source: 'autosave',
    savedAt: '2026-01-04T00:00:00.000Z',
  });
  service.persistGameSave(storage, autosave);
  assert.equal(service.loadLatestGameSave(storage).save.id, 'autosave');

  library = service.deleteManualGameSave(storage, 'save-1');
  assert.deepEqual(library.manualSaves.map(save => save.id), ['save-2']);
  assert.equal(library.autosave.id, 'autosave');

  service.persistGameSave(storage, makeSave({
    id: 'save-3',
    name: '备份测试',
    savedAt: '2026-01-05T00:00:00.000Z',
  }));
  storage.setItem('paker_build_save_library_v2', '{broken');
  library = service.loadGameSaveLibrary(storage);
  assert.equal(library.recoveredManualBackup, true);
  assert.equal(library.manualSaves.some(save => save.id === 'save-2'), true);

  assert.equal(service.validateGameSave({
    ...first,
    cards: [{ ...placedCard, position: [Number.NaN, 0, 0] }],
  }), null);
  assert.equal(service.validateGameSave({
    ...first,
    cards: [placedCard, placedCard],
  }), null);

  console.log('Game save self-test passed: live transforms, multi-save library, overwrite, rename, delete, autosave, backup recovery, and validation.');
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}
