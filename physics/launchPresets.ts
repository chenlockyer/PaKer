export type LaunchPreset =
  | 'short-edge'
  | 'long-edge-quarter'
  | 'card-back-half';

export type LaunchVector3 = [number, number, number];
export type LaunchQuaternion = [number, number, number, number];

export interface LaunchCardDimensions {
  width: number;
  height: number;
  thickness: number;
}

export interface LaunchPresetCandidate {
  index: number;
  contactPointLocal: LaunchVector3;
  directionLocal: LaunchVector3;
}

export interface SnappedLaunchPreset extends LaunchPresetCandidate {
  distance: number;
}

export interface LaunchStackCard {
  id: string;
  position: LaunchVector3;
  quaternion: LaunchQuaternion;
  locked: boolean;
  mass: number;
  dimensions: LaunchCardDimensions;
}

export interface LaunchStackOptions {
  maximumOrientationAngleDegrees?: number;
  minimumOverlapRatio?: number;
  minimumLayerDistance?: number;
  thicknessMultiplier?: number;
}

export interface MassImpulseShare {
  cardId: string;
  mass: number;
  fraction: number;
  impulseMagnitude: number;
}

export interface MassImpulseVectorShare extends MassImpulseShare {
  impulse: LaunchVector3;
}

export interface LaunchTarget {
  contactLocal: LaunchVector3;
  directionLocal: LaunchVector3;
  candidateIndex: number;
  valid: boolean;
}

const EPSILON = 1e-9;

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));

const dot = (a: LaunchVector3, b: LaunchVector3) =>
  a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

const subtract = (a: LaunchVector3, b: LaunchVector3): LaunchVector3 => [
  a[0] - b[0],
  a[1] - b[1],
  a[2] - b[2],
];

const normalizeVector = (value: LaunchVector3): LaunchVector3 => {
  const length = Math.hypot(value[0], value[1], value[2]);
  if (length <= EPSILON) return [0, 0, 0];
  return [value[0] / length, value[1] / length, value[2] / length];
};

const normalizeQuaternion = (value: LaunchQuaternion): LaunchQuaternion => {
  const length = Math.hypot(value[0], value[1], value[2], value[3]);
  if (length <= EPSILON) return [0, 0, 0, 1];
  return [
    value[0] / length,
    value[1] / length,
    value[2] / length,
    value[3] / length,
  ];
};

/**
 * Rotates a local vector by a card quaternion. The result is normalized so it
 * is safe to multiply directly by an impulse magnitude.
 */
export const quaternionToWorldDirection = (
  localDirection: LaunchVector3,
  quaternion: LaunchQuaternion,
): LaunchVector3 => {
  const [x, y, z, w] = normalizeQuaternion(quaternion);
  const [vx, vy, vz] = normalizeVector(localDirection);

  // q * v * inverse(q), expanded to avoid a runtime dependency on Three.js.
  const tx = 2 * (y * vz - z * vy);
  const ty = 2 * (z * vx - x * vz);
  const tz = 2 * (x * vy - y * vx);
  return normalizeVector([
    vx + w * tx + (y * tz - z * ty),
    vy + w * ty + (z * tx - x * tz),
    vz + w * tz + (x * ty - y * tx),
  ]);
};

export const localPointToWorld = (
  localPoint: LaunchVector3,
  position: LaunchVector3,
  quaternion: LaunchQuaternion,
): LaunchVector3 => {
  const rotated = quaternionToWorldVector(localPoint, quaternion);
  return [
    position[0] + rotated[0],
    position[1] + rotated[1],
    position[2] + rotated[2],
  ];
};

/**
 * Quaternion rotation which preserves vector length. Prefer
 * quaternionToWorldDirection for unit impulse directions.
 */
export const quaternionToWorldVector = (
  localVector: LaunchVector3,
  quaternion: LaunchQuaternion,
): LaunchVector3 => {
  const [x, y, z, w] = normalizeQuaternion(quaternion);
  const [vx, vy, vz] = localVector;
  const tx = 2 * (y * vz - z * vy);
  const ty = 2 * (z * vx - x * vz);
  const tz = 2 * (x * vy - y * vx);
  return [
    vx + w * tx + (y * tz - z * ty),
    vy + w * ty + (z * tx - x * tz),
    vz + w * tz + (x * ty - y * tx),
  ];
};

export const getLaunchPresetCandidates = (
  preset: LaunchPreset,
  dimensions: LaunchCardDimensions,
): LaunchPresetCandidate[] => {
  const halfWidth = Math.max(0, dimensions.width) / 2;
  const halfHeight = Math.max(0, dimensions.height) / 2;
  const halfThickness = Math.max(0, dimensions.thickness) / 2;
  const quarterHeight = halfHeight / 2;

  switch (preset) {
    case 'short-edge':
      return [
        { index: 0, contactPointLocal: [0, 0, halfHeight], directionLocal: [0, 0, -1] },
        { index: 1, contactPointLocal: [0, 0, -halfHeight], directionLocal: [0, 0, 1] },
      ];
    case 'long-edge-quarter':
      return [
        {
          index: 0,
          contactPointLocal: [halfWidth, 0, quarterHeight],
          directionLocal: [-1, 0, 0],
        },
        {
          index: 1,
          contactPointLocal: [halfWidth, 0, -quarterHeight],
          directionLocal: [-1, 0, 0],
        },
        {
          index: 2,
          contactPointLocal: [-halfWidth, 0, quarterHeight],
          directionLocal: [1, 0, 0],
        },
        {
          index: 3,
          contactPointLocal: [-halfWidth, 0, -quarterHeight],
          directionLocal: [1, 0, 0],
        },
      ];
    case 'card-back-half':
      return [
        {
          index: 0,
          contactPointLocal: [0, -halfThickness, quarterHeight],
          directionLocal: [0, 1, 0],
        },
        {
          index: 1,
          contactPointLocal: [0, -halfThickness, -quarterHeight],
          directionLocal: [0, 1, 0],
        },
      ];
  }
};

export const snapLaunchPresetContact = (
  preset: LaunchPreset,
  clickedPointLocal: LaunchVector3,
  dimensions: LaunchCardDimensions,
): SnappedLaunchPreset => {
  const candidates = getLaunchPresetCandidates(preset, dimensions);
  let best = candidates[0];
  let bestDistanceSquared = Number.POSITIVE_INFINITY;

  for (const candidate of candidates) {
    const delta = subtract(clickedPointLocal, candidate.contactPointLocal);
    const distanceSquared = dot(delta, delta);
    if (distanceSquared < bestDistanceSquared) {
      best = candidate;
      bestDistanceSquared = distanceSquared;
    }
  }

  return { ...best, distance: Math.sqrt(bestDistanceSquared) };
};

/**
 * Tests whether the pointer hit the blue back face (local -Y). The tolerance
 * deliberately scales with physical thickness so raycast round-off is accepted
 * without allowing front-face launches.
 */
export const isCardBackContact = (
  clickedPointLocal: LaunchVector3,
  dimensions: LaunchCardDimensions,
  tolerance = Math.max(0.004, Math.max(0, dimensions.thickness) * 0.2),
) => clickedPointLocal[1] <= -Math.max(0, dimensions.thickness) / 2 + Math.max(0, tolerance);

/**
 * UI-facing convenience wrapper: snaps a click to the selected preset and
 * carries the back-face validity rule with the result.
 */
export const resolveLaunchTarget = (
  preset: LaunchPreset,
  clickedPointLocal: LaunchVector3,
  dimensions: LaunchCardDimensions,
): LaunchTarget => {
  const snapped = snapLaunchPresetContact(preset, clickedPointLocal, dimensions);
  return {
    contactLocal: snapped.contactPointLocal,
    directionLocal: snapped.directionLocal,
    candidateIndex: snapped.index,
    valid: preset !== 'card-back-half'
      || isCardBackContact(clickedPointLocal, dimensions),
  };
};

export const worldDirectionFromQuaternion = quaternionToWorldDirection;

const getCardAxes = (card: LaunchStackCard) => ({
  x: quaternionToWorldDirection([1, 0, 0], card.quaternion),
  y: quaternionToWorldDirection([0, 1, 0], card.quaternion),
  z: quaternionToWorldDirection([0, 0, 1], card.quaternion),
});

const undirectedAngleDegrees = (a: LaunchVector3, b: LaunchVector3) =>
  Math.acos(clamp(Math.abs(dot(a, b)), -1, 1)) * 180 / Math.PI;

const getOrientationAngleDegrees = (a: LaunchStackCard, b: LaunchStackCard) => {
  const axesA = getCardAxes(a);
  const axesB = getCardAxes(b);
  return Math.max(
    undirectedAngleDegrees(axesA.x, axesB.x),
    undirectedAngleDegrees(axesA.y, axesB.y),
    undirectedAngleDegrees(axesA.z, axesB.z),
  );
};

type Point2 = [number, number];

const polygonArea = (polygon: Point2[]) => {
  let twiceArea = 0;
  for (let index = 0; index < polygon.length; index += 1) {
    const current = polygon[index];
    const next = polygon[(index + 1) % polygon.length];
    twiceArea += current[0] * next[1] - current[1] * next[0];
  }
  return Math.abs(twiceArea) / 2;
};

type ClipAxis = 0 | 1;

const clipPolygon = (
  polygon: Point2[],
  axis: ClipAxis,
  boundary: number,
  keepGreater: boolean,
) => {
  const output: Point2[] = [];
  if (polygon.length === 0) return output;
  const inside = (point: Point2) => (
    keepGreater ? point[axis] >= boundary - EPSILON : point[axis] <= boundary + EPSILON
  );

  let previous = polygon[polygon.length - 1];
  let previousInside = inside(previous);
  for (const current of polygon) {
    const currentInside = inside(current);
    if (currentInside !== previousInside) {
      const denominator = current[axis] - previous[axis];
      const amount = Math.abs(denominator) <= EPSILON
        ? 0
        : (boundary - previous[axis]) / denominator;
      output.push([
        previous[0] + (current[0] - previous[0]) * amount,
        previous[1] + (current[1] - previous[1]) * amount,
      ]);
    }
    if (currentInside) output.push(current);
    previous = current;
    previousInside = currentInside;
  }
  return output;
};

const projectCardCornersInto = (
  projectedCard: LaunchStackCard,
  referenceCard: LaunchStackCard,
): Point2[] => {
  const referenceAxes = getCardAxes(referenceCard);
  const halfWidth = Math.max(0, projectedCard.dimensions.width) / 2;
  const halfHeight = Math.max(0, projectedCard.dimensions.height) / 2;
  const corners: LaunchVector3[] = [
    [-halfWidth, 0, -halfHeight],
    [halfWidth, 0, -halfHeight],
    [halfWidth, 0, halfHeight],
    [-halfWidth, 0, halfHeight],
  ];
  return corners.map(corner => {
    const world = localPointToWorld(corner, projectedCard.position, projectedCard.quaternion);
    const delta = subtract(world, referenceCard.position);
    return [dot(delta, referenceAxes.x), dot(delta, referenceAxes.z)];
  });
};

const projectedOverlapRatio = (
  projectedCard: LaunchStackCard,
  referenceCard: LaunchStackCard,
) => {
  const halfWidth = Math.max(0, referenceCard.dimensions.width) / 2;
  const halfHeight = Math.max(0, referenceCard.dimensions.height) / 2;
  let polygon = projectCardCornersInto(projectedCard, referenceCard);
  const projectedArea = polygonArea(polygon);
  polygon = clipPolygon(polygon, 0, -halfWidth, true);
  polygon = clipPolygon(polygon, 0, halfWidth, false);
  polygon = clipPolygon(polygon, 1, -halfHeight, true);
  polygon = clipPolygon(polygon, 1, halfHeight, false);
  const referenceArea = Math.max(0, referenceCard.dimensions.width)
    * Math.max(0, referenceCard.dimensions.height);
  const denominator = Math.min(projectedArea, referenceArea);
  return denominator <= EPSILON ? 0 : clamp(polygonArea(polygon) / denominator, 0, 1);
};

export const areCardsStackNeighbors = (
  a: LaunchStackCard,
  b: LaunchStackCard,
  options: LaunchStackOptions = {},
) => {
  if (a.id === b.id || a.locked || b.locked) return false;
  const maximumOrientationAngleDegrees = options.maximumOrientationAngleDegrees ?? 8;
  if (getOrientationAngleDegrees(a, b) > maximumOrientationAngleDegrees) return false;

  const axesA = getCardAxes(a);
  const axesB = getCardAxes(b);
  const centerDelta = subtract(b.position, a.position);
  const layerDistance = Math.max(
    Math.abs(dot(centerDelta, axesA.y)),
    Math.abs(dot(centerDelta, axesB.y)),
  );
  const maximumLayerDistance = Math.max(
    options.minimumLayerDistance ?? 0.06,
    (options.thicknessMultiplier ?? 3)
      * Math.max(0, a.dimensions.thickness, b.dimensions.thickness),
  );
  if (layerDistance > maximumLayerDistance + EPSILON) return false;

  const overlapRatio = Math.min(
    projectedOverlapRatio(a, b),
    projectedOverlapRatio(b, a),
  );
  return overlapRatio + EPSILON >= (options.minimumOverlapRatio ?? 0.8);
};

/**
 * Returns the complete connected pile containing primaryCardId. Cards can be
 * chained one physical layer at a time; locked cards are never members.
 */
export const resolveLaunchStack = (
  cards: LaunchStackCard[],
  primaryCardId: string,
  options: LaunchStackOptions = {},
): LaunchStackCard[] => {
  const primary = cards.find(card => card.id === primaryCardId);
  if (!primary || primary.locked) return [];
  const included = new Set<string>([primary.id]);
  const queue = [primary];

  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const candidate of cards) {
      if (included.has(candidate.id)) continue;
      if (!areCardsStackNeighbors(current, candidate, options)) continue;
      included.add(candidate.id);
      queue.push(candidate);
    }
  }

  return cards.filter(card => included.has(card.id));
};

export const findStackedCardIds = (
  primaryCardId: string,
  cards: LaunchStackCard[],
  options: LaunchStackOptions = {},
) => resolveLaunchStack(cards, primaryCardId, options).map(card => card.id);

export const distributeImpulseMagnitudeByMass = (
  cards: Pick<LaunchStackCard, 'id' | 'mass'>[],
  totalImpulseMagnitude: number,
): MassImpulseShare[] => {
  const masses = cards.map(card => Number.isFinite(card.mass) ? Math.max(0, card.mass) : 0);
  const totalMass = masses.reduce((sum, mass) => sum + mass, 0);
  const safeMagnitude = Number.isFinite(totalImpulseMagnitude)
    ? Math.max(0, totalImpulseMagnitude)
    : 0;
  if (cards.length === 0 || totalMass <= EPSILON) return [];

  return cards.map((card, index) => {
    const fraction = masses[index] / totalMass;
    return {
      cardId: card.id,
      mass: masses[index],
      fraction,
      impulseMagnitude: safeMagnitude * fraction,
    };
  });
};

export const distributeImpulseVectorByMass = (
  cards: Pick<LaunchStackCard, 'id' | 'mass'>[],
  totalImpulse: LaunchVector3,
): MassImpulseVectorShare[] => {
  const magnitude = Math.hypot(totalImpulse[0], totalImpulse[1], totalImpulse[2]);
  const direction = normalizeVector(totalImpulse);
  return distributeImpulseMagnitudeByMass(cards, magnitude).map(share => ({
    ...share,
    impulse: [
      direction[0] * share.impulseMagnitude,
      direction[1] * share.impulseMagnitude,
      direction[2] * share.impulseMagnitude,
    ],
  }));
};

export const distributeImpulseByMass = (
  totalImpulseMagnitude: number,
  cards: Pick<LaunchStackCard, 'id' | 'mass'>[],
) => distributeImpulseMagnitudeByMass(cards, totalImpulseMagnitude);
