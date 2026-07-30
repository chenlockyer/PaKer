import type { RapierRigidBody } from '@react-three/rapier';
import type { LiveCardTransform } from '../types';

export type PhysicsVector3 = [number, number, number];
export type PhysicsQuaternion = [number, number, number, number];

export interface CardPhysicsSnapshot extends LiveCardTransform {
  quaternion: PhysicsQuaternion;
  linearVelocity: PhysicsVector3;
  angularVelocity: PhysicsVector3;
  sleeping: boolean;
}

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
