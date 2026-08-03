import * as THREE from 'three';

export type GhostSnapType = 'center' | 'edge';

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

export interface GhostSnapCandidate {
  targetId: string;
  targetAnchorId: string;
  ghostAnchorId: string;
  type: GhostSnapType;
  position: THREE.Vector3;
  ghostAnchorLocal: THREE.Vector3;
  distance: number;
  separation: number;
}

export interface GhostSnapLatch {
  targetId: string;
  targetAnchorId: string;
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
    { id: 'top-left', type: 'edge', position: new THREE.Vector3(-halfWidth, 0, -halfHeight) },
    { id: 'top-right', type: 'edge', position: new THREE.Vector3(halfWidth, 0, -halfHeight) },
    { id: 'bottom-left', type: 'edge', position: new THREE.Vector3(-halfWidth, 0, halfHeight) },
    { id: 'bottom-right', type: 'edge', position: new THREE.Vector3(halfWidth, 0, halfHeight) },
  ];
};

export const resolveGhostSnap = ({
  basePosition,
  ghostQuaternion,
  target,
  anchors,
  enterDistance,
  releaseDistance,
  latch,
}: {
  basePosition: THREE.Vector3;
  ghostQuaternion: THREE.Quaternion;
  target: THREE.Object3D;
  anchors: GhostSnapAnchor[];
  enterDistance: number;
  releaseDistance: number;
  latch: GhostSnapLatch | null;
}): GhostSnapCandidate | null => {
  target.updateWorldMatrix(true, false);
  const targetId = target.uuid;
  const targetOrigin = target.getWorldPosition(new THREE.Vector3());
  let best: GhostSnapCandidate | null = null;

  for (const targetAnchor of anchors) {
    for (const ghostAnchor of anchors) {
      if (targetAnchor.type !== ghostAnchor.type) continue;
      const targetWorld = target.localToWorld(targetAnchor.position.clone());
      const ghostOffset = ghostAnchor.position.clone().applyQuaternion(ghostQuaternion);
      const position = targetWorld.sub(ghostOffset);
      const distance = position.distanceTo(basePosition);
      const separation = position.distanceToSquared(targetOrigin);
      const isLatched = Boolean(
        latch &&
        latch.targetId === targetId &&
        latch.targetAnchorId === targetAnchor.id &&
        latch.ghostAnchorId === ghostAnchor.id,
      );
      const threshold = isLatched ? releaseDistance : enterDistance;
      if (distance > threshold) continue;
      if (
        best &&
        !isLatched &&
        (best.distance < distance - 0.000001 ||
          (Math.abs(best.distance - distance) <= 0.000001 && best.separation >= separation))
      ) continue;

      best = {
        targetId,
        targetAnchorId: targetAnchor.id,
        ghostAnchorId: ghostAnchor.id,
        type: targetAnchor.type,
        position,
        ghostAnchorLocal: ghostAnchor.position.clone(),
        distance,
        separation,
      };
      if (isLatched) return best;
    }
  }

  return best;
};
