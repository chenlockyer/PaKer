/**
 * Vector / quaternion / oriented-box helpers used by the level factory.
 *
 * The game stores card poses as an XYZ Euler triple, and the blueprint
 * snapshot stores them as quaternions. Everything here works in quaternions so
 * the generated geometry is independent of Euler ordering.
 */

export const DEG = Math.PI / 180;

export const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export const length = a => Math.sqrt(dot(a, a));
export const midpoint = (a, b) => scale(add(a, b), 0.5);
export const UP = [0, 1, 0];

export const normalize = a => {
  const len = length(a);
  if (len < 1e-12) throw new Error('Cannot normalize a zero-length vector');
  return scale(a, 1 / len);
};

export const horizontal = a => {
  const flat = [a[0], 0, a[2]];
  return length(flat) < 1e-9 ? null : normalize(flat);
};

/** Rotate a vector by a quaternion (x, y, z, w). */
export const rotate = (quaternion, vector) => {
  const [qx, qy, qz, qw] = quaternion;
  const [vx, vy, vz] = vector;
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

export const quatMultiply = (a, b) => [
  a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
  a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
  a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
  a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
];

/** Three.js `Euler(x, y, z, 'XYZ')` convention, matching the game runtime. */
export const quatFromEulerXYZ = (x, y, z) => {
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

export const quatFromAxisAngle = (axis, radians) => {
  const unit = normalize(axis);
  const half = radians / 2;
  const sin = Math.sin(half);
  return [unit[0] * sin, unit[1] * sin, unit[2] * sin, Math.cos(half)];
};

/**
 * Build a quaternion whose images of the local X / Y / Z axes are the given
 * world directions. Local X is the card width, local Y the card normal and
 * local Z the card height, which is exactly how the renderer builds the box.
 */
export const quatFromAxes = (xAxis, yAxis, zAxis) => {
  const m00 = xAxis[0]; const m01 = yAxis[0]; const m02 = zAxis[0];
  const m10 = xAxis[1]; const m11 = yAxis[1]; const m12 = zAxis[1];
  const m20 = xAxis[2]; const m21 = yAxis[2]; const m22 = zAxis[2];
  const trace = m00 + m11 + m22;

  let x; let y; let z; let w;
  if (trace > 0) {
    const s = Math.sqrt(trace + 1) * 2;
    w = 0.25 * s;
    x = (m21 - m12) / s;
    y = (m02 - m20) / s;
    z = (m10 - m01) / s;
  } else if (m00 > m11 && m00 > m22) {
    const s = Math.sqrt(1 + m00 - m11 - m22) * 2;
    w = (m21 - m12) / s;
    x = 0.25 * s;
    y = (m01 + m10) / s;
    z = (m02 + m20) / s;
  } else if (m11 > m22) {
    const s = Math.sqrt(1 + m11 - m00 - m22) * 2;
    w = (m02 - m20) / s;
    x = (m01 + m10) / s;
    y = 0.25 * s;
    z = (m12 + m21) / s;
  } else {
    const s = Math.sqrt(1 + m22 - m00 - m11) * 2;
    w = (m10 - m01) / s;
    x = (m02 + m20) / s;
    y = (m12 + m21) / s;
    z = 0.25 * s;
  }
  const len = Math.hypot(x, y, z, w);
  return [x / len, y / len, z / len, w / len];
};

/** World-space corners of a card sized box (width on x, thickness on y, height on z). */
export const boxCorners = (position, quaternion, dimensions) => {
  const halfWidth = dimensions.width / 2;
  const halfThickness = dimensions.thickness / 2;
  const halfHeight = dimensions.height / 2;
  const corners = [];
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      for (const sz of [-1, 1]) {
        corners.push(add(position, rotate(quaternion, [
          sx * halfWidth,
          sy * halfThickness,
          sz * halfHeight,
        ])));
      }
    }
  }
  return corners;
};

export const boundsOfPoints = points => {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  points.forEach(point => {
    for (let axis = 0; axis < 3; axis += 1) {
      min[axis] = Math.min(min[axis], point[axis]);
      max[axis] = Math.max(max[axis], point[axis]);
    }
  });
  return { min, max, size: sub(max, min) };
};

const OBB_AXES = [
  [1, 0, 0], [0, 1, 0], [0, 0, 1],
];

const projectRadius = (halfSizes, axes, axis) =>
  Math.abs(dot(axes[0], axis)) * halfSizes[0] +
  Math.abs(dot(axes[1], axis)) * halfSizes[1] +
  Math.abs(dot(axes[2], axis)) * halfSizes[2];

/**
 * Separating-axis test between two oriented boxes.
 *
 * Returns the signed gap along the best separating axis: positive means the
 * boxes are apart by that distance, negative means they interpenetrate by that
 * depth. Used to guarantee generated structures never start inside each other.
 */
export const boxGap = (left, right) => {
  const leftAxes = OBB_AXES.map(axis => rotate(left.quaternion, axis));
  const rightAxes = OBB_AXES.map(axis => rotate(right.quaternion, axis));
  const leftHalf = [left.dimensions.width / 2, left.dimensions.thickness / 2, left.dimensions.height / 2];
  const rightHalf = [right.dimensions.width / 2, right.dimensions.thickness / 2, right.dimensions.height / 2];
  const delta = sub(right.position, left.position);
  const axes = [...leftAxes, ...rightAxes];
  for (const leftAxis of leftAxes) {
    for (const rightAxis of rightAxes) {
      const candidate = cross(leftAxis, rightAxis);
      if (length(candidate) > 1e-6) axes.push(normalize(candidate));
    }
  }

  let largestGap = -Infinity;
  let deepestOverlap = Infinity;
  for (const axis of axes) {
    const distance = Math.abs(dot(delta, axis));
    const reach = projectRadius(leftHalf, leftAxes, axis) + projectRadius(rightHalf, rightAxes, axis);
    const gap = distance - reach;
    if (gap > 0) return gap;
    deepestOverlap = Math.min(deepestOverlap, -gap);
  }
  return -deepestOverlap;
};

export const round = (value, digits = 5) => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

export const roundTuple = (values, digits = 5) => values.map(value => round(value, digits));
