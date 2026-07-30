import type { RapierRigidBody } from '@react-three/rapier';
import type { LaunchPhysicsSnapshot } from '../types';

export type PhysicsVector3 = [number, number, number];
export type PhysicsQuaternion = [number, number, number, number];

export type CardPhysicsSnapshot = LaunchPhysicsSnapshot;

export interface CardPhysicsHandle {
  setEnabled: (enabled: boolean) => void;
  setLocked: (locked: boolean) => void;
  setTransform: (position: PhysicsVector3, rotation: PhysicsQuaternion) => void;
  setVelocity: (linear: PhysicsVector3, angular?: PhysicsVector3) => void;
  wakeUp: () => void;
  sleep: () => void;
  applyForceAtPoint: (force: PhysicsVector3, point: PhysicsVector3) => void;
  applyImpulseAtPoint: (impulse: PhysicsVector3, point: PhysicsVector3) => void;
  getSnapshot: () => CardPhysicsSnapshot;
}

export const createRapierCardPhysicsHandle = (
  body: RapierRigidBody,
  setLockedBodyType: (locked: boolean) => void,
): CardPhysicsHandle => ({
  setEnabled: enabled => body.setEnabled(enabled),
  setLocked: setLockedBodyType,
  setTransform: (position, rotation) => {
    body.setTranslation({ x: position[0], y: position[1], z: position[2] }, false);
    body.setRotation(
      { x: rotation[0], y: rotation[1], z: rotation[2], w: rotation[3] },
      false,
    );
  },
  setVelocity: (linear, angular = [0, 0, 0]) => {
    body.setLinvel({ x: linear[0], y: linear[1], z: linear[2] }, false);
    body.setAngvel({ x: angular[0], y: angular[1], z: angular[2] }, false);
  },
  wakeUp: () => body.wakeUp(),
  sleep: () => body.sleep(),
  applyForceAtPoint: (force, point) => body.addForceAtPoint(
    { x: force[0], y: force[1], z: force[2] },
    { x: point[0], y: point[1], z: point[2] },
    true,
  ),
  applyImpulseAtPoint: (impulse, point) => body.applyImpulseAtPoint(
    { x: impulse[0], y: impulse[1], z: impulse[2] },
    { x: point[0], y: point[1], z: point[2] },
    true,
  ),
  getSnapshot: () => snapshotRapierBody(body),
});

export const snapshotRapierBody = (body: RapierRigidBody): CardPhysicsSnapshot => {
  const position = body.translation();
  const quaternion = body.rotation();
  const linearVelocity = body.linvel();
  const angularVelocity = body.angvel();
  return {
    position: [position.x, position.y, position.z],
    rotation: [0, 0, 0],
    quaternion: [quaternion.x, quaternion.y, quaternion.z, quaternion.w],
    linearVelocity: [linearVelocity.x, linearVelocity.y, linearVelocity.z],
    angularVelocity: [angularVelocity.x, angularVelocity.y, angularVelocity.z],
    sleeping: body.isSleeping(),
  };
};
