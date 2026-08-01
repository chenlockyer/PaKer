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
    launchMinimumSpeed: 30,
    launchMaximumSpeed: 10,
    launchMaximumForce: 999,
    meterOneWayDurationMs: Number.NaN,
  });
  assert.equal(normalized.cardMass, 0.5);
  assert.equal(normalized.cardFriction, 0);
  assert.equal(normalized.launchMinimumSpeed, 10);
  assert.equal(normalized.launchMaximumForce, 400);
  assert.equal(normalized.meterOneWayDurationMs, 1200);
  service.persistPhysicsSettings(storage, normalized);
  assert.deepEqual(service.loadPhysicsSettings(storage), normalized);

  const migrated = service.normalizePhysicsSettings({
    schemaVersion: 1,
    cardMass: 0.1,
    cardFriction: 1,
    floorFriction: 1.1,
    launchMinimumImpulse: 0.25,
    launchMaximumImpulse: 2.45,
    structureLinearDamping: 0.5,
    structureAngularDamping: 0.5,
    flightLinearDamping: 0.08,
    flightAngularDamping: 0.08,
    pushMaximumImpulse: 0.45,
    meterOneWayDurationMs: 1200,
  });
  assert.equal(migrated.schemaVersion, 2);
  assert.equal(migrated.launchMinimumSpeed, 2.5);
  assert.equal(migrated.launchMaximumSpeed, 24.5);

  store.set(service.PHYSICS_SETTINGS_STORAGE_KEY, '{broken');
  assert.deepEqual(service.loadPhysicsSettings(storage), service.DEFAULT_PHYSICS_SETTINGS);
  assert.deepEqual(service.normalizePhysicsSettings({ schemaVersion: 999 }), service.DEFAULT_PHYSICS_SETTINGS);
  console.log('Physics settings self-test passed: defaults, clamping, persistence, and recovery.');
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}
