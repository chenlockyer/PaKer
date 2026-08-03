import * as THREE from 'three';

export type GhostSnapType = 'center' | 'edge';
export type GhostSnapTargetType = 'point' | 'axis' | 'edge-line';

export interface GhostPlacementResult {
  position: [number, number, number];
  valid: boolean;
  snapped: boolean;
  snapType?: GhostSnapType;
}

export interface GhostSnapAnchor {
  id: string;
  type: GhostSnapType;
  position: THREE.Vector3;
}

export interface GhostSnapSegment {
  id: string;
  type: 'axis' | 'edge-line';
  start: THREE.Vector3;
  end: THREE.Vector3;
}

export interface GhostSnapCandidate {
  targetId: string;
  targetFeatureId: string;
  targetType: GhostSnapTargetType;
  ghostAnchorId: string;
  type: GhostSnapType;
  position: THREE.Vector3;
  ghostAnchorLocal: THREE.Vector3;
  targetPointWorld: THREE.Vector3;
  targetSegmentWorld?: [THREE.Vector3, THREE.Vector3];
  distance: number;
  separation: number;
}

export interface GhostSnapLatch {
  targetId: string;
  targetFeatureId: string;
  targetType: GhostSnapTargetType;
  ghostAnchorId: string;
}

export const createGhostSnapAnchors = (width: number, height: number): GhostSnapAnchor[] => {
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  return [
    { id: 'center', type: 'center', position: new THREE.Vector3(0, 0, 0) },
    { id: 'left', type: 'edge', position: new THREE.Vector3(-halfWidth, 0, 0) },
    { id: 'right', type: 'edge', position: new THREE.Vector3(halfWidth, 0, 0) },
    { id: 'top', type: 'edge', position: new THREE.Vector3(0, 0, -halfHeight) },
    { id: 'bottom', type: 'edge', position: new THREE.Vector3(0, 0, halfHeight) },
  ];
};

export const createGhostSnapSegments = (width: number, height: number): GhostSnapSegment[] => {
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  return [
    {
      id: 'axis-horizontal',
      type: 'axis',
      start: new THREE.Vector3(-halfWidth, 0, 0),
      end: new THREE.Vector3(halfWidth, 0, 0),
    },
    {
      id: 'axis-vertical',
      type: 'axis',
      start: new THREE.Vector3(0, 0, -halfHeight),
      end: new THREE.Vector3(0, 0, halfHeight),
    },
    {
      id: 'edge-left',
      type: 'edge-line',
      start: new THREE.Vector3(-halfWidth, 0, -halfHeight),
      end: new THREE.Vector3(-halfWidth, 0, halfHeight),
    },
    {
      id: 'edge-right',
      type: 'edge-line',
      start: new THREE.Vector3(halfWidth, 0, -halfHeight),
      end: new THREE.Vector3(halfWidth, 0, halfHeight),
    },
    {
      id: 'edge-top',
      type: 'edge-line',
      start: new THREE.Vector3(-halfWidth, 0, -halfHeight),
      end: new THREE.Vector3(halfWidth, 0, -halfHeight),
    },
    {
      id: 'edge-bottom',
      type: 'edge-line',
      start: new THREE.Vector3(-halfWidth, 0, halfHeight),
      end: new THREE.Vector3(halfWidth, 0, halfHeight),
    },
  ];
};

const closestPointOnSegment = (
  point: THREE.Vector3,
  start: THREE.Vector3,
  end: THREE.Vector3,
) => {
  const segment = end.clone().sub(start);
  const lengthSquared = segment.lengthSq();
  if (lengthSquared <= Number.EPSILON) return start.clone();
  const amount = THREE.MathUtils.clamp(point.clone().sub(start).dot(segment) / lengthSquared, 0, 1);
  return start.clone().addScaledVector(segment, amount);
};

const isSameLatch = (candidate: GhostSnapCandidate, latch: GhostSnapLatch | null) => Boolean(
  latch &&
  latch.targetId === candidate.targetId &&
  latch.targetFeatureId === candidate.targetFeatureId &&
  latch.targetType === candidate.targetType &&
  latch.ghostAnchorId === candidate.ghostAnchorId
);

const isBetterCandidate = (
  candidate: GhostSnapCandidate,
  best: GhostSnapCandidate | null,
  latch: GhostSnapLatch | null,
) => {
  if (!best) return true;
  const epsilon = 0.000001;
  if (candidate.distance < best.distance - epsilon) return true;
  if (candidate.distance > best.distance + epsilon) return false;

  const candidateLatched = isSameLatch(candidate, latch);
  const bestLatched = isSameLatch(best, latch);
  if (candidateLatched !== bestLatched) return candidateLatched;

  const candidateIsPoint = candidate.targetType === 'point';
  const bestIsPoint = best.targetType === 'point';
  if (candidateIsPoint !== bestIsPoint) return candidateIsPoint;
  return candidate.separation > best.separation;
};

export const resolveGhostSnap = ({
  basePosition,
  ghostQuaternion,
  target,
  anchors,
  segments,
  enterDistance,
  releaseDistance,
  latch,
  horizontalOnly = false,
}: {
  basePosition: THREE.Vector3;
  ghostQuaternion: THREE.Quaternion;
  target: THREE.Object3D;
  anchors: GhostSnapAnchor[];
  segments: GhostSnapSegment[];
  enterDistance: number;
  releaseDistance: number;
  latch: GhostSnapLatch | null;
  horizontalOnly?: boolean;
}): GhostSnapCandidate | null => {
  target.updateWorldMatrix(true, false);
  const targetId = target.uuid;
  const targetOrigin = target.getWorldPosition(new THREE.Vector3());
  let best: GhostSnapCandidate | null = null;

  const consider = (candidate: GhostSnapCandidate) => {
    const threshold = isSameLatch(candidate, latch) ? releaseDistance : enterDistance;
    if (candidate.distance > threshold) return;
    if (isBetterCandidate(candidate, best, latch)) best = candidate;
  };

  // Preserve exact center-to-center and edge-midpoint-to-edge-midpoint snapping.
  for (const targetAnchor of anchors) {
    for (const ghostAnchor of anchors) {
      if (targetAnchor.type !== ghostAnchor.type) continue;
      const targetPointWorld = target.localToWorld(targetAnchor.position.clone());
      const ghostOffset = ghostAnchor.position.clone().applyQuaternion(ghostQuaternion);
      const ghostPointAtBase = basePosition.clone().add(ghostOffset);
      const effectiveTargetPoint = targetPointWorld.clone();
      if (horizontalOnly) effectiveTargetPoint.y = ghostPointAtBase.y;
      const position = effectiveTargetPoint.clone().sub(ghostOffset);
      if (horizontalOnly) position.y = basePosition.y;
      consider({
        targetId,
        targetFeatureId: targetAnchor.id,
        targetType: 'point',
        ghostAnchorId: ghostAnchor.id,
        type: ghostAnchor.type,
        position,
        ghostAnchorLocal: ghostAnchor.position.clone(),
        targetPointWorld: effectiveTargetPoint.clone(),
        distance: position.distanceTo(basePosition),
        separation: position.distanceToSquared(targetOrigin),
      });
    }
  }

  // Every ghost anchor may snap to the nearest point of every finite target segment.
  for (const segment of segments) {
    const startWorld = target.localToWorld(segment.start.clone());
    const endWorld = target.localToWorld(segment.end.clone());
    for (const ghostAnchor of anchors) {
      const ghostOffset = ghostAnchor.position.clone().applyQuaternion(ghostQuaternion);
      const ghostPointAtBase = basePosition.clone().add(ghostOffset);
      const effectiveStart = startWorld.clone();
      const effectiveEnd = endWorld.clone();
      if (horizontalOnly) {
        effectiveStart.y = ghostPointAtBase.y;
        effectiveEnd.y = ghostPointAtBase.y;
      }
      const targetPointWorld = closestPointOnSegment(ghostPointAtBase, effectiveStart, effectiveEnd);
      const position = targetPointWorld.clone().sub(ghostOffset);
      if (horizontalOnly) position.y = basePosition.y;
      consider({
        targetId,
        targetFeatureId: segment.id,
        targetType: segment.type,
        ghostAnchorId: ghostAnchor.id,
        type: ghostAnchor.type,
        position,
        ghostAnchorLocal: ghostAnchor.position.clone(),
        targetPointWorld,
        targetSegmentWorld: [startWorld.clone(), endWorld.clone()],
        distance: position.distanceTo(basePosition),
        separation: position.distanceToSquared(targetOrigin),
      });
    }
  }

  return best;
};
