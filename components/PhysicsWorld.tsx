/// <reference lib="dom" />
import React, { useState, useRef, useEffect, useLayoutEffect, useMemo, useCallback } from 'react';
import {
  BallCollider,
  CoefficientCombineRule,
  CuboidCollider,
  Physics,
  RigidBody,
  useBeforePhysicsStep,
  useRapier,
  type RapierCollider,
} from '@react-three/rapier';
import { useThree, useFrame, ThreeElements } from '@react-three/fiber';
import { Line, TransformControls } from '@react-three/drei';
import * as THREE from 'three';
import Card from './Card';
import BlueprintProjection from './BlueprintProjection';
import {
  BlueprintGuideProgress,
  BlueprintGuideState,
  CARD_DIMENSIONS,
  CardLaunchRequest,
  CardData,
  CardSize,
  LaunchMemberRecord,
  LaunchPreset,
  LaunchRecord,
  LaunchTerminationReason,
  LiveCardTransform,
  RotationPreset,
  InteractionMode,
  PointerMode,
  PhysicsSettings,
} from '../types';
import { ChallengeTestType } from '../types';
import type { PlacementGuard } from '../types';
import { playPlaceSound } from '../services/audioService';
import {
  InputAction,
  InputActionEvent,
  useInputAction,
} from '../input/InputContext';
import type { CardPhysicsHandle } from '../physics/cardPhysics';
import {
  findStackedCardIds,
  getLaunchPresetCandidates,
  localPointToWorld,
  quaternionToWorldVector,
  resolveLaunchTargetSpeed,
  worldDirectionFromQuaternion,
} from '../physics/launchGesture';
import { resolveLaunchActuatorStep } from '../physics/launchActuator';
import {
  createGhostSnapAnchors,
  createGhostSnapSegments,
  resolveGhostSnap,
  type GhostSnapLatch,
  type GhostSnapType,
} from '../physics/ghostPlacement';

const useRepeatingInputAction = (
  action: InputAction,
  callback: (event: InputActionEvent) => void,
) => {
  const delayRef = useRef<number | null>(null);
  const intervalRef = useRef<number | null>(null);

  const stop = () => {
    if (delayRef.current !== null) window.clearTimeout(delayRef.current);
    if (intervalRef.current !== null) window.clearInterval(intervalRef.current);
    delayRef.current = null;
    intervalRef.current = null;
  };

  useInputAction(action, event => {
    if (event.phase === 'up') {
      stop();
      return;
    }
    callback(event);
    stop();
    delayRef.current = window.setTimeout(() => {
      intervalRef.current = window.setInterval(() => callback(event), 50);
    }, 220);
  });

  useEffect(() => stop, []);
};

interface PhysicsWorldProps {
  rotationPreset: RotationPreset;
  interactionMode: InteractionMode;
  pointerMode: PointerMode;
  launchPreset: LaunchPreset;
  isFreezeMode: boolean;
  cards: CardData[];
  addCard: (card: CardData) => void;
  removeCard: (id: string) => void;
  interactionEnabled: boolean;
  placementEnabled: boolean;
  windStrength: number;
  onHeightChange: (height: number) => void;
  showTargetGuide: boolean;
  targetHeight: number;
  cardSize: CardSize;
  testType: ChallengeTestType;
  testActive: boolean;
  weightMass: number;
  weightDropHeight: number;
  physicsSettings: PhysicsSettings;
  onCardTransformChange: (id: string, transform: LiveCardTransform) => void;
  onCardLaunch: (record: LaunchRecord) => void;
  blueprintGuide: BlueprintGuideState | null;
  onBlueprintPlaceOrigin: (origin: [number, number, number]) => void;
  onBlueprintProgress: (progress: BlueprintGuideProgress) => void;
  onBlueprintStepComplete: (playerCardIds: string[]) => void;
  onBlueprintStepRegression: (stepIndex: number) => void;
  /** Battle mode: reject placements outside the active build zone. */
  placementGuard?: PlacementGuard;
  /** Battle mode: report why a ghost pose is refused so the HUD can explain. */
  onPlacementStatus?: (status: { ok: boolean; reason?: string } | null) => void;
  /** Battle mode: only the active side's loaded ammo may be fired. */
  canLaunchCard?: (card: CardData) => boolean;
}

interface ActiveLaunchMember {
  cardId: string;
  handle: CardPhysicsHandle;
  mass: number;
  contactPointLocal: [number, number, number];
  contactPointWorld: [number, number, number];
  directionWorld: [number, number, number];
  cumulativeImpulse: [number, number, number];
  snapshotBefore: LaunchMemberRecord['snapshotBefore'];
}

interface ActiveLaunchSession {
  intent: LaunchRecord['intent'];
  directionLocal: [number, number, number];
  members: ActiveLaunchMember[];
  totalMass: number;
  actualStroke: number;
  durationMs: number;
  totalImpulseMagnitude: number;
  workUsed: number;
  workLimit: number;
  maximumActuationMs: number;
  lastPrimaryContactWorld: [number, number, number];
  createdAt: number;
}

interface LaunchActuatorControllerProps {
  sessionsRef: React.MutableRefObject<Map<string, ActiveLaunchSession>>;
  busyCardIdsRef: React.MutableRefObject<Set<string>>;
  physicsHandlesRef: React.MutableRefObject<Map<string, CardPhysicsHandle>>;
  cardsRef: React.MutableRefObject<CardData[]>;
  onCardLaunch: (record: LaunchRecord) => void;
}

const dotVector = (left: [number, number, number], right: [number, number, number]) => (
  left[0] * right[0] + left[1] * right[1] + left[2] * right[2]
);

const finishLaunchSession = (
  session: ActiveLaunchSession,
  reason: LaunchTerminationReason,
  onCardLaunch: (record: LaunchRecord) => void,
) => {
  const members: LaunchMemberRecord[] = session.members.map(member => {
    let snapshotAfter = member.snapshotBefore;
    try {
      snapshotAfter = member.handle.getSnapshot();
    } catch {
      // A removed rigid-body keeps its last valid launch snapshot in the record.
    }
    return {
      cardId: member.cardId,
      contactPointLocal: [...member.contactPointLocal],
      contactPointWorld: [...member.contactPointWorld],
      directionWorld: [...member.directionWorld],
      impulse: [...member.cumulativeImpulse],
      snapshotBefore: member.snapshotBefore,
      snapshotAfter,
    };
  });
  onCardLaunch({
    intent: session.intent,
    members,
    totalImpulseMagnitude: session.totalImpulseMagnitude,
    actualStroke: session.actualStroke,
    durationMs: session.durationMs,
    terminationReason: reason,
    createdAt: session.createdAt,
  });
};

const LaunchActuatorController: React.FC<LaunchActuatorControllerProps> = ({
  sessionsRef,
  busyCardIdsRef,
  physicsHandlesRef,
  cardsRef,
  onCardLaunch,
}) => {
  useBeforePhysicsStep(() => {
    const fixedDeltaTime = 1 / 60;
    const lockedIds = new Set(cardsRef.current.filter(card => card.locked).map(card => card.id));

    for (const [sequenceId, session] of sessionsRef.current) {
      const primary = session.members.find(member => member.cardId === session.intent.primaryCardId);
      const invalid = !primary || session.members.some(member => (
        !physicsHandlesRef.current.has(member.cardId) || lockedIds.has(member.cardId)
      ));

      const complete = (reason: LaunchTerminationReason) => {
        finishLaunchSession(session, reason, onCardLaunch);
        sessionsRef.current.delete(sequenceId);
        session.members.forEach(member => busyCardIdsRef.current.delete(member.cardId));
      };

      if (invalid || !primary) {
        complete('invalid-member');
        continue;
      }

      const primarySnapshot = primary.handle.getSnapshot();
      const directionWorld = worldDirectionFromQuaternion(
        session.directionLocal,
        primarySnapshot.quaternion,
      );
      const primaryContactWorld = localPointToWorld(
        primary.contactPointLocal,
        primarySnapshot.position,
        primarySnapshot.quaternion,
      );
      const strokeStep = Math.max(0, dotVector([
        primaryContactWorld[0] - session.lastPrimaryContactWorld[0],
        primaryContactWorld[1] - session.lastPrimaryContactWorld[1],
        primaryContactWorld[2] - session.lastPrimaryContactWorld[2],
      ], directionWorld));
      session.actualStroke += strokeStep;
      session.lastPrimaryContactWorld = primaryContactWorld;

      if (session.actualStroke >= session.intent.strokeLimit) {
        complete('stroke-complete');
        continue;
      }
      if (session.durationMs >= session.maximumActuationMs) {
        complete('time-limit');
        continue;
      }
      if (session.workUsed >= session.workLimit - 1e-6) {
        complete('stroke-complete');
        continue;
      }

      let weightedForwardSpeed = 0;
      for (const member of session.members) {
        const snapshot = member.handle.getSnapshot();
        weightedForwardSpeed += dotVector(snapshot.linearVelocity, directionWorld) * member.mass;
      }
      const groupForwardSpeed = weightedForwardSpeed / session.totalMass;
      const step = resolveLaunchActuatorStep({
        totalMass: session.totalMass,
        forwardSpeed: groupForwardSpeed,
        targetSpeed: session.intent.targetSpeed,
        maximumForce: session.intent.forceLimit,
        deltaTime: fixedDeltaTime,
        remainingWork: session.workLimit - session.workUsed,
      });
      if (step.impulseMagnitude <= 0) {
        complete('target-speed');
        continue;
      }

      for (const member of session.members) {
        const snapshot = member.handle.getSnapshot();
        const contactPointWorld = localPointToWorld(
          member.contactPointLocal,
          snapshot.position,
          snapshot.quaternion,
        );
        const share = step.impulseMagnitude * member.mass / session.totalMass;
        const impulse: [number, number, number] = [
          directionWorld[0] * share,
          directionWorld[1] * share,
          directionWorld[2] * share,
        ];
        member.handle.wakeUp();
        member.handle.applyImpulseAtPoint(impulse, contactPointWorld);
        member.contactPointWorld = contactPointWorld;
        member.directionWorld = directionWorld;
        member.cumulativeImpulse = [
          member.cumulativeImpulse[0] + impulse[0],
          member.cumulativeImpulse[1] + impulse[1],
          member.cumulativeImpulse[2] + impulse[2],
        ];
      }
      session.totalImpulseMagnitude += step.impulseMagnitude;
      session.workUsed += step.workApplied;
      session.durationMs += fixedDeltaTime * 1000;
    }
  });

  return null;
};

const WindVisual = ({ strength }: { strength: number }) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const transform = useMemo(() => new THREE.Object3D(), []);
  const streaks = useMemo(
    () => Array.from({ length: 32 }, () => ({
      x: -12 + Math.random() * 24,
      y: 0.4 + Math.random() * 7,
      z: -7 + Math.random() * 14,
      speed: 6 + Math.random() * 5,
      length: 0.6 + Math.random() * 1.4,
    })),
    []
  );

  useEffect(() => {
    if (meshRef.current) {
      meshRef.current.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    }
  }, []);

  useFrame((_, delta) => {
    const mesh = meshRef.current;
    if (!mesh) return;

    streaks.forEach((streak, index) => {
      streak.x += streak.speed * delta * Math.max(0.6, strength * 10);
      if (streak.x > 12) streak.x = -12;
      transform.position.set(streak.x, streak.y, streak.z);
      transform.scale.set(streak.length, 0.025, 0.025);
      transform.updateMatrix();
      mesh.setMatrixAt(index, transform.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, streaks.length]} frustumCulled={false}>
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial color="#67e8f9" transparent opacity={0.42} depthWrite={false} />
    </instancedMesh>
  );
};

const TargetHeightGuide = ({ height }: { height: number }) => (
  <mesh position={[0, height, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={2}>
    <ringGeometry args={[3.85, 4, 64]} />
    <meshBasicMaterial
      color="#fbbf24"
      transparent
      opacity={0.38}
      side={THREE.DoubleSide}
      depthWrite={false}
    />
  </mesh>
);

const TestWeight = ({ mass, dropHeight }: { mass: number; dropHeight: number }) => {
  const radius = 0.36;

  return (
    <RigidBody
      type="dynamic"
      colliders={false}
      position={[0, dropHeight, 0]}
      linearDamping={0.02}
      angularDamping={0.1}
      ccd
    >
      <BallCollider args={[radius]} mass={mass} friction={0.65} restitution={0.05} />
      <mesh castShadow>
        <sphereGeometry args={[radius, 24, 16]} />
        <meshStandardMaterial color="#f97316" metalness={0.55} roughness={0.3} />
      </mesh>
    </RigidBody>
  );
};

const WeightDropPreview = ({ dropHeight }: { dropHeight: number }) => (
  <group>
    <mesh position={[0, dropHeight, 0]}>
      <sphereGeometry args={[0.36, 20, 12]} />
      <meshBasicMaterial color="#fb923c" wireframe transparent opacity={0.65} />
    </mesh>
    <mesh position={[0, dropHeight / 2, 0]}>
      <cylinderGeometry args={[0.012, 0.012, dropHeight, 8]} />
      <meshBasicMaterial color="#fb923c" transparent opacity={0.28} depthWrite={false} />
    </mesh>
    <mesh position={[0, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.42, 0.5, 32]} />
      <meshBasicMaterial color="#fb923c" transparent opacity={0.7} side={THREE.DoubleSide} />
    </mesh>
  </group>
);

// The Floor component
const Floor = ({
  meshRef,
  cardSize,
  friction,
}: {
  meshRef: React.RefObject<THREE.Mesh>;
  cardSize: CardSize;
  friction: number;
}) => {
  const colliderRef = useRef<RapierCollider>(null);
  const gridCellSize = CARD_DIMENSIONS[cardSize].width / 2;
  const gridDivisions = 100;
  const gridSize = gridCellSize * gridDivisions;
  const gridColor = 0x8492a3;

  useEffect(() => {
    colliderRef.current?.setFriction(friction);
  }, [friction]);

  return (
    <RigidBody type="fixed" colliders={false}>
      <CuboidCollider
        ref={colliderRef}
        args={[50, 0.05, 50]}
        position={[0, -0.05, 0]}
        friction={friction}
        frictionCombineRule={CoefficientCombineRule.Multiply}
        restitution={0}
      />
      <mesh ref={meshRef} name="placement-floor" receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[100, 100]} />
        <shadowMaterial opacity={0.3} />
        <gridHelper
          args={[gridSize, gridDivisions, gridColor, gridColor]}
          rotation={[-Math.PI / 2, 0, 0]}
        />
      </mesh>
    </RigidBody>
  );
};

const RapierWorldSettings = () => {
  const { world } = useRapier();
  useEffect(() => {
    world.integrationParameters.maxCcdSubsteps = 2;
  }, [world]);
  return null;
};

// The Ghost Card follows the mouse to show where a card will be placed
const GhostCard = ({ 
  rotationPreset, 
  isFreezeMode,
  onPlace,
  floorRef,
  cardsGroupRef,
  cardSize,
  placementGuard,
  onPlacementStatus,
}: { 
  rotationPreset: RotationPreset; 
  isFreezeMode: boolean;
  onPlace: (pos: THREE.Vector3, rot: THREE.Euler) => void;
  floorRef: React.RefObject<THREE.Mesh>;
  cardsGroupRef: React.RefObject<THREE.Group>;
  cardSize: CardSize;
  placementGuard?: PlacementGuard;
  onPlacementStatus?: (status: { ok: boolean; reason?: string } | null) => void;
}) => {
  const { camera, raycaster } = useThree();
  const { world, rapier } = useRapier();
  const meshRef = useRef<THREE.Mesh>(null);
  const lastPointerRef = useRef(new THREE.Vector2(Number.NaN, Number.NaN));
  const lastCameraPositionRef = useRef(new THREE.Vector3(Number.NaN, Number.NaN, Number.NaN));
  const lastCameraQuaternionRef = useRef(new THREE.Quaternion(Number.NaN, Number.NaN, Number.NaN, Number.NaN));
  const lastRaycastTimeRef = useRef(Number.NEGATIVE_INFINITY);
  const rotationDirtyRef = useRef(true);
  const heightLockRef = useRef({ active: false, height: 0 });
  const heightLockPlaneRef = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0));
  const heightLockPointRef = useRef(new THREE.Vector3());
  const [isHeightLocked, setIsHeightLocked] = useState(false);
  const snapHeldRef = useRef(false);
  const [isSnapHeld, setIsSnapHeld] = useState(false);
  const snapLatchRef = useRef<GhostSnapLatch | null>(null);
  const placementValidRef = useRef(true);
  const placementStatusRef = useRef<string | null>(null);
  const [placementVisual, setPlacementVisual] = useState<{
    valid: boolean;
    snapped: boolean;
    snapType?: GhostSnapType;
    anchor?: [number, number, number];
    targetLine?: [[number, number, number], [number, number, number]];
  }>({ valid: true, snapped: false });
  const dimensions = CARD_DIMENSIONS[cardSize];
  const snapAnchors = useMemo(
    () => createGhostSnapAnchors(dimensions.width, dimensions.height),
    [dimensions.height, dimensions.width],
  );
  const snapSegments = useMemo(
    () => createGhostSnapSegments(dimensions.width, dimensions.height),
    [dimensions.height, dimensions.width],
  );
  const ghostShape = useMemo(
    () => new rapier.Cuboid(
      dimensions.width / 2,
      dimensions.thickness / 2,
      dimensions.height / 2,
    ),
    [dimensions.height, dimensions.thickness, dimensions.width, rapier],
  );
  
  // Manual adjustment is stored as a quaternion in world space. Keeping
  // three Euler offsets would make later key presses depend on rotation
  // order, which causes the controls to drift away from the scene axes.
  const [manualRotation, setManualRotation] = useState<[number, number, number, number]>([0, 0, 0, 1]);

  const guideGeometry = useMemo(() => {
    const halfWidth = dimensions.width / 2;
    const halfHeight = dimensions.height / 2;
    const points = [
      new THREE.Vector3(-halfWidth, 0, 0),
      new THREE.Vector3(halfWidth, 0, 0),
      new THREE.Vector3(0, 0, -halfHeight),
      new THREE.Vector3(0, 0, halfHeight),
      new THREE.Vector3(-halfWidth, 0, -halfHeight),
      new THREE.Vector3(halfWidth, 0, halfHeight),
      new THREE.Vector3(-halfWidth, 0, halfHeight),
      new THREE.Vector3(halfWidth, 0, -halfHeight),
    ];
    return new THREE.BufferGeometry().setFromPoints(points);
  }, [dimensions.height, dimensions.width]);

  useEffect(() => () => guideGeometry.dispose(), [guideGeometry]);

  // Track mouse down position to distinguish between Click and Drag (Camera Orbit)
  const clickStartRef = useRef<{x: number, y: number} | null>(null);

  const rotationStep = (event: InputActionEvent) =>
    THREE.MathUtils.degToRad(event.originalEvent.altKey ? 45 : event.originalEvent.ctrlKey ? 1 : 10);

  const applyWorldRotation = (axis: THREE.Vector3, angle: number) => {
    setManualRotation(previous => {
      const current = new THREE.Quaternion(...previous);
      const delta = new THREE.Quaternion().setFromAxisAngle(axis, angle);
      delta.multiply(current).normalize();
      return [delta.x, delta.y, delta.z, delta.w];
    });
  };

  useRepeatingInputAction('card.yawLeft', event => {
    applyWorldRotation(new THREE.Vector3(0, 1, 0), rotationStep(event));
  });
  useRepeatingInputAction('card.yawRight', event => {
    applyWorldRotation(new THREE.Vector3(0, 1, 0), -rotationStep(event));
  });
  useRepeatingInputAction('card.tiltForward', event => {
    applyWorldRotation(new THREE.Vector3(1, 0, 0), -rotationStep(event));
  });
  useRepeatingInputAction('card.tiltBackward', event => {
    applyWorldRotation(new THREE.Vector3(1, 0, 0), rotationStep(event));
  });
  useRepeatingInputAction('card.tiltLeft', event => {
    applyWorldRotation(new THREE.Vector3(0, 0, 1), -rotationStep(event));
  });
  useRepeatingInputAction('card.tiltRight', event => {
    applyWorldRotation(new THREE.Vector3(0, 0, 1), rotationStep(event));
  });

  useInputAction('card.resetRotation', event => {
    if (event.phase !== 'down') return;
    setManualRotation([0, 0, 0, 1]);
  });

  useInputAction('card.lockHeight', event => {
    if (event.phase === 'down' && meshRef.current && !heightLockRef.current.active) {
      heightLockRef.current = {
        active: true,
        height: meshRef.current.position.y,
      };
      setIsHeightLocked(true);
      return;
    }
    if (event.phase === 'up') {
      heightLockRef.current.active = false;
      setIsHeightLocked(false);
    }
  });

  useInputAction('card.snap', event => {
    snapHeldRef.current = event.phase === 'down';
    setIsSnapHeld(event.phase === 'down');
    if (event.phase === 'up') snapLatchRef.current = null;
    rotationDirtyRef.current = true;
  });

  const resolveCollisions = useCallback((
    startPosition: THREE.Vector3,
    quaternion: THREE.Quaternion,
    lockHeight: boolean,
  ) => {
    const position = startPosition.clone();
    const start = startPosition.clone();
    const rotation = { x: quaternion.x, y: quaternion.y, z: quaternion.z, w: quaternion.w };
    const clearance = 0.001;
    const maximumDisplacement = dimensions.width * 0.4;

    for (let iteration = 0; iteration <= 6; iteration += 1) {
      let deepestContact: ReturnType<RapierCollider['contactShape']> = null;
      world.intersectionsWithShape(position, rotation, ghostShape, collider => {
        const contact = collider.contactShape(ghostShape, position, rotation, 0);
        if (contact && contact.distance < -0.00001) {
          if (!deepestContact || contact.distance < deepestContact.distance) {
            deepestContact = contact;
          }
        }
        return true;
      });

      if (!deepestContact) return { position, valid: true };
      if (iteration === 6) return { position, valid: false };

      const normal = new THREE.Vector3(
        deepestContact.normal1.x,
        deepestContact.normal1.y,
        deepestContact.normal1.z,
      );
      let distance = -deepestContact.distance + clearance;
      if (lockHeight) {
        const horizontalLength = Math.hypot(normal.x, normal.z);
        if (horizontalLength < 0.05) return { position, valid: false };
        normal.set(normal.x / horizontalLength, 0, normal.z / horizontalLength);
        distance /= horizontalLength;
      } else {
        normal.normalize();
      }
      position.addScaledVector(normal, distance);
      if (position.distanceTo(start) > maximumDisplacement) {
        return { position, valid: false };
      }
    }

    return { position, valid: false };
  }, [dimensions.width, ghostShape, world]);

  const applyPlacement = useCallback((
    basePosition: THREE.Vector3,
    quaternion: THREE.Quaternion,
    hit: THREE.Intersection | undefined,
    hitNormal: THREE.Vector3 | null,
  ) => {
    let candidatePosition = basePosition.clone();
    let snapped = false;
    let snapType: GhostSnapType | undefined;
    let anchor: [number, number, number] | undefined;
    let targetSegmentWorld: [THREE.Vector3, THREE.Vector3] | undefined;

    if (snapHeldRef.current && hit?.object.name === 'card-surface') {
      const snap = resolveGhostSnap({
        basePosition,
        ghostQuaternion: quaternion,
        target: hit.object,
        anchors: snapAnchors,
        segments: snapSegments,
        enterDistance: dimensions.width * 0.15,
        releaseDistance: dimensions.width * 0.2,
        latch: snapLatchRef.current,
        horizontalOnly: heightLockRef.current.active,
      });
      if (snap) {
        candidatePosition.copy(snap.position);
        if (hitNormal) {
          const cardXAxis = new THREE.Vector3(1, 0, 0).applyQuaternion(quaternion);
          const cardYAxis = new THREE.Vector3(0, 1, 0).applyQuaternion(quaternion);
          const cardZAxis = new THREE.Vector3(0, 0, 1).applyQuaternion(quaternion);
          const projectedRadius =
            Math.abs(cardXAxis.dot(hitNormal)) * dimensions.width / 2 +
            Math.abs(cardYAxis.dot(hitNormal)) * dimensions.thickness / 2 +
            Math.abs(cardZAxis.dot(hitNormal)) * dimensions.height / 2;
          const supportPlane = hit.point.dot(hitNormal) + projectedRadius + 0.001;
          candidatePosition.addScaledVector(
            hitNormal,
            supportPlane - candidatePosition.dot(hitNormal),
          );
        }
        if (heightLockRef.current.active) candidatePosition.y = heightLockRef.current.height;
        snapLatchRef.current = {
          targetId: snap.targetId,
          targetFeatureId: snap.targetFeatureId,
          targetType: snap.targetType,
          ghostAnchorId: snap.ghostAnchorId,
        };
        snapped = true;
        snapType = snap.type;
        anchor = snap.ghostAnchorLocal.toArray();
        targetSegmentWorld = snap.targetSegmentWorld;
      } else {
        snapLatchRef.current = null;
      }
    } else {
      snapLatchRef.current = null;
    }

    const resolved = resolveCollisions(
      candidatePosition,
      quaternion,
      heightLockRef.current.active,
    );
    // Battle zones are a placement rule, not a collision: the ghost turns red
    // and the click is rejected when the guard rejects the pose. The guard also
    // reports why so the HUD can explain the refusal instead of doing nothing.
    const euler = new THREE.Euler().setFromQuaternion(quaternion, 'XYZ');
    const guard = placementGuard
      ? placementGuard(
        [resolved.position.x, resolved.position.y, resolved.position.z],
        [euler.x, euler.y, euler.z],
      )
      : null;
    if (guard?.reason !== placementStatusRef.current) {
      placementStatusRef.current = guard?.reason ?? null;
      onPlacementStatus?.(guard && !guard.ok ? { ok: false, reason: guard.reason } : null);
    }
    const allowed = !guard || guard.ok;
    placementValidRef.current = resolved.valid && allowed;
    if (meshRef.current) {
      meshRef.current.position.copy(resolved.position);
      meshRef.current.quaternion.copy(quaternion);
    }
    const inverseQuaternion = quaternion.clone().invert();
    const targetLine = targetSegmentWorld?.map(point =>
      point.clone().sub(resolved.position).applyQuaternion(inverseQuaternion).toArray()
    ) as [[number, number, number], [number, number, number]] | undefined;
    setPlacementVisual(previous => {
      const valid = resolved.valid && allowed;
      if (
        previous.valid === valid &&
        previous.snapped === snapped &&
        previous.snapType === snapType &&
        String(previous.anchor) === String(anchor) &&
        String(previous.targetLine) === String(targetLine)
      ) return previous;
      return { valid, snapped, snapType, anchor, targetLine };
    });
    rotationDirtyRef.current = false;
  }, [dimensions.height, dimensions.thickness, dimensions.width, onPlacementStatus, placementGuard, resolveCollisions, snapAnchors, snapSegments]);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (event.button === 0) {
        clickStartRef.current = { x: event.clientX, y: event.clientY };
      }
    };
    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, []);

  // Reset offset when preset changes
  useEffect(() => {
    setManualRotation([0, 0, 0, 1]);
    rotationDirtyRef.current = true;
  }, [rotationPreset.id]);

  useLayoutEffect(() => {
    rotationDirtyRef.current = true;
  }, [manualRotation]);

  const targetRotation = useMemo(() => {
    // 1. Create the base rotation from the preset
    // Note: We use the preset's exact Euler (likely XYZ order)
    const baseEuler = new THREE.Euler(
        rotationPreset.rotation[0], 
        rotationPreset.rotation[1], 
        rotationPreset.rotation[2], 
        'XYZ'
    );

    // 2. Combine the preset with the accumulated world-space adjustment.
    const baseQuat = new THREE.Quaternion().setFromEuler(baseEuler);
    const worldOffset = new THREE.Quaternion(...manualRotation);
    worldOffset.multiply(baseQuat);

    // 3. Return as Euler for the mesh.
    return new THREE.Euler().setFromQuaternion(worldOffset, 'XYZ');
  }, [manualRotation, rotationPreset]);

  useFrame(({ mouse, clock }) => {
    const pointerUnchanged = lastPointerRef.current.equals(mouse);
    const cameraUnchanged =
      lastCameraPositionRef.current.equals(camera.position) &&
      lastCameraQuaternionRef.current.equals(camera.quaternion);
    const timeSinceLastRaycast = clock.elapsedTime - lastRaycastTimeRef.current;

    // While idle, sample at 10 Hz so moving physics bodies still update the
    // placement target without traversing the whole card group every frame.
    if (
      !rotationDirtyRef.current &&
      pointerUnchanged &&
      cameraUnchanged &&
      timeSinceLastRaycast < 0.1
    ) return;

    lastRaycastTimeRef.current = clock.elapsedTime;
    lastPointerRef.current.copy(mouse);
    lastCameraPositionRef.current.copy(camera.position);
    lastCameraQuaternionRef.current.copy(camera.quaternion);
    raycaster.setFromCamera(mouse, camera);

    const targets: THREE.Object3D[] = [];
    if (floorRef.current) targets.push(floorRef.current);
    if (cardsGroupRef.current) targets.push(cardsGroupRef.current);
    const intersects = raycaster.intersectObjects(targets, true);
    const hit = intersects.find(intersection =>
      intersection.object !== meshRef.current &&
      intersection.object.type === 'Mesh' &&
      intersection.object.name !== 'ghost' &&
      intersection.object.visible &&
      (intersection.object.name === 'placement-floor' || intersection.object.name === 'card-surface')
    );
    const quaternion = new THREE.Quaternion().setFromEuler(targetRotation);
    let hitNormal: THREE.Vector3 | null = null;
    if (hit?.face) {
      hitNormal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld).normalize();
    }

    if (heightLockRef.current.active) {
      // While height is locked, ignore every scene surface. Project the
      // pointer directly onto a horizontal plane through the captured height
      // so crossing cards or empty gaps cannot make the ghost jump.
      heightLockPlaneRef.current.constant = -heightLockRef.current.height;
      const lockedPoint = raycaster.ray.intersectPlane(
        heightLockPlaneRef.current,
        heightLockPointRef.current
      );

      if (lockedPoint) {
        applyPlacement(lockedPoint, quaternion, hit, hitNormal);
      }
      return;
    }

    if (hit && hitNormal) {
      // Anti-clipping projection
      const rotationMatrix = new THREE.Matrix4().makeRotationFromEuler(targetRotation);

      const cardXAxis = new THREE.Vector3(1, 0, 0).applyMatrix4(rotationMatrix); 
      const cardYAxis = new THREE.Vector3(0, 1, 0).applyMatrix4(rotationMatrix); 
      const cardZAxis = new THREE.Vector3(0, 0, 1).applyMatrix4(rotationMatrix);

      const halfWidth = dimensions.width / 2;
      const halfThickness = dimensions.thickness / 2;
      const halfHeight = dimensions.height / 2;

      const projectedRadius = 
        Math.abs(cardXAxis.dot(hitNormal)) * halfWidth +
        Math.abs(cardYAxis.dot(hitNormal)) * halfThickness +
        Math.abs(cardZAxis.dot(hitNormal)) * halfHeight;

      const offsetVector = hitNormal.multiplyScalar(projectedRadius + 0.001);
      const newPos = hit.point.clone().add(offsetVector);

      const isFloor = Math.abs(hitNormal.y) > 0.9;
      if (isFloor) {
        const SNAP = 0.1; 
        newPos.x = Math.round(newPos.x / SNAP) * SNAP;
        newPos.z = Math.round(newPos.z / SNAP) * SNAP;
      }

      applyPlacement(newPos, quaternion, hit, hitNormal);
    }
  });

  // Handle Placement Trigger
  useEffect(() => {
    const triggerPlace = () => {
      if (meshRef.current && placementValidRef.current) {
        onPlace(meshRef.current.position.clone(), meshRef.current.rotation.clone());
      }
    };

    const handleClick = (e: MouseEvent) => {
      if ((e.target as HTMLElement).tagName !== 'CANVAS') return;

      if (clickStartRef.current) {
        const dx = e.clientX - clickStartRef.current.x;
        const dy = e.clientY - clickStartRef.current.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance > 5) return;
      }

      triggerPlace();
    };
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, [onPlace]);

  const ghostColor = !placementVisual.valid
    ? 0xef4444
    : placementVisual.snapped || isSnapHeld
      ? 0xfacc15
      : isHeightLocked
    ? 0xa855f7
    : isFreezeMode
      ? 0x00ffff
      : 0x00ff00;

  return (
    <mesh ref={meshRef} name="ghost">
      <boxGeometry args={[dimensions.width, dimensions.thickness, dimensions.height]} />
      <meshBasicMaterial 
        color={ghostColor}
        opacity={0.5} 
        transparent 
        wireframe 
      />
      <lineSegments geometry={guideGeometry} renderOrder={3}>
        <lineBasicMaterial
          color={ghostColor}
          transparent
          opacity={0.9}
          depthTest={false}
        />
      </lineSegments>
      <arrowHelper args={[
        new THREE.Vector3(0, 0, 1),
        new THREE.Vector3(0,0,0),
        1.5,
        ghostColor
      ]} />
      {placementVisual.snapped && placementVisual.anchor && (
        <mesh position={placementVisual.anchor} renderOrder={5}>
          <sphereGeometry args={[0.075, 12, 8]} />
          <meshBasicMaterial color={0xfacc15} depthTest={false} depthWrite={false} />
        </mesh>
      )}
      {placementVisual.snapped && placementVisual.targetLine && (
        <Line
          points={placementVisual.targetLine}
          color="#facc15"
          lineWidth={3}
          transparent
          opacity={0.95}
          depthTest={false}
          renderOrder={5}
        />
      )}
    </mesh>
  );
};

// Precision Mode component (Blender-like)
const PrecisionGhost = ({
  isFreezeMode,
  onPlace,
  cardSize,
  placementGuard,
}: {
  isFreezeMode: boolean;
  onPlace: (pos: THREE.Vector3, rot: THREE.Euler) => void;
  cardSize: CardSize;
  placementGuard?: PlacementGuard;
}) => {
  const [target, setTarget] = useState<THREE.Object3D | null>(null);
  const [mode, setMode] = useState<'translate' | 'rotate'>('translate');
  const targetRef = useRef<THREE.Object3D | null>(null);
  useEffect(() => { targetRef.current = target; }, [target]);
  const initialPos = useMemo(() => new THREE.Vector3(0, 1.5, 0), []);
  const dimensions = CARD_DIMENSIONS[cardSize];
  const commitPlacement = React.useCallback(() => {
    const current = targetRef.current;
    if (!current) return;
    const rotation = current.rotation;
    const guard = placementGuard
      ? placementGuard(
        [current.position.x, current.position.y, current.position.z],
        [rotation.x, rotation.y, rotation.z],
      )
      : null;
    if (guard && !guard.ok) return;
    onPlace(current.position.clone(), current.rotation.clone());
  }, [onPlace, placementGuard]);

  useInputAction('precision.translate', event => {
    if (event.phase === 'down') setMode('translate');
  });
  useInputAction('precision.rotate', event => {
    if (event.phase === 'down') setMode('rotate');
  });
  useInputAction('action.confirm', event => {
    if (event.phase === 'down') commitPlacement();
  });

  useEffect(() => {
    const handleCustomEvent = () => commitPlacement();
    window.addEventListener('trigger-precision-place', handleCustomEvent);
    return () => {
        window.removeEventListener('trigger-precision-place', handleCustomEvent);
    };
  }, [commitPlacement]);

  return (
    <>
      {target && (
        <TransformControls 
            object={target} 
            mode={mode} 
            translationSnap={0.1} 
            rotationSnap={THREE.MathUtils.degToRad(5)} 
            space="local"
        />
      )}
      <mesh 
        ref={setTarget} 
        position={initialPos} 
        name="precision-ghost"
      >
        <boxGeometry args={[dimensions.width, dimensions.thickness, dimensions.height]} />
        <meshStandardMaterial 
            color={isFreezeMode ? "#22d3ee" : "#fbbf24"} 
            opacity={0.8} 
            transparent 
            emissive={isFreezeMode ? "#22d3ee" : "#fbbf24"}
            emissiveIntensity={0.5}
        />
        <lineSegments>
            <edgesGeometry args={[new THREE.BoxGeometry(dimensions.width, dimensions.thickness, dimensions.height)]} />
            <lineBasicMaterial color="white" />
        </lineSegments>
      </mesh>
    </>
  );
};

const PhysicsWorld: React.FC<PhysicsWorldProps> = ({ 
  rotationPreset, 
  interactionMode, 
  pointerMode,
  launchPreset,
  isFreezeMode, 
  cards, 
  addCard,
  removeCard,
  interactionEnabled,
  placementEnabled,
  windStrength,
  onHeightChange,
  showTargetGuide,
  targetHeight,
  cardSize,
  testType,
  testActive,
  weightMass,
  weightDropHeight,
  physicsSettings,
  onCardTransformChange,
  onCardLaunch,
  blueprintGuide,
  onBlueprintPlaceOrigin,
  onBlueprintProgress,
  onBlueprintStepComplete,
  onBlueprintStepRegression,
  placementGuard,
  onPlacementStatus,
  canLaunchCard,
}) => {
  
  const floorRef = useRef<THREE.Mesh>(null);
  const cardsGroupRef = useRef<THREE.Group>(null);
  const heightSampleTimeRef = useRef(0);
  const measurementBoxRef = useRef(new THREE.Box3());
  const liveCardTransformsRef = useRef(new Map<string, LiveCardTransform>());
  const physicsHandlesRef = useRef(new Map<string, CardPhysicsHandle>());
  const launchedSequencesRef = useRef(new Set<string>());
  const activeLaunchSessionsRef = useRef(new Map<string, ActiveLaunchSession>());
  const busyLaunchCardIdsRef = useRef(new Set<string>());
  const cardsRef = useRef(cards);
  cardsRef.current = cards;
  const flightDampingRef = useRef(new Map<string, {
    startedAt: number;
    stableAt: number | null;
    originalLinear: number;
    originalAngular: number;
  }>());

  useEffect(() => {
    const activeIds = new Set(cards.map(card => card.id));
    for (const id of liveCardTransformsRef.current.keys()) {
      if (!activeIds.has(id)) liveCardTransformsRef.current.delete(id);
    }
  }, [cards]);

  const handleCardTransformChange = useCallback((id: string, transform: LiveCardTransform) => {
    liveCardTransformsRef.current.set(id, transform);
    onCardTransformChange(id, transform);
  }, [onCardTransformChange]);

  const handlePhysicsHandleChange = useCallback((
    id: string,
    handle: CardPhysicsHandle | null,
  ) => {
    if (handle) physicsHandlesRef.current.set(id, handle);
    else {
      physicsHandlesRef.current.delete(id);
      flightDampingRef.current.delete(id);
    }
  }, []);

  useEffect(() => {
    for (const [id, handle] of physicsHandlesRef.current) {
      const flight = flightDampingRef.current.get(id);
      if (flight) {
        flight.originalLinear = physicsSettings.structureLinearDamping;
        flight.originalAngular = physicsSettings.structureAngularDamping;
        handle.setDamping(
          physicsSettings.flightLinearDamping,
          physicsSettings.flightAngularDamping,
        );
      } else {
        handle.setDamping(
          physicsSettings.structureLinearDamping,
          physicsSettings.structureAngularDamping,
        );
      }
      handle.wakeUp();
    }
  }, [physicsSettings]);

  const handleLaunchRequest = useCallback((request: CardLaunchRequest) => {
    if (launchedSequencesRef.current.has(request.sequenceId)) return;
    launchedSequencesRef.current.add(request.sequenceId);
    if (launchedSequencesRef.current.size > 256) {
      const oldest = launchedSequencesRef.current.values().next().value;
      if (oldest) launchedSequencesRef.current.delete(oldest);
    }

    const dimensions = CARD_DIMENSIONS[cardSize];
    const stackCandidates = cards.flatMap(card => {
      const handle = physicsHandlesRef.current.get(card.id);
      if (!handle) return [];
      const snapshot = handle.getSnapshot();
      return [{
        id: card.id,
        position: snapshot.position,
        quaternion: snapshot.quaternion,
        locked: card.locked,
        mass: handle.getMass(),
        dimensions,
      }];
    });
    const memberIds = findStackedCardIds(
      request.primaryCardId,
      stackCandidates,
      {
        maximumOrientationAngleDegrees: 8,
        minimumOverlapRatio: 0.8,
        minimumLayerDistance: 0.06,
        thicknessMultiplier: 3,
      },
    );
    let members = memberIds.flatMap(id => {
      const handle = physicsHandlesRef.current.get(id);
      const card = stackCandidates.find(candidate => candidate.id === id);
      return handle && card ? [{ handle, card }] : [];
    });
    const primaryMember = members.find(({ card }) => card.id === request.primaryCardId);
    if (request.preset === 'card-back-half' && primaryMember) {
      const primaryNormal = worldDirectionFromQuaternion([0, 1, 0], primaryMember.card.quaternion);
      const minimumNormalDot = Math.cos(8 * Math.PI / 180);
      members = members.filter(({ card }) => {
        const normal = worldDirectionFromQuaternion([0, 1, 0], card.quaternion);
        return (
          normal[0] * primaryNormal[0] +
          normal[1] * primaryNormal[1] +
          normal[2] * primaryNormal[2]
        ) >= minimumNormalDot;
      });
    }
    if (members.length === 0 || members.some(({ card }) => busyLaunchCardIdsRef.current.has(card.id))) {
      return;
    }

    const targetSpeed = resolveLaunchTargetSpeed(
      request.meterPower,
      physicsSettings.launchMinimumSpeed,
      physicsSettings.launchMaximumSpeed,
    );
    const activeMembers: ActiveLaunchMember[] = [];
    const nowSeconds = performance.now() / 1000;
    const primarySnapshot = primaryMember?.handle.getSnapshot();
    const primaryDirectionWorld = primarySnapshot
      ? worldDirectionFromQuaternion(request.directionLocal, primarySnapshot.quaternion)
      : request.directionLocal;
    const primaryContactOffsetWorld = primarySnapshot
      ? quaternionToWorldVector(request.contactPointLocal, primarySnapshot.quaternion)
      : request.contactPointLocal;
    const presetCandidates = getLaunchPresetCandidates(request.preset, dimensions);

    for (const { handle, card } of members) {
      const snapshotBefore = handle.getSnapshot();
      const memberTarget = presetCandidates.reduce((best, candidate) => {
        const direction = worldDirectionFromQuaternion(
          candidate.directionLocal,
          snapshotBefore.quaternion,
        );
        const contactOffset = quaternionToWorldVector(
          candidate.contactPointLocal,
          snapshotBefore.quaternion,
        );
        const directionDot =
          direction[0] * primaryDirectionWorld[0] +
          direction[1] * primaryDirectionWorld[1] +
          direction[2] * primaryDirectionWorld[2];
        const contactDistance = Math.hypot(
          contactOffset[0] - primaryContactOffsetWorld[0],
          contactOffset[1] - primaryContactOffsetWorld[1],
          contactOffset[2] - primaryContactOffsetWorld[2],
        );
        const score = directionDot * 2 - contactDistance / Math.max(dimensions.width, dimensions.height);
        return score > best.score
          ? { candidate, direction, score }
          : best;
      }, {
        candidate: {
          contactPointLocal: request.contactPointLocal,
          directionLocal: request.directionLocal,
          index: -1,
        },
        direction: worldDirectionFromQuaternion(
          request.directionLocal,
          snapshotBefore.quaternion,
        ),
        score: Number.NEGATIVE_INFINITY,
      });
      const directionWorld = memberTarget.direction;
      const contactPointLocal = memberTarget.candidate.contactPointLocal;
      const contactPointWorld = localPointToWorld(
        contactPointLocal,
        snapshotBefore.position,
        snapshotBefore.quaternion,
      );
      const previousFlight = flightDampingRef.current.get(card.id);
      const originalDamping = previousFlight
        ? {
            linear: previousFlight.originalLinear,
            angular: previousFlight.originalAngular,
          }
        : handle.getDamping();
      handle.setDamping(
        physicsSettings.flightLinearDamping,
        physicsSettings.flightAngularDamping,
      );
      handle.wakeUp();
      flightDampingRef.current.set(card.id, {
        startedAt: nowSeconds,
        stableAt: null,
        originalLinear: originalDamping.linear,
        originalAngular: originalDamping.angular,
      });
      activeMembers.push({
        cardId: card.id,
        handle,
        mass: card.mass,
        contactPointLocal: [...contactPointLocal],
        contactPointWorld,
        directionWorld,
        cumulativeImpulse: [0, 0, 0],
        snapshotBefore,
      });
    }
    if (activeMembers.length === 0) return;
    const activePrimary = activeMembers.find(member => member.cardId === request.primaryCardId);
    if (!activePrimary) return;
    const totalMass = activeMembers.reduce((sum, member) => sum + member.mass, 0);
    if (totalMass <= 0) return;

    activeMembers.forEach(member => busyLaunchCardIdsRef.current.add(member.cardId));
    activeLaunchSessionsRef.current.set(request.sequenceId, {
      intent: {
        sequenceId: request.sequenceId,
        primaryCardId: request.primaryCardId,
        cardIds: activeMembers.map(member => member.cardId),
        preset: request.preset,
        meterPower: request.meterPower,
        targetSpeed,
        forceLimit: physicsSettings.launchMaximumForce,
        strokeLimit: physicsSettings.launchStrokeDistance,
        pointerType: request.pointerType,
      },
      directionLocal: [...request.directionLocal],
      members: activeMembers,
      totalMass,
      actualStroke: 0,
      durationMs: 0,
      totalImpulseMagnitude: 0,
      workUsed: 0,
      workLimit: physicsSettings.launchMaximumForce * physicsSettings.launchStrokeDistance,
      maximumActuationMs: physicsSettings.launchMaximumActuationMs,
      lastPrimaryContactWorld: [...activePrimary.contactPointWorld],
      createdAt: Date.now(),
    });
  }, [cardSize, cards, physicsSettings]);

  useFrame(({ clock }) => {
    const nowSeconds = performance.now() / 1000;
    for (const [id, state] of flightDampingRef.current) {
      const handle = physicsHandlesRef.current.get(id);
      if (!handle) {
        flightDampingRef.current.delete(id);
        continue;
      }
      const snapshot = handle.getSnapshot();
      const linearSpeed = Math.hypot(...snapshot.linearVelocity);
      const angularSpeed = Math.hypot(...snapshot.angularVelocity);
      if (linearSpeed < 0.08 && angularSpeed < 0.08) {
        state.stableAt ??= nowSeconds;
      } else {
        state.stableAt = null;
      }
      const settled = (
        state.stableAt != null && nowSeconds - state.stableAt >= 0.5
      ) || nowSeconds - state.startedAt >= 6;
      if (settled) {
        handle.setDamping(state.originalLinear, state.originalAngular);
        flightDampingRef.current.delete(id);
      }
    }

    if (clock.elapsedTime - heightSampleTimeRef.current < 0.1) return;
    heightSampleTimeRef.current = clock.elapsedTime;

    const group = cardsGroupRef.current;
    if (!group || group.children.length === 0) {
      onHeightChange(0);
      return;
    }

    group.updateWorldMatrix(true, true);
    let maximumHeight = 0;
    for (const child of group.children) {
      measurementBoxRef.current.setFromObject(child);
      maximumHeight = Math.max(maximumHeight, measurementBoxRef.current.max.y);
    }
    onHeightChange(maximumHeight);
  });

  const handlePlaceNew = (pos: THREE.Vector3, rot: THREE.Euler) => {
    const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    const randomRank = ranks[Math.floor(Math.random() * ranks.length)];
    const suits = ['spades', 'hearts', 'clubs', 'diamonds'] as const;
    const randomSuit = suits[Math.floor(Math.random() * suits.length)];
    
    addCard({
      id: Math.random().toString(36).substr(2, 9),
      position: [pos.x, pos.y, pos.z],
      rotation: [rot.x, rot.y, rot.z],
      suit: randomSuit,
      color: (randomSuit === 'hearts' || randomSuit === 'diamonds') ? 'red' : 'black',
      rank: randomRank,
      locked: isFreezeMode
    });
    playPlaceSound();
  };

  const showNewCardGhost =
    interactionEnabled && placementEnabled && pointerMode === PointerMode.PLACE;

  return (
    <Physics
      gravity={[0, -9.81, 0]}
      timeStep={1 / 60}
      interpolate
      numSolverIterations={8}
      numInternalPgsIterations={2}
      allowedLinearError={0.0005}
    >
      <RapierWorldSettings />
      <LaunchActuatorController
        sessionsRef={activeLaunchSessionsRef}
        busyCardIdsRef={busyLaunchCardIdsRef}
        physicsHandlesRef={physicsHandlesRef}
        cardsRef={cardsRef}
        onCardLaunch={onCardLaunch}
      />
      <ambientLight intensity={0.5} />
      <directionalLight
        position={[10, 20, 10]}
        intensity={1}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-near={1}
        shadow-camera-far={50}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
      />
      
      <Floor
        meshRef={floorRef}
        cardSize={cardSize}
        friction={physicsSettings.floorFriction}
      />
      {blueprintGuide && (
        <BlueprintProjection
          guide={blueprintGuide}
          cards={cards}
          liveTransformsRef={liveCardTransformsRef}
          floorRef={floorRef}
          cardsGroupRef={cardsGroupRef}
          onPlaceOrigin={onBlueprintPlaceOrigin}
          onProgress={onBlueprintProgress}
          onStepComplete={onBlueprintStepComplete}
          onStepRegression={onBlueprintStepRegression}
        />
      )}
      {showTargetGuide && <TargetHeightGuide height={targetHeight} />}
      {windStrength > 0 && <WindVisual strength={windStrength} />}
      {testActive && testType === ChallengeTestType.WEIGHT_DROP && (
        <TestWeight mass={weightMass} dropHeight={weightDropHeight} />
      )}
      {!testActive && testType === ChallengeTestType.WEIGHT_DROP && (
        <WeightDropPreview dropHeight={weightDropHeight} />
      )}
      
      <group ref={cardsGroupRef}>
        {cards.map((card) => {
          return (
            <Card 
              key={`${card.id}-${cardSize}`}
              data={card} 
              pointerMode={pointerMode}
              onRemove={() => removeCard(card.id)}
              interactionEnabled={interactionEnabled}
              windStrength={windStrength}
              cardSize={cardSize}
              onTransformChange={handleCardTransformChange}
              launchPreset={launchPreset}
              onPhysicsHandleChange={handlePhysicsHandleChange}
              onLaunchRequest={handleLaunchRequest}
              physicsSettings={physicsSettings}
              launchAllowed={canLaunchCard ? canLaunchCard(card) : true}
            />
          );
        })}
      </group>

      {/* GHOST FOR NEW CARDS */}
      {showNewCardGhost && (
        interactionMode === InteractionMode.QUICK ? (
          <GhostCard 
              rotationPreset={rotationPreset} 
              isFreezeMode={isFreezeMode}
              onPlace={handlePlaceNew} 
              floorRef={floorRef}
              cardsGroupRef={cardsGroupRef}
              cardSize={cardSize}
              placementGuard={placementGuard}
              onPlacementStatus={onPlacementStatus}
          />
        ) : (
          <PrecisionGhost 
              isFreezeMode={isFreezeMode}
              onPlace={handlePlaceNew}
              cardSize={cardSize}
              placementGuard={placementGuard}
          />
        )
      )}

    </Physics>
  );
};

export default PhysicsWorld;
