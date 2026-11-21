/**
 * Headless physics check for the palace.
 *
 *   node scripts/palace/physics-check.mjs            # 8 simulated seconds
 *   PALACE_SECONDS=12 node scripts/palace/physics-check.mjs
 *
 * It builds the same card list the save contains and drops it into a bare Rapier
 * world with the game's parameters (0.1 kg, friction 1, floor 1.1, damping 0.5,
 * 60 Hz, gravity -9.81). No browser, no WebGL, so geometry can be iterated in a
 * second instead of a minute.
 *
 * Exit code 0 when every card keeps its pose: tilt < 8°, drop < 6 cm, shift < 8 cm.
 */

import RAPIER from '@dimforge/rapier3d-compat';
import { buildPalaceCards } from './palace-structure.mjs';

const SECONDS = Number(process.env.PALACE_SECONDS ?? 8);
const MAX_TILT = Number(process.env.PALACE_MAX_TILT ?? 8);
const MAX_DROP = Number(process.env.PALACE_MAX_DROP ?? 0.06);
const MAX_SHIFT = Number(process.env.PALACE_MAX_SHIFT ?? 0.08);

await RAPIER.init();

const rotate = (quaternion, vector) => {
  const [x, y, z, w] = quaternion;
  const ix = w * vector[0] + y * vector[2] - z * vector[1];
  const iy = w * vector[1] + z * vector[0] - x * vector[2];
  const iz = w * vector[2] + x * vector[1] - y * vector[0];
  const iw = -x * vector[0] - y * vector[1] - z * vector[2];
  return [
    ix * w + iw * -x + iy * -z - iz * -y,
    iy * w + iw * -y + iz * -x - ix * -z,
    iz * w + iw * -z + ix * -y - iy * -x,
  ];
};

const angleBetween = (a, b) => {
  const dot = Math.min(1, Math.max(-1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]));
  return (Math.acos(dot) * 180) / Math.PI;
};

const STAGE = Number(process.env.PALACE_STAGE ?? 9);
const { cards, report } = buildPalaceCards({ stage: STAGE });
const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
world.timestep = 1 / 60;
world.integrationParameters.maxCcdSubsteps = 2;

const ground = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.5, 0));
world.createCollider(
  RAPIER.ColliderDesc.cuboid(120, 0.5, 120)
    .setFriction(1.1)
    .setFrictionCombineRule(RAPIER.CoefficientCombineRule.Multiply),
  ground,
);

const entries = cards.map(card => {
  const [qx, qy, qz, qw] = card.quaternion;
  const body = world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(card.position[0], card.position[1], card.position[2])
      .setRotation({ x: qx, y: qy, z: qz, w: qw })
      .setLinearDamping(0.5)
      .setAngularDamping(0.5)
      .setCcdEnabled(true),
  );
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(0.9, 0.01, 1.4)
      .setMass(0.1)
      .setFriction(1)
      .setFrictionCombineRule(RAPIER.CoefficientCombineRule.Multiply),
    body,
  );
  return {
    id: card.id,
    body,
    start: card.position.slice(),
    startUp: rotate(card.quaternion, [0, 1, 0]),
  };
});

const steps = Math.round(SECONDS * 60);
for (let step = 0; step < steps; step += 1) world.step();

const rows = entries.map(entry => {
  const position = entry.body.translation();
  const rotation = entry.body.rotation();
  const up = rotate([rotation.x, rotation.y, rotation.z, rotation.w], [0, 1, 0]);
  return {
    id: entry.id,
    tilt: angleBetween(entry.startUp, up),
    drop: entry.start[1] - position.y,
    shift: Math.hypot(
      position.x - entry.start[0],
      position.y - entry.start[1],
      position.z - entry.start[2],
    ),
  };
});

world.free();

rows.sort((left, right) => right.tilt - left.tilt || right.drop - left.drop);
const failed = rows.filter(row => row.tilt > MAX_TILT || row.drop > MAX_DROP || row.shift > MAX_SHIFT);
const worstTilt = rows[0]?.tilt ?? 0;
const worstDrop = Math.max(...rows.map(row => row.drop));
const worstShift = Math.max(...rows.map(row => row.shift));

const pad = value => value.toFixed(4).padStart(9);
console.log(`纸牌宫殿 · ${cards.length} 张牌 · 模拟 ${SECONDS}s`);
if (report) {
  console.log(`  单元：${report.units.join(' / ')}`);
  console.log(`  尺寸：${report.size.map(value => value.toFixed(2)).join(' × ')} m · 最小间隙 ${report.minGap.toFixed(4)} m · 穿模 ${report.overlaps}`);
}
console.log(`  最差：倾角 ${worstTilt.toFixed(2)}° · 下沉 ${worstDrop.toFixed(4)} m · 位移 ${worstShift.toFixed(4)} m`);
console.log(`  超限：${failed.length} / ${rows.length}`);
for (const row of rows.slice(0, 8)) {
  console.log(`    ${row.id.padEnd(26)} tilt${pad(row.tilt)}° drop${pad(row.drop)} shift${pad(row.shift)}`);
}
if (failed.length > 0) {
  console.log('  FAIL');
  process.exitCode = 1;
} else {
  console.log('  PASS');
}
