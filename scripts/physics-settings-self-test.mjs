import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const temporaryDirectory = await mkdtemp(join(tmpdir(), 'paker-physics-settings-test-'));
const bundlePath = join(temporaryDirectory, 'physics-settings.mjs');

try {
  await build({
    entryPoints: ['services/physicsSettingsService.ts'],
    outfile: bundlePath,
    bundle: true,
    platform: 'node',
    format: 'esm',
    logLevel: 'silent',
  });
  const service = await import(`${pathToFileURL(bundlePath).href}?v=${Date.now()}`);
  const store = new Map();
  const storage = {
    getItem: key => store.get(key) ?? null,
    setItem: (key, value) => store.set(key, value),
  };

  assert.deepEqual(service.loadPhysicsSettings(storage), service.DEFAULT_PHYSICS_SETTINGS);
  const normalized = service.normalizePhysicsSettings({
    ...service.DEFAULT_PHYSICS_SETTINGS,
    cardMass: 99,
    cardFriction: -2,
    launchMinimumImpulse: 1,
    launchMaximumImpulse: 0.5,
    meterOneWayDurationMs: Number.NaN,
  });
  assert.equal(normalized.cardMass, 0.5);
  assert.equal(normalized.cardFriction, 0);
  assert.equal(normalized.launchMinimumImpulse, 0.5);
  assert.equal(normalized.meterOneWayDurationMs, 1200);
  service.persistPhysicsSettings(storage, normalized);
  assert.deepEqual(service.loadPhysicsSettings(storage), normalized);

  store.set(service.PHYSICS_SETTINGS_STORAGE_KEY, '{broken');
  assert.deepEqual(service.loadPhysicsSettings(storage), service.DEFAULT_PHYSICS_SETTINGS);
  assert.deepEqual(service.normalizePhysicsSettings({ schemaVersion: 999 }), service.DEFAULT_PHYSICS_SETTINGS);
  console.log('Physics settings self-test passed: defaults, clamping, persistence, and recovery.');
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}
