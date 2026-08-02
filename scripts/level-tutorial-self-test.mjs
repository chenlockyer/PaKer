import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const temporaryDirectory = await mkdtemp(join(tmpdir(), 'paker-level-tutorial-test-'));
const serviceBundle = join(temporaryDirectory, 'level-service.mjs');
const tutorialBundle = join(temporaryDirectory, 'tutorial-service.mjs');

const makeStorage = () => {
  const values = new Map();
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
};

try {
  await Promise.all([
    build({ entryPoints: ['services/levelService.ts'], outfile: serviceBundle, bundle: true, platform: 'node', format: 'esm', logLevel: 'silent' }),
    build({ entryPoints: ['services/tutorialService.ts'], outfile: tutorialBundle, bundle: true, platform: 'node', format: 'esm', logLevel: 'silent' }),
  ]);
  const levels = await import(`${pathToFileURL(serviceBundle).href}?v=${Date.now()}`);
  const tutorials = await import(`${pathToFileURL(tutorialBundle).href}?v=${Date.now()}`);

  const blueprint = {
    schemaVersion: 2,
    id: 'fixture-blueprint',
    name: 'Fixture',
    description: '',
    author: '',
    category: 'tutorial',
    tags: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    cardSize: 'BRIDGE',
    cardDimensions: { width: 1.8, height: 2.5, thickness: 0.02 },
    cardCount: 1,
    coordinateSpace: 'structure-local',
    status: 'published',
    tolerances: { horizontal: .1, height: .1, rotationDegrees: 5, nearHorizontal: .2, nearHeight: .2, nearRotationDegrees: 10 },
    steps: [{ id: 'step-1', order: 0, title: 'Step', description: '', cardIds: ['card-1'], freezeDuringBuild: false, releasePhysicsAfterStep: false }],
    snapshot: {
      capturedAt: '2026-01-01T00:00:00.000Z', source: 'live-physics', originWorld: [0, 0, 0],
      bounds: { min: [0, 0, 0], max: [0, 0, 0], size: [0, 0, 0] },
      cards: [{ id: 'card-1', order: 0, position: [0, 0, 0], quaternion: [0, 0, 0, 1], suit: 'spades', rank: 'A', color: 'black' }],
    },
  };
  const checksum = levels.checksumBlueprint(blueprint);
  const legacy = {
    schemaVersion: 1,
    id: 'legacy-level',
    name: { zh: '旧关卡', en: 'Legacy' },
    description: { zh: '', en: '' },
    origin: 'player', requiresBlueprintMatch: true, author: '', tags: [],
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', status: 'published',
    sourceBlueprintId: blueprint.id, embeddedBlueprint: blueprint, blueprintChecksum: checksum,
    maxCards: 2, minCards: 1, heightMultiplier: 1, testDuration: 3, testType: 'STABILITY',
    testStages: [{ id: 'stage-1', name: 'Test', testType: 'STABILITY', duration: 3 }],
    tutorial: {
      enabled: true, entryTitle: { zh: '开始', en: 'Start' }, entrySubtitle: { zh: '', en: '' },
      cues: [{ id: 'old-preset', kind: 'preset', text: { zh: '选预设', en: '' }, presetId: 'flat_portrait' }],
    },
    scoring: { baseScore: 100, unusedCardBonus: 10, heightBonus: 10 },
    verification: { passed: true, playtestedAt: '2026-01-01T00:00:00.000Z', blueprintChecksum: checksum },
  };

  const migrated = levels.validateLevel(legacy);
  assert.equal(migrated.schemaVersion, 2);
  assert.equal(migrated.publishRevision, 1);
  assert.equal(migrated.tutorial.displayMode, 'first-time');
  assert.equal(migrated.tutorial.cues[0].enabled, true);
  assert.deepEqual(migrated.tutorial.cues[0].target, { type: 'preset', presetId: 'flat_portrait' });
  assert.deepEqual(migrated.tutorial.cues[0].hints.map(hint => hint.delayMs), [3000, 8000, 15000]);

  const published = levels.publishLevel(migrated);
  assert.equal(published.publishRevision, 2);
  const storage = makeStorage();
  assert.equal(tutorials.hasCompletedLevelTutorial(storage, published), false);
  tutorials.markLevelTutorialCompleted(storage, published);
  assert.equal(tutorials.hasCompletedLevelTutorial(storage, published), true);
  assert.equal(tutorials.hasCompletedLevelTutorial(storage, { ...published, publishRevision: 3 }), false);

  const duplicateCueLevel = {
    ...published,
    tutorial: { ...published.tutorial, cues: [published.tutorial.cues[0], published.tutorial.cues[0]] },
  };
  assert.ok(levels.getLevelValidationIssues(duplicateCueLevel).includes('invalid-tutorial-cues'));

  console.log('Level tutorial self-test passed.');
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}
