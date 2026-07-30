import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const temporaryDirectory = await mkdtemp(join(tmpdir(), 'paker-launch-test-'));
const bundlePath = join(temporaryDirectory, 'launch-gesture.mjs');

try {
  await build({
    entryPoints: ['physics/launchGesture.ts'],
    outfile: bundlePath,
    bundle: true,
    platform: 'node',
    format: 'esm',
    logLevel: 'silent',
  });
  const gesture = await import(`${pathToFileURL(bundlePath).href}?v=${Date.now()}`);
  const viewport = 720;
  const slow = [
    { x: 100, y: 100, time: 0 },
    { x: 150, y: 100, time: 300 },
  ];
  const fast = [
    { x: 100, y: 100, time: 0 },
    { x: 150, y: 100, time: 35 },
  ];
  const longFast = [
    { x: 100, y: 100, time: 0 },
    { x: 240, y: 100, time: 70 },
  ];
  const slowResult = gesture.resolveLaunchGesture(slow, viewport);
  const fastResult = gesture.resolveLaunchGesture(fast, viewport);
  const longFastResult = gesture.resolveLaunchGesture(longFast, viewport);
  assert.ok(fastResult.power > slowResult.power, 'terminal speed must add launch power');
  assert.ok(longFastResult.power > fastResult.power, 'distance must add launch power');
  assert.ok(longFastResult.power <= 1 && slowResult.power >= 0, 'power must stay normalized');
  assert.equal(gesture.isLaunchGesturePastDeadZone(slow, viewport), true);
  assert.equal(
    gesture.isLaunchGesturePastDeadZone([
      { x: 100, y: 100, time: 0 },
      { x: 102, y: 101, time: 50 },
    ], viewport),
    false,
  );

  const repeated = Array.from({ length: 100 }, () =>
    gesture.resolveLaunchGesture(longFast, viewport),
  );
  assert.ok(repeated.every(result => result.power === repeated[0].power));
  console.log('Launch self-test passed: power curve, speed weighting, dead zone, and repeatability.');
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}
