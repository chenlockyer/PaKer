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

console.log(`Physics self-test passed: ${trials} CCD drop and impact trials, zero tunneling.`);
