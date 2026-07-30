import assert from 'node:assert/strict';
import RAPIER from '@dimforge/rapier3d-compat';

await RAPIER.init();

const width = 1.8;
const height = 2.8;
const thickness = 0.02;
const samples = Math.max(1, Number(process.env.PHYSICS_SAMPLES ?? 50));
const timeStep = 1 / 60;

const quaternionFromEuler = (x, y, z) => {
  const sx = Math.sin(x / 2);
  const cx = Math.cos(x / 2);
  const sy = Math.sin(y / 2);
  const cy = Math.cos(y / 2);
  const sz = Math.sin(z / 2);
  const cz = Math.cos(z / 2);
  return {
    x: sx * cy * cz + cx * sy * sz,
    y: cx * sy * cz - sx * cy * sz,
    z: cx * cy * sz + sx * sy * cz,
    w: cx * cy * cz - sx * sy * sz,
  };
};

const createWorld = () => {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.timestep = timeStep;
  world.integrationParameters.maxCcdSubsteps = 2;
  return world;
};

const runDropTrial = (heightMultiplier, rotation) => {
  const world = createWorld();
  const queue = new RAPIER.EventQueue(true);
  const targetBody = world.createRigidBody(
    RAPIER.RigidBodyDesc.fixed().setTranslation(0, thickness * 1.5, 0),
  );
  const targetCollider = world.createCollider(
    RAPIER.ColliderDesc.cuboid(width / 2, thickness / 2, height / 2)
      .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
    targetBody,
  );
  const fallingBody = world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(0, height * heightMultiplier, 0)
      .setRotation(rotation)
      .setCcdEnabled(true)
      .setLinearDamping(0.5)
      .setAngularDamping(0.5),
  );
  const fallingCollider = world.createCollider(
    RAPIER.ColliderDesc.cuboid(width / 2, thickness / 2, height / 2)
      .setMass(0.1)
      .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
    fallingBody,
  );
  let collided = false;
  let tunneled = false;
  for (let step = 0; step < 360 && !collided && !tunneled; step += 1) {
    world.step(queue);
    queue.drainCollisionEvents((left, right, started) => {
      if (
        started &&
        ((left === targetCollider.handle && right === fallingCollider.handle) ||
          (right === targetCollider.handle && left === fallingCollider.handle))
      ) collided = true;
    });
    if (fallingBody.translation().y < -height) tunneled = true;
  }
  world.free();
  return { collided, tunneled };
};

const runImpactTrial = speed => {
  const world = createWorld();
  const queue = new RAPIER.EventQueue(true);
  const edgeRotation = quaternionFromEuler(0, 0, Math.PI / 2);
  const targetBody = world.createRigidBody(
    RAPIER.RigidBodyDesc.fixed().setTranslation(0, height / 2, 0).setRotation(edgeRotation),
  );
  const targetCollider = world.createCollider(
    RAPIER.ColliderDesc.cuboid(width / 2, thickness / 2, height / 2)
      .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
    targetBody,
  );
  const projectileBody = world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(-5, height / 2, 0)
      .setRotation(edgeRotation)
      .setLinvel(speed, 0, 0)
      .setGravityScale(0)
      .setCcdEnabled(true)
      .setLinearDamping(0),
  );
  const projectileCollider = world.createCollider(
    RAPIER.ColliderDesc.cuboid(width / 2, thickness / 2, height / 2)
      .setMass(0.1)
      .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
    projectileBody,
  );
  let collided = false;
  let tunneled = false;
  for (let step = 0; step < 180 && !collided && !tunneled; step += 1) {
    world.step(queue);
    queue.drainCollisionEvents((left, right, started) => {
      if (
        started &&
        ((left === targetCollider.handle && right === projectileCollider.handle) ||
          (right === targetCollider.handle && left === projectileCollider.handle))
      ) collided = true;
    });
    if (projectileBody.translation().x > width) tunneled = true;
  }
  world.free();
  return { collided, tunneled };
};

const runImpulseAtPointTrial = contactX => {
  const world = new RAPIER.World({ x: 0, y: 0, z: 0 });
  world.timestep = timeStep;
  const body = world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(0, 1, 0)
      .setGravityScale(0)
      .setLinearDamping(0)
      .setAngularDamping(0),
  );
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(width / 2, thickness / 2, height / 2).setMass(0.1),
    body,
  );
  body.applyImpulseAtPoint(
    { x: 0, y: 0, z: 1.8 },
    { x: contactX, y: 1, z: 0 },
    true,
  );
  world.step();
  const result = {
    linear: body.linvel(),
    angular: body.angvel(),
  };
  world.free();
  return result;
};

const benchmarkCardScene = cardCount => {
  const world = createWorld();
  const floorBody = world.createRigidBody(
    RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.05, 0),
  );
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(20, 0.05, 20)
      .setFriction(1.1)
      .setFrictionCombineRule(RAPIER.CoefficientCombineRule.Multiply),
    floorBody,
  );
  const groupCount = Math.ceil(cardCount / 10);
  const columns = Math.min(3, groupCount);
  const rows = Math.ceil(groupCount / columns);
  for (let index = 0; index < cardCount; index += 1) {
    const groupIndex = Math.floor(index / 10);
    const stackIndex = index % 10;
    const column = groupIndex % columns;
    const row = Math.floor(groupIndex / columns);
    const body = world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(
          (column - (columns - 1) / 2) * 2.6,
          thickness / 2 + stackIndex * (thickness + 0.002),
          (row - (rows - 1) / 2) * 3.2,
        )
        .setCcdEnabled(true)
        .setLinearDamping(0.5)
        .setAngularDamping(0.5)
        .setCanSleep(true),
    );
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(width / 2, thickness / 2, height / 2)
        .setMass(0.1)
        .setFriction(1)
        .setFrictionCombineRule(RAPIER.CoefficientCombineRule.Multiply),
      body,
    );
  }
  for (let step = 0; step < 180; step += 1) world.step();
  const measuredSteps = 600;
  const startedAt = performance.now();
  for (let step = 0; step < measuredSteps; step += 1) world.step();
  const averageStepMs = (performance.now() - startedAt) / measuredSteps;
  world.free();
  return averageStepMs;
};

const runStructureStabilityTrial = cards => {
  const world = createWorld();
  const floorBody = world.createRigidBody(
    RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.05, 0),
  );
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(20, 0.05, 20)
      .setFriction(1.1)
      .setFrictionCombineRule(RAPIER.CoefficientCombineRule.Multiply),
    floorBody,
  );
  const bodies = cards.map(card => {
    const body = world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(...card.position)
        .setRotation(quaternionFromEuler(...card.rotation))
        .setCcdEnabled(true)
        .setLinearDamping(0.5)
        .setAngularDamping(0.5)
        .setCanSleep(true),
    );
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(width / 2, thickness / 2, height / 2)
        .setMass(0.1)
        .setFriction(1)
        .setFrictionCombineRule(RAPIER.CoefficientCombineRule.Multiply),
      body,
    );
    return body;
  });
  const snapshots = [];
  for (let step = 0; step < 1800; step += 1) {
    world.step();
    if (step === 1499 || step === 1799) {
      snapshots.push(bodies.map(body => ({ ...body.translation() })));
    }
  }
  const maxFinalDrift = Math.max(...snapshots[0].map((position, index) => {
    const finalPosition = snapshots[1][index];
    return Math.hypot(
      finalPosition.x - position.x,
      finalPosition.y - position.y,
      finalPosition.z - position.z,
    );
  }));
  const maximumSpeed = Math.max(...bodies.map(body => {
    const linear = body.linvel();
    const angular = body.angvel();
    return Math.max(
      Math.hypot(linear.x, linear.y, linear.z),
      Math.hypot(angular.x, angular.y, angular.z),
    );
  }));
  const finalHeights = bodies.map(body => body.translation().y);
  world.free();
  return { maxFinalDrift, maximumSpeed, finalHeights };
};

const dropCases = [
  ['flat', quaternionFromEuler(0, 0, 0)],
  ['upright', quaternionFromEuler(Math.PI / 2, 0, 0)],
  ['tilted-10', quaternionFromEuler(Math.PI / 18, 0, 0)],
];
const dropHeights = [0.5, 1, 3, 6];
const impactSpeeds = [5, 10, 15, 25];
let trials = 0;

for (const [orientation, rotation] of dropCases) {
  for (const heightMultiplier of dropHeights) {
    for (let sample = 0; sample < samples; sample += 1) {
      const result = runDropTrial(heightMultiplier, rotation);
      trials += 1;
      assert.equal(
        result.tunneled,
        false,
        `Rapier CCD tunneled during ${orientation} drop from ${heightMultiplier} card heights`,
      );
      assert.equal(
        result.collided,
        true,
        `Rapier CCD missed ${orientation} drop collision from ${heightMultiplier} card heights`,
      );
    }
  }
}

for (const speed of impactSpeeds) {
  for (let sample = 0; sample < samples; sample += 1) {
    const result = runImpactTrial(speed);
    trials += 1;
    assert.equal(result.tunneled, false, `Rapier CCD tunneled at ${speed} units/s`);
    assert.equal(result.collided, true, `Rapier CCD missed impact at ${speed} units/s`);
  }
}

const centeredLaunch = runImpulseAtPointTrial(0);
const leftLaunch = runImpulseAtPointTrial(-width * 0.42);
const rightLaunch = runImpulseAtPointTrial(width * 0.42);
assert.ok(Math.abs(centeredLaunch.angular.y) < 0.001, 'center launch must have low rotation');
assert.ok(
  Math.sign(leftLaunch.angular.y) === -Math.sign(rightLaunch.angular.y),
  'opposite edge contacts must create opposite rotations',
);
assert.ok(
  Math.abs(leftLaunch.linear.z - rightLaunch.linear.z) < 0.001,
  'edge contacts must preserve the same linear launch energy',
);

const performanceResults = [10, 30, 60].map(cardCount => ({
  cardCount,
  averageStepMs: benchmarkCardScene(cardCount),
}));
const maximumPhysicsStepMs = 1000 / (50 * 0.9);
for (const result of performanceResults) {
  assert.ok(
    result.averageStepMs <= maximumPhysicsStepMs,
    `${result.cardCount}-card physics step exceeded the 45 FPS performance gate`,
  );
}

const tilt10 = Math.PI / 18;
const officialCardY = Math.cos(tilt10) * height / 2 + 0.01;
const aPair = x => [
  { position: [x, officialCardY, -0.24], rotation: [Math.PI / 2 + tilt10, 0, 0] },
  { position: [x, officialCardY, 0.24], rotation: [Math.PI / 2 - tilt10, 0, 0] },
];
const officialAFrame = aPair(0);
const officialOneStory = [
  ...aPair(-1.45),
  ...aPair(1.45),
  {
    position: [-0.72, officialCardY * 2 + 0.03, 0],
    rotation: [0, Math.PI / 2, 0],
  },
  {
    position: [0.72, officialCardY * 2 + 0.03, 0],
    rotation: [0, Math.PI / 2, 0],
  },
];
for (const [name, cards, minimumUprightCards] of [
  ['official A-frame', officialAFrame, 2],
  ['official one-story house', officialOneStory, 4],
]) {
  const stability = runStructureStabilityTrial(cards);
  assert.ok(stability.maxFinalDrift < 0.03, `${name} drifted during the final 5 seconds`);
  assert.ok(stability.maximumSpeed < 0.03, `${name} did not settle within 30 seconds`);
  assert.ok(
    stability.finalHeights.filter(value => value > height * 0.35).length >= minimumUprightCards,
    `${name} collapsed during the 30-second stability test`,
  );
}

console.log(
  `Physics self-test passed: ${trials} CCD trials with zero tunneling; launch torque verified; `
    + `official structures stable for 30s; step times ${performanceResults.map(result => (
      `${result.cardCount}=${result.averageStepMs.toFixed(2)}ms`
    )).join(', ')}.`,
);
