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
  assert.equal(gesture.resolveCardRole(undefined), 'structure');
  assert.equal(gesture.canLaunchCardRole(undefined), false);
  assert.equal(gesture.canLaunchCardRole('structure'), false);
  assert.equal(gesture.canLaunchCardRole('ammo'), true);
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
  assert.equal(gesture.resolveLaunchImpulseMagnitude(-1, 0.25, 2.45), 0.25);
  assert.equal(gesture.resolveLaunchImpulseMagnitude(1, 0.25, 2.45), 2.45);
  assert.equal(gesture.resolveLaunchImpulseMagnitude(2, 0.25, 2.45), 2.45);
  assert.ok(
    gesture.resolveLaunchImpulseMagnitude(0.75, 0.25, 2.45)
      > gesture.resolveLaunchImpulseMagnitude(0.25, 0.25, 2.45),
    'impulse output must be monotonic',
  );

  // Deterministic Galgame-style triangular meter and formal/push curves.
  assert.equal(gesture.resolveLaunchMeterPower(0), 0);
  assert.equal(gesture.resolveLaunchMeterPower(600), 0.5);
  assert.equal(gesture.resolveLaunchMeterPower(1200), 1);
  assert.equal(gesture.resolveLaunchMeterPower(1800), 0.5);
  assert.equal(gesture.resolveLaunchMeterPower(2400), 0);
  assert.equal(gesture.resolveLaunchMeterPower(3000), 0.5);
  assert.equal(gesture.resolveLaunchMeterPower(-100), 0);
  assert.equal(gesture.resolvePowerMeter(600), 0.5);
  assert.equal(gesture.resolvePowerMeter(600, 600), 1);
  assert.equal(gesture.resolveLaunchTargetSpeed(0, 2.5, 24.5), 2.5);
  assert.equal(gesture.resolveLaunchTargetSpeed(1, 2.5, 24.5), 24.5);
  assert.equal(gesture.resolveFormalLaunchImpulseMagnitude(0), 0.25);
  assert.equal(gesture.resolveFormalLaunchImpulseMagnitude(1), 2.45);
  assert.equal(gesture.resolvePushImpulseMagnitude(0), 0.02);
  assert.equal(gesture.resolvePushImpulseMagnitude(1), 0.45);
  assert.equal(gesture.resolvePushImpulseMagnitude(1, 0.02, 0.8), 0.8);
  assert.ok(
    gesture.resolveFormalLaunchImpulseMagnitude(0.25)
      < gesture.resolveFormalLaunchImpulseMagnitude(0.5),
    'formal launch curve must be monotonic',
  );
  assert.ok(
    gesture.resolvePushImpulseMagnitude(0.5)
      < gesture.resolveFormalLaunchImpulseMagnitude(0.5),
    'push must remain much weaker than formal launch',
  );

  // Fixed-stroke actuator: light loads hit the speed cap, heavy loads decay smoothly.
  const idealSpeeds = [1, 2, 3, 4, 6].map(count =>
    gesture.resolveIdealActuatorExitSpeed(count * 0.1, 24.5, 150, 0.45),
  );
  assert.equal(idealSpeeds[0], 24.5);
  assert.equal(idealSpeeds[1], 24.5);
  assert.ok(idealSpeeds[2] / idealSpeeds[0] > 0.8);
  assert.ok(idealSpeeds[2] / idealSpeeds[0] < 0.95);
  assert.ok(idealSpeeds[4] / idealSpeeds[0] > 0.55);
  assert.ok(idealSpeeds[4] / idealSpeeds[0] < 0.75);
  assert.ok(idealSpeeds.every((speed, index) => index === 0 || speed <= idealSpeeds[index - 1]));

  const forceLimited = gesture.resolveLaunchActuatorStep({
    totalMass: 0.3,
    forwardSpeed: 0,
    targetSpeed: 24.5,
    maximumForce: 150,
    deltaTime: 1 / 60,
  });
  assert.equal(forceLimited.impulseMagnitude, 2.5);
  assert.equal(forceLimited.appliedForce, 150);
  const simulateActuator = totalMass => {
    let forwardSpeed = 0;
    let workUsed = 0;
    const workLimit = 150 * 0.45;
    for (let stepIndex = 0; stepIndex < 120 && workUsed < workLimit; stepIndex += 1) {
      const step = gesture.resolveLaunchActuatorStep({
        totalMass,
        forwardSpeed,
        targetSpeed: 24.5,
        maximumForce: 150,
        deltaTime: 1 / 60,
        remainingWork: workLimit - workUsed,
      });
      forwardSpeed += step.impulseMagnitude / totalMass;
      workUsed += step.workApplied;
      if (step.targetReached || step.impulseMagnitude === 0) break;
    }
    return forwardSpeed;
  };
  idealSpeeds.forEach((idealSpeed, index) => {
    const actualSpeed = simulateActuator([1, 2, 3, 4, 6][index] * 0.1);
    assert.ok(Math.abs(actualSpeed - idealSpeed) < 1e-8);
  });
  const targetLimited = gesture.resolveLaunchActuatorStep({
    totalMass: 0.1,
    forwardSpeed: 24,
    targetSpeed: 24.5,
    maximumForce: 150,
    deltaTime: 1 / 60,
  });
  assert.ok(Math.abs(targetLimited.impulseMagnitude - 0.05) < 1e-10);
  assert.equal(targetLimited.targetReached, true);

  const dimensions = { width: 1.8, height: 2.6, thickness: 0.02 };
  const shortEdge = gesture.getLaunchPresetCandidates('short-edge', dimensions);
  assert.deepEqual(shortEdge, [
    { index: 0, contactPointLocal: [0, 0, 1.3], directionLocal: [0, 0, -1] },
    { index: 1, contactPointLocal: [0, 0, -1.3], directionLocal: [0, 0, 1] },
  ]);
  const longEdge = gesture.getLaunchPresetCandidates('long-edge-quarter', dimensions);
  assert.equal(longEdge.length, 4);
  assert.deepEqual(longEdge[0], {
    index: 0,
    contactPointLocal: [0.9, 0, 0.65],
    directionLocal: [-1, 0, 0],
  });
  assert.deepEqual(longEdge[3], {
    index: 3,
    contactPointLocal: [-0.9, 0, -0.65],
    directionLocal: [1, 0, 0],
  });
  const back = gesture.getLaunchPresetCandidates('card-back-half', dimensions);
  assert.deepEqual(back, [
    { index: 0, contactPointLocal: [0, -0.01, 0.65], directionLocal: [0, 1, 0] },
    { index: 1, contactPointLocal: [0, -0.01, -0.65], directionLocal: [0, 1, 0] },
  ]);
  assert.equal(
    gesture.snapLaunchPresetContact('short-edge', [0.2, 0, -1], dimensions).index,
    1,
  );
  assert.equal(
    gesture.snapLaunchPresetContact('long-edge-quarter', [-0.8, 0, 0.5], dimensions).index,
    2,
  );
  assert.equal(
    gesture.snapLaunchPresetContact('card-back-half', [0, -0.01, -0.4], dimensions).index,
    1,
  );
  assert.equal(gesture.isCardBackContact([0, -0.01, 0], dimensions), true);
  assert.equal(gesture.isCardBackContact([0, 0.01, 0], dimensions), false);
  assert.deepEqual(
    gesture.resolveLaunchTarget('card-back-half', [0, 0.01, 0.4], dimensions),
    {
      contactLocal: [0, -0.01, 0.65],
      directionLocal: [0, 1, 0],
      candidateIndex: 0,
      valid: false,
    },
  );
  assert.equal(
    gesture.resolveLaunchTarget('short-edge', [0, 0.01, 1], dimensions).valid,
    true,
  );

  const closeTo = (actual, expected, epsilon = 1e-8) => {
    assert.equal(actual.length, expected.length);
    actual.forEach((value, index) => {
      assert.ok(
        Math.abs(value - expected[index]) <= epsilon,
        `${actual} must be close to ${expected}`,
      );
    });
  };
  const rotationY90 = [0, Math.sin(Math.PI / 4), 0, Math.cos(Math.PI / 4)];
  closeTo(gesture.quaternionToWorldDirection([0, 0, 1], rotationY90), [1, 0, 0]);
  closeTo(gesture.worldDirectionFromQuaternion([0, 0, 1], rotationY90), [1, 0, 0]);
  closeTo(gesture.quaternionToWorldDirection([1, 0, 0], rotationY90), [0, 0, -1]);
  closeTo(gesture.localPointToWorld([0, 0, 1], [4, 5, 6], rotationY90), [5, 5, 6]);
  // Non-normalized quaternions and directions must still resolve consistently.
  closeTo(
    gesture.quaternionToWorldDirection([0, 0, 8], rotationY90.map(value => value * 3)),
    [1, 0, 0],
  );

  const makeCard = (
    id,
    position,
    { quaternion = [0, 0, 0, 1], locked = false, mass = 0.1, size = dimensions } = {},
  ) => ({ id, position, quaternion, locked, mass, dimensions: size });
  const pile = [
    makeCard('one', [0, 0, 0]),
    makeCard('two', [0, 0.02, 0]),
    makeCard('three', [0, 0.04, 0]),
    makeCard('four', [0, 0.06, 0]),
  ];
  assert.deepEqual(
    gesture.resolveLaunchStack(pile, 'one').map(card => card.id),
    ['one', 'two', 'three', 'four'],
    'adjacency search must include a complete pile without a count limit',
  );
  assert.deepEqual(
    gesture.findStackedCardIds('one', pile),
    ['one', 'two', 'three', 'four'],
  );
  assert.deepEqual(gesture.resolveLaunchStack(pile, 'missing'), []);
  assert.deepEqual(
    gesture.resolveLaunchStack([makeCard('locked', [0, 0, 0], { locked: true })], 'locked'),
    [],
  );

  const translatedOverlap = makeCard('overlap', [0.1, 0.02, 0.1]);
  assert.equal(gesture.areCardsStackNeighbors(pile[0], translatedOverlap), true);
  const mostlyOutside = makeCard('outside', [0.5, 0.02, 0]);
  assert.equal(
    gesture.areCardsStackNeighbors(pile[0], mostlyOutside),
    false,
    'less than 80% projected overlap must not group',
  );
  const farLayer = makeCard('far-layer', [0, 0.061, 0]);
  assert.equal(gesture.areCardsStackNeighbors(pile[0], farLayer), false);
  const lockedLayer = makeCard('locked-layer', [0, 0.02, 0], { locked: true });
  assert.equal(gesture.areCardsStackNeighbors(pile[0], lockedLayer), false);
  const rotation10 = [0, 0, Math.sin(10 * Math.PI / 360), Math.cos(10 * Math.PI / 360)];
  assert.equal(
    gesture.areCardsStackNeighbors(pile[0], makeCard('rotated', [0, 0.02, 0], {
      quaternion: rotation10,
    })),
    false,
    'more than 8 degrees of orientation difference must not group',
  );
  const rotation7 = [0, 0, Math.sin(7 * Math.PI / 360), Math.cos(7 * Math.PI / 360)];
  assert.equal(
    gesture.areCardsStackNeighbors(pile[0], makeCard('slightly-rotated', [0, 0.02, 0], {
      quaternion: rotation7,
    })),
    true,
  );
  // A rectangular card turned end-for-end has identical undirected physical axes.
  const rotation180 = [0, 1, 0, 0];
  assert.equal(
    gesture.areCardsStackNeighbors(pile[0], makeCard('end-for-end', [0, 0.02, 0], {
      quaternion: rotation180,
    })),
    true,
  );

  const equalShares = gesture.distributeImpulseMagnitudeByMass(pile.slice(0, 3), 2.4);
  closeTo(equalShares.map(share => share.impulseMagnitude), [0.8, 0.8, 0.8]);
  assert.equal(equalShares.reduce((sum, share) => sum + share.impulseMagnitude, 0), 2.4);
  closeTo(
    gesture.distributeImpulseByMass(2.4, pile.slice(0, 3))
      .map(share => share.impulseMagnitude),
    [0.8, 0.8, 0.8],
  );
  const unequalShares = gesture.distributeImpulseVectorByMass([
    makeCard('light', [0, 0, 0], { mass: 0.1 }),
    makeCard('heavy', [0, 0, 0], { mass: 0.2 }),
  ], [0, 0, 3]);
  closeTo(unequalShares[0].impulse, [0, 0, 1]);
  closeTo(unequalShares[1].impulse, [0, 0, 2]);
  closeTo(
    unequalShares.reduce(
      (sum, share) => sum.map((value, index) => value + share.impulse[index]),
      [0, 0, 0],
    ),
    [0, 0, 3],
  );
  assert.deepEqual(gesture.distributeImpulseMagnitudeByMass([], 2), []);
  assert.deepEqual(
    gesture.distributeImpulseMagnitudeByMass([makeCard('massless', [0, 0, 0], { mass: 0 })], 2),
    [],
  );

  console.log(
    'Launch self-test passed: fixed-stroke actuator, meter/push curves, local-axis presets, quaternion transforms, stack grouping, mass distribution, and repeatability.',
  );
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}
