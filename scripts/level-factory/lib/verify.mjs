/**
 * Headless Rapier simulation that mirrors the challenge test run in the game.
 *
 * It intentionally copies the runtime constants from components/PhysicsWorld.tsx
 * and components/Card.tsx: floor friction 1.1, card mass 0.1 kg, card friction 1,
 * damping 0.5, CCD on, 60 Hz, wind force applied 0.65 above each card centre,
 * and the 0.36 m / configurable-mass test weight.
 */

import RAPIER from '@dimforge/rapier3d-compat';
import { add, rotate } from './math.mjs';

let ready = null;
const initialise = () => {
  if (!ready) ready = RAPIER.init();
  return ready;
};

export const SIMULATION_DEFAULTS = {
  timestep: 1 / 60,
  gravity: { x: 0, y: -9.81, z: 0 },
  floorFriction: 1.1,
  cardMass: 0.1,
  cardFriction: 1,
  damping: 0.5,
  settleSeconds: 3,
  weightRadius: 0.36,
};

const createWorld = () => {
  const world = new RAPIER.World(SIMULATION_DEFAULTS.gravity);
  world.timestep = SIMULATION_DEFAULTS.timestep;
  world.integrationParameters.maxCcdSubsteps = 2;

  const floorBody = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(50, 0.05, 50)
      .setTranslation(0, -0.05, 0)
      .setFriction(SIMULATION_DEFAULTS.floorFriction)
      .setFrictionCombineRule(RAPIER.CoefficientCombineRule.Multiply)
      .setRestitution(0),
    floorBody,
  );
  return world;
};

const createCardBody = (world, card) => {
  const [qx, qy, qz, qw] = card.quaternion;
  const body = world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(card.position[0], card.position[1], card.position[2])
      .setRotation({ x: qx, y: qy, z: qz, w: qw })
      .setLinearDamping(SIMULATION_DEFAULTS.damping)
      .setAngularDamping(SIMULATION_DEFAULTS.damping)
      .setCcdEnabled(true),
  );
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(
      card.dimensions.width / 2,
      card.dimensions.thickness / 2,
      card.dimensions.height / 2,
    )
      .setMass(SIMULATION_DEFAULTS.cardMass)
      .setFriction(SIMULATION_DEFAULTS.cardFriction)
      .setFrictionCombineRule(RAPIER.CoefficientCombineRule.Multiply)
      .setRestitution(0),
    body,
  );
  return body;
};

const bodyMetrics = (body, card) => {
  const translation = body.translation();
  const rotation = body.rotation();
  const quaternion = [rotation.x, rotation.y, rotation.z, rotation.w];
  const corners = [];
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      for (const sz of [-1, 1]) {
        corners.push(add([translation.x, translation.y, translation.z], rotate(quaternion, [
          sx * card.dimensions.width / 2,
          sy * card.dimensions.thickness / 2,
          sz * card.dimensions.height / 2,
        ])));
      }
    }
  }
  const top = Math.max(...corners.map(corner => corner[1]));
  const bottom = Math.min(...corners.map(corner => corner[1]));
  const displacement = Math.hypot(
    translation.x - card.position[0],
    translation.y - card.position[1],
    translation.z - card.position[2],
  );
  return { top, bottom, displacement, position: [translation.x, translation.y, translation.z] };
};

/**
 * Run one stage list against a structure.
 *
 * `cards` are world-space cards ({ id, position, quaternion, dimensions }).
 * `stages` follow the game's LevelTestStage shape.
 */
export const simulateLevel = async ({
  cards,
  stages,
  targetHeight,
  settleSeconds = SIMULATION_DEFAULTS.settleSeconds,
  timestep = SIMULATION_DEFAULTS.timestep,
}) => {
  await initialise();
  const world = createWorld();
  const bodies = new Map(cards.map(card => [card.id, createCardBody(world, card)]));
  const floorHeight = cards.length > 0
    ? Math.min(...cards.map(card => bodyMetrics(bodies.get(card.id), card).bottom))
    : 0;

  const advance = (seconds, { windStrength = 0, elapsedOffset = 0 } = {}) => {
    const stepCount = Math.max(1, Math.round(seconds / timestep));
    for (let step = 0; step < stepCount; step += 1) {
      const elapsed = elapsedOffset + step * timestep;
      if (windStrength > 0) {
        const gust = windStrength * (0.8 + Math.sin(elapsed * 2.4) * 0.2);
        for (const card of cards) {
          const body = bodies.get(card.id);
          // Rapier keeps added forces and torques until they are cleared, so
          // the per-frame wind gust has to reset both accumulators first. The
          // runtime does the same in components/Card.tsx; without it the wind
          // ramps up every frame instead of acting as a steady force.
          body.resetForces(false);
          body.resetTorques(false);
          const position = body.translation();
          body.addForceAtPoint(
            { x: gust, y: 0, z: gust * 0.18 },
            { x: position.x, y: position.y + 0.65, z: position.z },
            true,
          );
        }
      }
      world.step();
    }
  };

  const snapshot = () => {
    const entries = cards.map(card => {
      const metrics = bodyMetrics(bodies.get(card.id), card);
      return { id: card.id, ...metrics };
    });
    return {
      entries,
      maxTop: Math.max(...entries.map(entry => entry.top)),
      minBottom: Math.min(...entries.map(entry => entry.bottom)),
      maxDisplacement: Math.max(...entries.map(entry => entry.displacement)),
      displaced: entries
        .filter(entry => entry.displacement > 0.05)
        .sort((left, right) => right.displacement - left.displacement)
        .slice(0, 6)
        .map(entry => ({ id: entry.id, displacement: Number(entry.displacement.toFixed(3)) })),
      sunk: entries.filter(entry => entry.bottom < floorHeight - 0.05).map(entry => entry.id),
    };
  };

  // Build phase in the game leaves the structure untouched; the countdown is
  // the first moment physics takes over.
  advance(settleSeconds);
  const settled = snapshot();

  const stageResults = [];
  let elapsed = settleSeconds;
  for (const stage of stages) {
    if (stage.testType === 'WEIGHT_DROP') {
      const mass = stage.weightMass ?? 0.45;
      const dropHeight = targetHeight + (stage.weightDropOffset ?? 4);
      const ball = world.createRigidBody(
        RAPIER.RigidBodyDesc.dynamic()
          .setTranslation(0, dropHeight, 0)
          .setLinearDamping(0.02)
          .setAngularDamping(0.1)
          .setCcdEnabled(true),
      );
      world.createCollider(
        RAPIER.ColliderDesc.ball(SIMULATION_DEFAULTS.weightRadius)
          .setMass(mass)
          .setFriction(0.65)
          .setRestitution(0.05),
        ball,
      );
    }
    advance(stage.duration, {
      windStrength: stage.testType === 'WIND' ? (stage.windStrength ?? 0) : 0,
      elapsedOffset: elapsed,
    });
    elapsed += stage.duration;
    const result = snapshot();
    stageResults.push({
      id: stage.id,
      testType: stage.testType,
      duration: stage.duration,
      windStrength: stage.windStrength ?? 0,
      weightMass: stage.weightMass ?? null,
      maxTop: Number(result.maxTop.toFixed(3)),
      threshold: Number((targetHeight * 0.72).toFixed(3)),
      survived: result.maxTop >= targetHeight * 0.72,
      maxDisplacement: Number(result.maxDisplacement.toFixed(3)),
      displaced: result.displaced,
      sunk: result.sunk,
    });
  }

  world.free();
  return {
    settled: {
      maxTop: Number(settled.maxTop.toFixed(3)),
      maxDisplacement: Number(settled.maxDisplacement.toFixed(3)),
      displaced: settled.displaced,
    },
    stages: stageResults,
    survived: stageResults.every(stage => stage.survived),
    worstStage: stageResults.reduce(
      (worst, stage) => (worst === null || stage.maxTop < worst.maxTop ? stage : worst),
      null,
    ),
  };
};
