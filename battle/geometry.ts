/**
 * Minimal card geometry for battle rules.
 *
 * The battle layer only needs to know how far a card's lowest corner sits above
 * the floor, so it keeps its own three.js-free quaternion maths instead of
 * pulling the renderer into the engine.
 */

import { CARD_DIMENSIONS, CardSize } from '../types';

export type Vec3 = [number, number, number];
export type Quat = [number, number, number, number];

export const rotateVector = (
  [qx, qy, qz, qw]: Quat,
  [vx, vy, vz]: Vec3,
): Vec3 => {
  const ix = qw * vx + qy * vz - qz * vy;
  const iy = qw * vy + qz * vx - qx * vz;
  const iz = qw * vz + qx * vy - qy * vx;
  const iw = -qx * vx - qy * vy - qz * vz;
  return [
    ix * qw + iw * -qx + iy * -qz - iz * -qy,
    iy * qw + iw * -qy + iz * -qx - ix * -qz,
    iz * qw + iw * -qz + ix * -qy - iy * -qx,
  ];
};

/** Lowest world Y of an oriented card box. */
export const lowestCardCorner = (
  position: Vec3,
  quaternion: Quat,
  cardSize: CardSize,
): number => {
  const dimensions = CARD_DIMENSIONS[cardSize];
  const halfWidth = dimensions.width / 2;
  const halfThickness = dimensions.thickness / 2;
  const halfHeight = dimensions.height / 2;
  let lowest = Infinity;
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const corner = rotateVector(quaternion, [
          sx * halfWidth,
          sy * halfThickness,
          sz * halfHeight,
        ]);
        lowest = Math.min(lowest, position[1] + corner[1]);
      }
    }
  }
  return lowest;
};

/** Three.js `Euler(x, y, z, 'XYZ')` → quaternion, matching the renderer. */
export const quatFromEulerXYZ = (x: number, y: number, z: number): Quat => {
  const sx = Math.sin(x / 2);
  const cx = Math.cos(x / 2);
  const sy = Math.sin(y / 2);
  const cy = Math.cos(y / 2);
  const sz = Math.sin(z / 2);
  const cz = Math.cos(z / 2);
  return [
    sx * cy * cz + cx * sy * sz,
    cx * sy * cz - sx * cy * sz,
    cx * cy * sz + sx * sy * cz,
    cx * cy * cz - sx * sy * sz,
  ];
};

export const distance3 = (left: Vec3, right: Vec3) => Math.hypot(
  left[0] - right[0],
  left[1] - right[1],
  left[2] - right[2],
);

export const distance2 = (left: Vec3, right: Vec3) => Math.hypot(
  left[0] - right[0],
  left[2] - right[2],
);
