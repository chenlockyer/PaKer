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
  assert.equal(blueprint.steps[0].releasePhysicsAfterStep, true);

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

  console.log('Blueprint self-test passed: live capture, v1 migration, projection, matching, grounded-edge rejection, editor render.');
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}
