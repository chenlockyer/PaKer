import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
import * as THREE from 'three';

const temporaryDirectory = await mkdtemp(join(tmpdir(), 'paker-blueprint-test-'));
const bundlePath = join(temporaryDirectory, 'blueprint-service.mjs');
  const editorBundlePath = join(temporaryDirectory, 'blueprint-editor.cjs');
  const tutorialBundlePath = join(temporaryDirectory, 'official-tutorials.mjs');
  const levelBundlePath = join(temporaryDirectory, 'level-service.mjs');
const require = createRequire(import.meta.url);

try {
  await build({
    entryPoints: ['services/blueprintService.ts'],
    outfile: bundlePath,
    bundle: true,
    platform: 'node',
    format: 'esm',
    logLevel: 'silent',
  });

  const service = await import(`${pathToFileURL(bundlePath).href}?v=${Date.now()}`);
  const card = {
    id: 'card-1',
    position: [9, 9, 9],
    rotation: [0, 0, 0],
    suit: 'spades',
    rank: 'A',
    color: 'black',
    locked: false,
  };
  const liveTransforms = new Map([
    ['card-1', { position: [2, 0.01, 3], rotation: [0, 0, 0] }],
  ]);

  const snapshot = service.createBlueprintSnapshot([card], liveTransforms, 'BRIDGE');
  assert.equal(snapshot.source, 'live-physics');
  assert.notDeepEqual(snapshot.originWorld, [9, 9, 9], 'capture must use live physics, not placement state');
  assert.equal(snapshot.cards.length, 1);

  const blueprint = service.createBlueprint({
    name: 'Self test',
    description: '',
    author: '',
    category: 'experiment',
    tags: ['test'],
    cardSize: 'BRIDGE',
    snapshot,
  });
  assert.equal(blueprint.schemaVersion, 2);
  assert.equal(blueprint.steps.length, 1);
  assert.equal(blueprint.steps[0].cardIds[0], 'card-1');
  assert.equal(blueprint.steps[0].freezeDuringBuild, false);
  assert.equal(blueprint.steps[0].releasePhysicsAfterStep, false);

  const guide = {
    blueprint,
    origin: [4, 0, -2],
    yaw: Math.PI / 2,
  };
  const worldCards = service.getBlueprintWorldCards(guide);
  const target = worldCards[0];
  const targetEuler = new THREE.Euler().setFromQuaternion(
    new THREE.Quaternion(...target.quaternion),
    'XYZ',
  );
  const playerCard = {
    ...card,
    id: 'player-1',
    position: target.position,
    rotation: [targetEuler.x, targetEuler.y, targetEuler.z],
  };
  const exactMatches = service.matchCardsToBlueprint(worldCards, [playerCard], new Map());
  assert.equal(exactMatches[0].status, 'matched');
  assert.equal(exactMatches[0].feedback, 'correct');

  const wrongEdgeCard = {
    ...playerCard,
    rotation: [Math.PI / 2, 0, 0],
  };
  const wrongEdgeMatches = service.matchCardsToBlueprint(worldCards, [wrongEdgeCard], new Map());
  assert.notEqual(wrongEdgeMatches[0].status, 'matched');

  const legacy = {
    ...blueprint,
    schemaVersion: 1,
  };
  delete legacy.steps;
  delete legacy.tolerances;
  delete legacy.status;
  const migrated = service.parseBlueprintFile(JSON.stringify(legacy));
  assert.equal(migrated.schemaVersion, 2);
  assert.equal(migrated.status, 'draft');
  assert.equal(migrated.steps.length, 1);

  await build({
    entryPoints: ['services/officialBlueprints.ts'],
    outfile: tutorialBundlePath,
    bundle: true,
    platform: 'node',
    format: 'esm',
    logLevel: 'silent',
  });
  const tutorials = await import(`${pathToFileURL(tutorialBundlePath).href}?v=${Date.now()}`);
  assert.equal(tutorials.OFFICIAL_TUTORIAL_BLUEPRINTS.length, 4);
  assert.deepEqual(
    tutorials.OFFICIAL_TUTORIAL_BLUEPRINTS.map(item => item.cardCount),
    [2, 4, 5, 10],
  );
  tutorials.OFFICIAL_TUTORIAL_BLUEPRINTS.forEach((item, index) => {
    assert.equal(item.id, `official_tutorial_${index + 1}`);
    assert.equal(item.category, 'tutorial');
    assert.equal(item.status, 'published');
    assert.ok(item.steps.every(itemStep => itemStep.cardIds.length > 0));
    const assigned = new Set(item.steps.flatMap(itemStep => itemStep.cardIds));
    assert.ok(item.snapshot.cards.every(itemCard => assigned.has(itemCard.id)));
  });

  await build({
    entryPoints: ['services/levelService.ts'],
    outfile: levelBundlePath,
    bundle: true,
    platform: 'node',
    format: 'esm',
    logLevel: 'silent',
  });
  const levelService = await import(`${pathToFileURL(levelBundlePath).href}?v=${Date.now()}`);
  const sourceBlueprint = tutorials.OFFICIAL_TUTORIAL_BLUEPRINTS[0];
  const level = levelService.createLevel({
    name: 'A-frame level',
    description: 'Self-contained',
    author: 'test',
    origin: 'official',
    tags: ['test'],
    blueprint: sourceBlueprint,
    maxCards: 3,
    minCards: 2,
    heightMultiplier: 1,
    testDuration: 4,
    testType: 'STABILITY',
  });
  assert.notEqual(level.embeddedBlueprint, sourceBlueprint);
  assert.notEqual(level.embeddedBlueprint.id, sourceBlueprint.id);
  assert.equal(level.sourceBlueprintId, sourceBlueprint.id);
  assert.equal(level.testStages.length, 1);
  assert.equal(levelService.validateLevel(level).id, level.id);
  assert.ok(levelService.getLevelValidationIssues(level).includes('playtest-required'));
  const verifiedLevel = levelService.markLevelPlaytested(level);
  assert.equal(levelService.publishLevel(verifiedLevel).status, 'published');
  const duplicatedLevel = levelService.duplicateLevel(verifiedLevel);
  assert.notEqual(duplicatedLevel.id, level.id);
  assert.equal(duplicatedLevel.verification.passed, false);
  const updatedLevel = levelService.updateLevel(verifiedLevel, {
    name: 'Edited',
    description: '',
    author: 'test',
    origin: 'official',
    tags: [],
    blueprint: verifiedLevel.embeddedBlueprint,
    maxCards: 4,
    minCards: 2,
    heightMultiplier: 1,
    testDuration: 3,
    testType: 'STABILITY',
    testStages: [
      { id: 'one', name: 'Stability', testType: 'STABILITY', duration: 3 },
      { id: 'two', name: 'Wind', testType: 'WIND', duration: 4, windStrength: 0.02 },
    ],
  });
  assert.equal(updatedLevel.id, level.id);
  assert.equal(updatedLevel.sourceBlueprintId, level.sourceBlueprintId);
  assert.equal(updatedLevel.testStages.length, 2);
  assert.equal(updatedLevel.verification.passed, false);
  assert.equal(levelService.validateLevel(updatedLevel).id, level.id);
  sourceBlueprint.name = 'Source changed';
  assert.equal(level.embeddedBlueprint.name, '第 1 课：A 字架');
  assert.throws(() => levelService.validateLevel({
    ...level,
    embeddedBlueprint: { ...level.embeddedBlueprint, name: 'Tampered' },
  }));

  await build({
    stdin: {
      contents: `
        import React from 'react';
        import { renderToStaticMarkup } from 'react-dom/server';
        import BlueprintEditor from './components/BlueprintEditor';
        export const renderEditor = props =>
          renderToStaticMarkup(React.createElement(BlueprintEditor, props));
      `,
      resolveDir: process.cwd(),
      sourcefile: 'blueprint-editor-test-entry.jsx',
      loader: 'jsx',
    },
    outfile: editorBundlePath,
    bundle: true,
    platform: 'node',
    format: 'cjs',
    logLevel: 'silent',
  });
  const { renderEditor } = require(editorBundlePath);
  const editorMarkup = renderEditor({
    blueprint,
    presets: [],
    lang: 'zh',
    currentCameraHint: { position: [0, 8, 12], target: [0, 0, 0] },
    onChange: () => {},
    onTest: () => {},
    onBack: () => {},
  });
  assert.match(editorMarkup, /步骤时间线/);
  assert.match(editorMarkup, /卡牌分组/);
  assert.match(editorMarkup, /从头测试/);

  console.log('Blueprint self-test passed: capture, tutorials, embedded level snapshot, checksum, matching, and editor.');
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}
