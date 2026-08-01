/// <reference types="vite/client" />
import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, type ThreeEvent, useFrame, useThree } from '@react-three/fiber';
import { Line, OrbitControls, Stats } from '@react-three/drei';
import {
  CoefficientCombineRule,
  CuboidCollider,
  Physics as RapierPhysics,
  RigidBody,
  useAfterPhysicsStep,
  useBeforePhysicsStep,
  useRapier,
  type RapierRigidBody,
} from '@react-three/rapier';
import * as THREE from 'three';
import {
  CARD_DIMENSIONS,
  CardSize,
  type LaunchGestureSample,
  type LaunchIntent,
  type LaunchMemberRecord,
  type LaunchPreset,
  type LaunchRecord,
  type LaunchTerminationReason,
} from '../types';
import {
  createRapierCardPhysicsHandle,
  type CardPhysicsHandle,
} from '../physics/cardPhysics';
import {
  findStackedCardIds,
  isLaunchGesturePastDeadZone,
  localPointToWorld,
  resolveLaunchGesture,
  resolveLaunchMeterPower,
  resolveLaunchTargetSpeed,
  resolveLaunchTarget,
  resolvePushImpulseMagnitude,
  worldDirectionFromQuaternion,
} from '../physics/launchGesture';
import { resolveLaunchActuatorStep } from '../physics/launchActuator';

type PhysicsLabScenario = 'drop' | 'stack' | 'impact' | 'flick';

interface PhysicsLabProps {
  lang: 'zh' | 'en';
  cardSize: CardSize;
  onClose: () => void;
}

interface LabMetrics {
  runs: number;
  tunnels: number;
  collisions: number;
  stableSeconds: number | null;
  maxDisplacement: number;
  averageFps: number;
}

interface FlickTelemetry {
  power: number;
  gestureSpeed: number;
  memberCount: number;
  totalImpulse: number;
  memberImpulse: number;
  preset: LaunchPreset;
  linearSpeed: number;
  angularSpeed: number;
  targetSpeed: number;
  currentForce: number;
  actualStroke: number;
  terminationReason: LaunchTerminationReason | null;
  status: 'ready' | 'charging' | 'aiming' | 'launched' | 'settled' | 'cancelled';
  intent: LaunchIntent | null;
  record: LaunchRecord | null;
}

interface FlickParameters {
  minimumSpeed: number;
  maximumSpeed: number;
  maximumForce: number;
  strokeDistance: number;
  maximumActuationMs: number;
  linearDamping: number;
  angularDamping: number;
}

const DEFAULT_FLICK_PARAMETERS: FlickParameters = {
  minimumSpeed: 2.5,
  maximumSpeed: 24.5,
  maximumForce: 150,
  strokeDistance: 0.45,
  maximumActuationMs: 250,
  linearDamping: 0.08,
  angularDamping: 0.08,
};

interface LabActuationMember {
  cardId: string;
  handle: CardPhysicsHandle;
  mass: number;
  contactPointLocal: [number, number, number];
  contactPointWorld: [number, number, number];
  directionWorld: [number, number, number];
  cumulativeImpulse: [number, number, number];
  snapshotBefore: LaunchMemberRecord['snapshotBefore'];
}

interface LabActuationSession {
  intent: LaunchIntent;
  directionLocal: [number, number, number];
  members: LabActuationMember[];
  totalMass: number;
  durationMs: number;
  actualStroke: number;
  totalImpulseMagnitude: number;
  workUsed: number;
  workLimit: number;
  maximumActuationMs: number;
  lastPrimaryContactWorld: [number, number, number];
  createdAt: number;
}

const dotLaunchVector = (
  left: [number, number, number],
  right: [number, number, number],
) => left[0] * right[0] + left[1] * right[1] + left[2] * right[2];

const EMPTY_METRICS: LabMetrics = {
  runs: 0,
  tunnels: 0,
  collisions: 0,
  stableSeconds: null,
  maxDisplacement: 0,
  averageFps: 0,
};

const EMPTY_FLICK_TELEMETRY: FlickTelemetry = {
  power: 0,
  gestureSpeed: 0,
  memberCount: 0,
  totalImpulse: 0,
  memberImpulse: 0,
  preset: 'short-edge',
  linearSpeed: 0,
  angularSpeed: 0,
  targetSpeed: 0,
  currentForce: 0,
  actualStroke: 0,
  terminationReason: null,
  status: 'ready',
  intent: null,
  record: null,
};

const LAB_BASELINE = {
  engine: 'Cannon 0.20',
  stepSize: '1 / 60',
  cardMass: 0.1,
  cardFriction: 1,
  floorFriction: 1.1,
};

const RapierCcdSettings = () => {
  const { world } = useRapier();
  useEffect(() => {
    world.integrationParameters.maxCcdSubsteps = 2;
  }, [world]);
  return null;
};

const RapierLabFloor = () => (
  <>
    <RigidBody type="fixed" colliders={false}>
      <CuboidCollider
        args={[20, 0.05, 20]}
        position={[0, -0.05, 0]}
        friction={LAB_BASELINE.floorFriction}
        frictionCombineRule={CoefficientCombineRule.Multiply}
        restitution={0}
      />
    </RigidBody>
    <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[40, 40]} />
      <meshStandardMaterial color="#d9dee5" roughness={0.9} />
      <gridHelper args={[40, 40, '#8190a3', '#aeb8c4']} rotation={[-Math.PI / 2, 0, 0]} />
    </mesh>
  </>
);

const FpsSampler = ({ onAverage }: { onAverage: (fps: number) => void }) => {
  const samplesRef = useRef<number[]>([]);
  const elapsedRef = useRef(0);

  useFrame((_, delta) => {
    if (delta <= 0) return;
    elapsedRef.current += delta;
    samplesRef.current.push(Math.min(240, 1 / delta));
    if (elapsedRef.current < 0.5) return;
    const samples = samplesRef.current;
    onAverage(samples.reduce((sum, value) => sum + value, 0) / Math.max(1, samples.length));
    samplesRef.current = [];
    elapsedRef.current = 0;
  });
  return null;
};

const RapierLabCard = ({
  cardSize,
  position,
  rotation = [0, 0, 0],
  mass = 0.1,
  velocity,
  onPosition,
  onVelocity,
  onCollision,
}: {
  cardSize: CardSize;
  position: [number, number, number];
  rotation?: [number, number, number];
  mass?: number;
  velocity?: [number, number, number];
  onPosition?: (position: [number, number, number]) => void;
  onVelocity?: (velocity: [number, number, number]) => void;
  onCollision?: () => void;
}) => {
  const dimensions = CARD_DIMENSIONS[cardSize];
  const bodyRef = useRef<RapierRigidBody>(null);

  useAfterPhysicsStep(() => {
    const body = bodyRef.current;
    if (!body || (!onPosition && !onVelocity)) return;
    const nextPosition = body.translation();
    const nextVelocity = body.linvel();
    onPosition?.([nextPosition.x, nextPosition.y, nextPosition.z]);
    onVelocity?.([nextVelocity.x, nextVelocity.y, nextVelocity.z]);
  });

  return (
    <RigidBody
      ref={bodyRef}
      type={mass === 0 ? 'fixed' : 'dynamic'}
      colliders={false}
      position={position}
      rotation={rotation}
      {...(velocity ? { linearVelocity: velocity } : {})}
      linearDamping={0.5}
      angularDamping={0.5}
      canSleep
      ccd={mass > 0}
      additionalSolverIterations={4}
      onCollisionEnter={onCollision}
    >
      <CuboidCollider
        args={[dimensions.width / 2, dimensions.thickness / 2, dimensions.height / 2]}
        mass={mass || undefined}
        friction={LAB_BASELINE.cardFriction}
        frictionCombineRule={CoefficientCombineRule.Multiply}
        restitution={0}
      />
      <mesh castShadow receiveShadow>
        <boxGeometry args={[dimensions.width, dimensions.thickness, dimensions.height]} />
        <meshStandardMaterial color="#f7f6f2" roughness={0.55} />
      </mesh>
    </RigidBody>
  );
};

const RapierScenario = ({
  scenario,
  cardSize,
  runId,
  stackCount,
  onMetric,
}: {
  scenario: PhysicsLabScenario;
  cardSize: CardSize;
  runId: number;
  stackCount: 10 | 30 | 60;
  onMetric: (metric: Partial<LabMetrics>) => void;
}) => {
  const dimensions = CARD_DIMENSIONS[cardSize];
  const startedAtRef = useRef(performance.now());
  const collidedRef = useRef(false);
  const tunneledRef = useRef(false);
  const initialPosition = useMemo<[number, number, number]>(() => {
    if (scenario === 'impact' || scenario === 'flick') return [-6, dimensions.height / 2, 0];
    return [0, scenario === 'drop' ? dimensions.height * 2.5 : dimensions.thickness / 2, 0];
  }, [dimensions.height, dimensions.thickness, scenario]);

  const recordCollision = useCallback(() => {
    if (collidedRef.current) return;
    collidedRef.current = true;
    onMetric({ collisions: 1 });
  }, [onMetric]);

  const recordPosition = useCallback((position: [number, number, number]) => {
    const displacement = new THREE.Vector3(...position).distanceTo(new THREE.Vector3(...initialPosition));
    onMetric({ maxDisplacement: displacement });
    if (
      scenario === 'drop' &&
      position[1] < dimensions.thickness * -2 &&
      !collidedRef.current &&
      !tunneledRef.current
    ) {
      tunneledRef.current = true;
      onMetric({ tunnels: 1 });
    }
  }, [dimensions.thickness, initialPosition, onMetric, scenario]);

  const recordVelocity = useCallback((velocity: [number, number, number]) => {
    if (performance.now() - startedAtRef.current < 350) return;
    if (new THREE.Vector3(...velocity).length() < 0.05) {
      onMetric({ stableSeconds: (performance.now() - startedAtRef.current) / 1000 });
    }
  }, [onMetric]);

  if (scenario === 'stack') {
    const groupCount = Math.ceil(stackCount / 10);
    const columns = Math.min(3, groupCount);
    const rows = Math.ceil(groupCount / columns);
    return (
      <>
        {Array.from({ length: stackCount }, (_, index) => {
          const groupIndex = Math.floor(index / 10);
          const stackIndex = index % 10;
          const column = groupIndex % columns;
          const row = Math.floor(groupIndex / columns);
          return (
            <RapierLabCard
              key={`${runId}-rapier-stack-${index}`}
              cardSize={cardSize}
              position={[
                (column - (columns - 1) / 2) * 2.6,
                dimensions.thickness / 2 + stackIndex * (dimensions.thickness + 0.002),
                (row - (rows - 1) / 2) * 3.2,
              ]}
            />
          );
        })}
      </>
    );
  }

  if (scenario === 'drop') {
    return (
      <>
        <RapierLabCard
          key={`${runId}-rapier-drop-target`}
          cardSize={cardSize}
          mass={0}
          position={[0, dimensions.thickness * 1.5, 0]}
          onCollision={recordCollision}
        />
        <RapierLabCard
          key={`${runId}-rapier-drop-card`}
          cardSize={cardSize}
          position={initialPosition}
          onPosition={recordPosition}
          onVelocity={recordVelocity}
          onCollision={recordCollision}
        />
      </>
    );
  }

  const speed = scenario === 'flick' ? 15 : 10;
  return (
    <>
      <RapierLabCard
        key={`${runId}-rapier-impact-target`}
        cardSize={cardSize}
        mass={0}
        position={[0, dimensions.height / 2, 0]}
        rotation={[Math.PI / 2, 0, 0]}
        onCollision={recordCollision}
      />
      <RapierLabCard
        key={`${runId}-rapier-projectile`}
        cardSize={cardSize}
        position={initialPosition}
        rotation={[Math.PI / 2, 0, Math.PI / 2]}
        velocity={[speed, 0, 0]}
        onPosition={recordPosition}
        onVelocity={recordVelocity}
        onCollision={recordCollision}
      />
    </>
  );
};

type FlickTool = 'launch' | 'push';

interface ActiveLaunchCharge {
  sequenceId: string;
  pointerId: number;
  pointerType: LaunchIntent['pointerType'];
  cardId: string;
  startedAt: number;
  contactLocal: [number, number, number];
  directionLocal: [number, number, number];
}

interface ActivePushGesture {
  sequenceId: string;
  pointerId: number;
  cardId: string;
  contactWorld: THREE.Vector3;
  plane: THREE.Plane;
  startWorld: THREE.Vector3;
  currentWorld: THREE.Vector3;
  samples: LaunchGestureSample[];
}

interface FlickPreview {
  contact: THREE.Vector3;
  direction: THREE.Vector3;
  power: number;
  kind: FlickTool;
}

const pointerTypeOf = (event: ThreeEvent<PointerEvent>): LaunchIntent['pointerType'] => (
  event.pointerType === 'touch' || event.pointerType === 'pen'
    ? event.pointerType
    : 'mouse'
);

const FlickAimPreview = ({ preview }: { preview: FlickPreview }) => {
  const direction = preview.direction.clone();
  const hasDirection = direction.lengthSq() > 0.0001;
  if (hasDirection) direction.normalize();
  const end = preview.contact.clone().add(
    direction.clone().multiplyScalar(0.65 + preview.power * 1.25),
  );
  const arrowRotation = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    hasDirection ? direction : new THREE.Vector3(0, 1, 0),
  );
  const color = preview.kind === 'launch' ? '#f59e0b' : '#3b82f6';

  return (
    <group>
      <mesh position={preview.contact}>
        <sphereGeometry args={[0.075, 18, 12]} />
        <meshBasicMaterial color={color} depthTest={false} />
      </mesh>
      <mesh position={preview.contact} scale={0.8 + preview.power * 1.8}>
        <sphereGeometry args={[0.11, 18, 12]} />
        <meshBasicMaterial color={color} transparent opacity={0.2} depthTest={false} />
      </mesh>
      {hasDirection && (
        <>
          <Line
            points={[preview.contact, end]}
            color={color}
            lineWidth={3}
            depthTest={false}
          />
          <mesh position={end} quaternion={arrowRotation}>
            <coneGeometry args={[0.095, 0.28, 16]} />
            <meshBasicMaterial color={color} depthTest={false} />
          </mesh>
        </>
      )}
    </group>
  );
};

const FlickLabScene = ({
  cardSize,
  runId,
  preset,
  tool,
  ammoCount,
  onTelemetry,
  onMetric,
  onTargetHit,
  parameters,
}: {
  cardSize: CardSize;
  runId: number;
  preset: LaunchPreset;
  tool: FlickTool;
  ammoCount: 1 | 2 | 3 | 4 | 6;
  onTelemetry: (telemetry: FlickTelemetry) => void;
  onMetric: (metric: Partial<LabMetrics>) => void;
  onTargetHit: (target: number) => void;
  parameters: FlickParameters;
}) => {
  const dimensions = CARD_DIMENSIONS[cardSize];
  const bodyRefs = useRef(new Map<string, RapierRigidBody>());
  const meshRefs = useRef(new Map<string, THREE.Mesh>());
  const launchChargeRef = useRef<ActiveLaunchCharge | null>(null);
  const pushGestureRef = useRef<ActivePushGesture | null>(null);
  const launchedSequencesRef = useRef(new Set<string>());
  const actuationSessionsRef = useRef(new Map<string, LabActuationSession>());
  const flightDampingRef = useRef(new Map<string, { startedAt: number; stableAt: number | null }>());
  const telemetryRef = useRef<FlickTelemetry>({ ...EMPTY_FLICK_TELEMETRY, preset });
  const collisionRef = useRef(false);
  const telemetrySampleRef = useRef(0);
  const { camera, size } = useThree();
  const { rapier, world } = useRapier();
  const [preview, setPreview] = useState<FlickPreview | null>(null);

  const cardIdAt = useCallback((index: number) => (
    `physics-lab-ammo-${runId}-${index}`
  ), [runId]);

  const emitTelemetry = useCallback((next: FlickTelemetry) => {
    telemetryRef.current = next;
    onTelemetry(next);
  }, [onTelemetry]);

  const cancelGesture = useCallback(() => {
    if (!launchChargeRef.current && !pushGestureRef.current) return;
    launchChargeRef.current = null;
    pushGestureRef.current = null;
    setPreview(null);
    emitTelemetry({
      ...telemetryRef.current,
      status: 'cancelled',
      power: 0,
      gestureSpeed: 0,
    });
  }, [emitTelemetry]);

  useEffect(() => {
    cancelGesture();
  }, [ammoCount, cancelGesture, preset, tool]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') cancelGesture();
    };
    window.addEventListener('blur', cancelGesture);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('blur', cancelGesture);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [cancelGesture]);

  useFrame(() => {
    const charge = launchChargeRef.current;
    if (!charge) return;
    const power = resolveLaunchMeterPower(performance.now() - charge.startedAt);
    setPreview(previous => previous ? { ...previous, power } : previous);
    emitTelemetry({
      ...telemetryRef.current,
      status: 'charging',
      power,
      preset,
    });
  });

  useBeforePhysicsStep(() => {
    const deltaTime = world.timestep;
    for (const [sequenceId, session] of actuationSessionsRef.current) {
      const primary = session.members.find(member => member.cardId === session.intent.primaryCardId);
      const complete = (reason: LaunchTerminationReason) => {
        const memberRecords: LaunchMemberRecord[] = session.members.map(member => {
          let snapshotAfter = member.snapshotBefore;
          try {
            snapshotAfter = member.handle.getSnapshot();
          } catch {
            // The body may have been removed while the actuator was running.
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
        const record: LaunchRecord = {
          intent: session.intent,
          members: memberRecords,
          totalImpulseMagnitude: session.totalImpulseMagnitude,
          actualStroke: session.actualStroke,
          durationMs: session.durationMs,
          terminationReason: reason,
          createdAt: session.createdAt,
        };
        actuationSessionsRef.current.delete(sequenceId);
        setPreview(null);
        emitTelemetry({
          ...telemetryRef.current,
          status: 'launched',
          memberCount: memberRecords.length,
          totalImpulse: session.totalImpulseMagnitude,
          memberImpulse: memberRecords.length
            ? session.totalImpulseMagnitude / memberRecords.length
            : 0,
          targetSpeed: session.intent.targetSpeed,
          currentForce: 0,
          actualStroke: session.actualStroke,
          terminationReason: reason,
          intent: session.intent,
          record,
        });
      };

      if (!primary || session.members.some(member => !bodyRefs.current.has(member.cardId))) {
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
      const displacement: [number, number, number] = [
        primaryContactWorld[0] - session.lastPrimaryContactWorld[0],
        primaryContactWorld[1] - session.lastPrimaryContactWorld[1],
        primaryContactWorld[2] - session.lastPrimaryContactWorld[2],
      ];
      session.actualStroke += Math.max(0, dotLaunchVector(displacement, directionWorld));
      session.lastPrimaryContactWorld = primaryContactWorld;
      setPreview({
        contact: new THREE.Vector3(...primaryContactWorld),
        direction: new THREE.Vector3(...directionWorld),
        power: session.intent.meterPower,
        kind: 'launch',
      });

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

      const forwardSpeed = session.members.reduce((sum, member) => (
        sum + dotLaunchVector(member.handle.getSnapshot().linearVelocity, directionWorld) * member.mass
      ), 0) / session.totalMass;
      const step = resolveLaunchActuatorStep({
        totalMass: session.totalMass,
        forwardSpeed,
        targetSpeed: session.intent.targetSpeed,
        maximumForce: session.intent.forceLimit,
        deltaTime,
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
        const magnitude = step.impulseMagnitude * member.mass / session.totalMass;
        const impulse: [number, number, number] = [
          directionWorld[0] * magnitude,
          directionWorld[1] * magnitude,
          directionWorld[2] * magnitude,
        ];
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
      session.durationMs += deltaTime * 1000;
      emitTelemetry({
        ...telemetryRef.current,
        status: 'launched',
        targetSpeed: session.intent.targetSpeed,
        currentForce: step.appliedForce,
        actualStroke: session.actualStroke,
        totalImpulse: session.totalImpulseMagnitude,
        memberImpulse: session.totalImpulseMagnitude / session.members.length,
        memberCount: session.members.length,
        intent: session.intent,
      });
    }
  });

  useAfterPhysicsStep(() => {
    if (telemetrySampleRef.current++ % 6 !== 0) return;
    const now = performance.now() / 1000;
    let maximumLinearSpeed = 0;
    let maximumAngularSpeed = 0;
    let anyInFlight = false;
    for (const [cardId, state] of flightDampingRef.current) {
      const body = bodyRefs.current.get(cardId);
      if (!body) {
        flightDampingRef.current.delete(cardId);
        continue;
      }
      const linear = body.linvel();
      const angular = body.angvel();
      const linearSpeed = Math.hypot(linear.x, linear.y, linear.z);
      const angularSpeed = Math.hypot(angular.x, angular.y, angular.z);
      maximumLinearSpeed = Math.max(maximumLinearSpeed, linearSpeed);
      maximumAngularSpeed = Math.max(maximumAngularSpeed, angularSpeed);
      if (linearSpeed < 0.08 && angularSpeed < 0.08) state.stableAt ??= now;
      else state.stableAt = null;
      const settled = (
        state.stableAt != null && now - state.stableAt >= 0.5
      ) || now - state.startedAt >= 6;
      if (settled) {
        body.setLinearDamping(0.5);
        body.setAngularDamping(0.5);
        flightDampingRef.current.delete(cardId);
      } else {
        anyInFlight = true;
      }
    }
    if (telemetryRef.current.status !== 'launched' && !anyInFlight) return;
    emitTelemetry({
      ...telemetryRef.current,
      status: anyInFlight ? 'launched' : 'settled',
      linearSpeed: maximumLinearSpeed,
      angularSpeed: maximumAngularSpeed,
    });
  });

  const registerBody = useCallback((cardId: string, body: RapierRigidBody | null) => {
    if (body) bodyRefs.current.set(cardId, body);
    else bodyRefs.current.delete(cardId);
  }, []);

  const registerMesh = useCallback((cardId: string, mesh: THREE.Mesh | null) => {
    if (mesh) meshRefs.current.set(cardId, mesh);
    else meshRefs.current.delete(cardId);
  }, []);

  const capturePointer = (event: ThreeEvent<PointerEvent>) => {
    (event.target as unknown as { setPointerCapture?: (pointerId: number) => void })
      .setPointerCapture?.(event.pointerId);
  };

  const releasePointer = (event: ThreeEvent<PointerEvent>) => {
    (event.target as unknown as { releasePointerCapture?: (pointerId: number) => void })
      .releasePointerCapture?.(event.pointerId);
  };

  const startLaunchCharge = (
    cardId: string,
    event: ThreeEvent<PointerEvent>,
    mesh: THREE.Mesh,
  ) => {
    const clickedLocal = mesh.worldToLocal(event.point.clone());
    const target = resolveLaunchTarget(preset, clickedLocal.toArray(), dimensions);
    if (!target.valid) return;
    const body = bodyRefs.current.get(cardId);
    if (!body) return;
    const snapshot = createRapierCardPhysicsHandle(body, () => undefined).getSnapshot();
    const contactWorld = localPointToWorld(
      target.contactLocal,
      snapshot.position,
      snapshot.quaternion,
    );
    const directionWorld = worldDirectionFromQuaternion(
      target.directionLocal,
      snapshot.quaternion,
    );
    launchChargeRef.current = {
      sequenceId: crypto.randomUUID(),
      pointerId: event.pointerId,
      pointerType: pointerTypeOf(event),
      cardId,
      startedAt: performance.now(),
      contactLocal: target.contactLocal,
      directionLocal: target.directionLocal,
    };
    setPreview({
      contact: new THREE.Vector3(...contactWorld),
      direction: new THREE.Vector3(...directionWorld),
      power: 0,
      kind: 'launch',
    });
    emitTelemetry({
      ...EMPTY_FLICK_TELEMETRY,
      status: 'charging',
      preset,
    });
    capturePointer(event);
  };

  const startPushGesture = (
    cardId: string,
    event: ThreeEvent<PointerEvent>,
  ) => {
    const contactWorld = event.point.clone();
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(
      camera.getWorldDirection(new THREE.Vector3()),
      contactWorld,
    );
    pushGestureRef.current = {
      sequenceId: crypto.randomUUID(),
      pointerId: event.pointerId,
      cardId,
      contactWorld,
      plane,
      startWorld: contactWorld.clone(),
      currentWorld: contactWorld.clone(),
      samples: [{ x: event.clientX, y: event.clientY, time: performance.now() }],
    };
    setPreview({
      contact: contactWorld,
      direction: new THREE.Vector3(),
      power: 0,
      kind: 'push',
    });
    emitTelemetry({
      ...EMPTY_FLICK_TELEMETRY,
      status: 'aiming',
      preset,
    });
    capturePointer(event);
  };

  const samplePush = (event: ThreeEvent<PointerEvent>, gesture: ActivePushGesture) => {
    const now = performance.now();
    gesture.samples.push({ x: event.clientX, y: event.clientY, time: now });
    if (gesture.samples.length > 48) gesture.samples.splice(0, gesture.samples.length - 48);
    event.ray.intersectPlane(gesture.plane, gesture.currentWorld);
    const resolution = resolveLaunchGesture(gesture.samples, Math.min(size.width, size.height), now);
    setPreview({
      contact: gesture.contactWorld.clone(),
      direction: gesture.currentWorld.clone().sub(gesture.startWorld),
      power: resolution.rawPower,
      kind: 'push',
    });
    emitTelemetry({
      ...telemetryRef.current,
      status: 'aiming',
      power: resolution.rawPower,
      gestureSpeed: resolution.gestureSpeed,
    });
    return resolution;
  };

  const launchStack = (charge: ActiveLaunchCharge, meterPower: number) => {
    if (launchedSequencesRef.current.has(charge.sequenceId)) return;
    launchedSequencesRef.current.add(charge.sequenceId);
    const stackCandidates = Array.from(bodyRefs.current, ([id, body]) => {
      const handle = createRapierCardPhysicsHandle(body, locked => {
        body.setBodyType(
          locked ? rapier.RigidBodyType.Fixed : rapier.RigidBodyType.Dynamic,
          true,
        );
      });
      const snapshot = handle.getSnapshot();
      return {
        id,
        position: snapshot.position,
        quaternion: snapshot.quaternion,
        locked: false,
        mass: handle.getMass(),
        dimensions,
      };
    });
    const memberIds = findStackedCardIds(charge.cardId, stackCandidates, {
      maximumOrientationAngleDegrees: 8,
      minimumOverlapRatio: 0.8,
      minimumLayerDistance: 0.06,
      thicknessMultiplier: 3,
    });
    const members = memberIds.flatMap(id => {
      const body = bodyRefs.current.get(id);
      const card = stackCandidates.find(candidate => candidate.id === id);
      return body && card ? [{ body, card }] : [];
    });
    if (members.length === 0) return;
    const targetSpeed = resolveLaunchTargetSpeed(
      meterPower,
      parameters.minimumSpeed,
      parameters.maximumSpeed,
    );
    const activeMembers: LabActuationMember[] = [];
    const now = performance.now() / 1000;
    for (const { body, card } of members) {
      const handle = createRapierCardPhysicsHandle(body, locked => {
        body.setBodyType(
          locked ? rapier.RigidBodyType.Fixed : rapier.RigidBodyType.Dynamic,
          true,
        );
      });
      const snapshotBefore = handle.getSnapshot();
      const directionWorld = worldDirectionFromQuaternion(
        charge.directionLocal,
        snapshotBefore.quaternion,
      );
      const contactPointWorld = localPointToWorld(
        charge.contactLocal,
        snapshotBefore.position,
        snapshotBefore.quaternion,
      );
      handle.setDamping(parameters.linearDamping, parameters.angularDamping);
      handle.wakeUp();
      flightDampingRef.current.set(card.id, { startedAt: now, stableAt: null });
      activeMembers.push({
        cardId: card.id,
        handle,
        mass: card.mass,
        contactPointLocal: [...charge.contactLocal],
        contactPointWorld,
        directionWorld,
        cumulativeImpulse: [0, 0, 0],
        snapshotBefore,
      });
    }
    const primary = activeMembers.find(member => member.cardId === charge.cardId);
    const totalMass = activeMembers.reduce((sum, member) => sum + member.mass, 0);
    if (!primary || totalMass <= 0) return;
    const intent: LaunchIntent = {
      sequenceId: charge.sequenceId,
      primaryCardId: charge.cardId,
      cardIds: activeMembers.map(member => member.cardId),
      preset,
      meterPower,
      targetSpeed,
      forceLimit: parameters.maximumForce,
      strokeLimit: parameters.strokeDistance,
      pointerType: charge.pointerType,
    };
    actuationSessionsRef.current.set(charge.sequenceId, {
      intent,
      directionLocal: [...charge.directionLocal],
      members: activeMembers,
      totalMass,
      durationMs: 0,
      actualStroke: 0,
      totalImpulseMagnitude: 0,
      workUsed: 0,
      workLimit: parameters.maximumForce * parameters.strokeDistance,
      maximumActuationMs: parameters.maximumActuationMs,
      lastPrimaryContactWorld: [...primary.contactPointWorld],
      createdAt: Date.now(),
    });
    emitTelemetry({
      ...EMPTY_FLICK_TELEMETRY,
      status: 'launched',
      power: meterPower,
      memberCount: activeMembers.length,
      targetSpeed,
      currentForce: parameters.maximumForce,
      preset,
      intent,
      record: null,
    });
  };

  const finishGesture = (event: ThreeEvent<PointerEvent>) => {
    const charge = launchChargeRef.current;
    if (charge?.pointerId === event.pointerId) {
      event.stopPropagation();
      launchChargeRef.current = null;
      releasePointer(event);
      launchStack(charge, resolveLaunchMeterPower(performance.now() - charge.startedAt));
      return;
    }
    const gesture = pushGestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    event.stopPropagation();
    const resolution = samplePush(event, gesture);
    pushGestureRef.current = null;
    setPreview(null);
    releasePointer(event);
    const worldDelta = gesture.currentWorld.clone().sub(gesture.startWorld);
    if (
      !isLaunchGesturePastDeadZone(gesture.samples, Math.min(size.width, size.height))
      || worldDelta.lengthSq() < 0.0001
      || launchedSequencesRef.current.has(gesture.sequenceId)
    ) {
      emitTelemetry({ ...telemetryRef.current, status: 'cancelled' });
      return;
    }
    launchedSequencesRef.current.add(gesture.sequenceId);
    const body = bodyRefs.current.get(gesture.cardId);
    if (!body) return;
    const impulseMagnitude = resolvePushImpulseMagnitude(resolution.rawPower);
    const impulse = worldDelta.normalize().multiplyScalar(impulseMagnitude);
    body.applyImpulseAtPoint(
      { x: impulse.x, y: impulse.y, z: impulse.z },
      {
        x: gesture.contactWorld.x,
        y: gesture.contactWorld.y,
        z: gesture.contactWorld.z,
      },
      true,
    );
    emitTelemetry({
      ...EMPTY_FLICK_TELEMETRY,
      status: 'launched',
      power: resolution.rawPower,
      gestureSpeed: resolution.gestureSpeed,
      memberCount: 1,
      totalImpulse: impulseMagnitude,
      memberImpulse: impulseMagnitude,
      preset,
    });
  };

  const moveGesture = (event: ThreeEvent<PointerEvent>) => {
    if (launchChargeRef.current?.pointerId === event.pointerId) {
      return;
    }
    const gesture = pushGestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    event.stopPropagation();
    samplePush(event, gesture);
  };

  const recordCollision = useCallback(() => {
    if (collisionRef.current) return;
    collisionRef.current = true;
    onMetric({ collisions: 1 });
  }, [onMetric]);

  return (
    <>
      <RigidBody type="fixed" colliders={false} position={[-0.62, 0.1, -3.2]}>
        <CuboidCollider args={[0.055, 0.08, 2.1]} friction={1.1} restitution={0} />
        <mesh castShadow>
          <boxGeometry args={[0.11, 0.16, 4.2]} />
          <meshStandardMaterial color="#4b6d91" metalness={0.15} roughness={0.55} />
        </mesh>
      </RigidBody>
      <RigidBody type="fixed" colliders={false} position={[0.62, 0.1, -3.2]}>
        <CuboidCollider args={[0.055, 0.08, 2.1]} friction={1.1} restitution={0} />
        <mesh castShadow>
          <boxGeometry args={[0.11, 0.16, 4.2]} />
          <meshStandardMaterial color="#4b6d91" metalness={0.15} roughness={0.55} />
        </mesh>
      </RigidBody>
      {[0.5, 3.5, 6.5].map((z, index) => (
        <RapierLabCard
          key={`${runId}-flick-target-${index}`}
          cardSize={cardSize}
          mass={0}
          position={[0, dimensions.height / 2, z]}
          rotation={[Math.PI / 2, 0, 0]}
          onCollision={() => {
            recordCollision();
            onTargetHit(index + 1);
          }}
        />
      ))}
      {Array.from({ length: ammoCount }, (_, index) => {
        const cardId = cardIdAt(index);
        return (
          <RigidBody
            key={cardId}
            ref={body => registerBody(cardId, body)}
            type="dynamic"
            colliders={false}
            position={[
              0,
              dimensions.thickness / 2 + index * (dimensions.thickness + 0.004),
              -4.5,
            ]}
            linearDamping={0.5}
            angularDamping={0.5}
            canSleep
            ccd
            additionalSolverIterations={4}
            onCollisionEnter={recordCollision}
          >
            <CuboidCollider
              args={[dimensions.width / 2, dimensions.thickness / 2, dimensions.height / 2]}
              mass={0.1}
              friction={1}
              frictionCombineRule={CoefficientCombineRule.Multiply}
              restitution={0}
            />
            <mesh
              ref={mesh => registerMesh(cardId, mesh)}
              castShadow
              receiveShadow
              onPointerDown={event => {
                if (event.button !== 0) return;
                event.stopPropagation();
                const mesh = meshRefs.current.get(cardId);
                if (!mesh) return;
                if (tool === 'launch') startLaunchCharge(cardId, event, mesh);
                else startPushGesture(cardId, event);
              }}
              onPointerMove={moveGesture}
              onPointerUp={finishGesture}
              onPointerCancel={cancelGesture}
            >
              <boxGeometry args={[dimensions.width, dimensions.thickness, dimensions.height]} />
              <meshStandardMaterial color="#fffefa" roughness={0.48} />
            </mesh>
          </RigidBody>
        );
      })}
      {preview && <FlickAimPreview preview={preview} />}
    </>
  );
};

const PhysicsLab: React.FC<PhysicsLabProps> = ({ lang, cardSize, onClose }) => {
  const [scenario, setScenario] = useState<PhysicsLabScenario>('drop');
  const [runId, setRunId] = useState(1);
  const [metrics, setMetrics] = useState<LabMetrics>({ ...EMPTY_METRICS, runs: 1 });
  const [flickTelemetry, setFlickTelemetry] = useState<FlickTelemetry>(EMPTY_FLICK_TELEMETRY);
  const [flickParameters, setFlickParameters] = useState<FlickParameters>(
    DEFAULT_FLICK_PARAMETERS,
  );
  const [launchPreset, setLaunchPreset] = useState<LaunchPreset>('short-edge');
  const [flickTool, setFlickTool] = useState<FlickTool>('launch');
  const [ammoCount, setAmmoCount] = useState<1 | 2 | 3 | 4 | 6>(1);
  const [slowMotion, setSlowMotion] = useState(false);
  const [targetHit, setTargetHit] = useState<number | null>(null);
  const [launchRecords, setLaunchRecords] = useState<LaunchRecord[]>([]);
  const [stackCount, setStackCount] = useState<10 | 30 | 60>(10);
  const copy = lang === 'zh'
    ? {
        title: '开发者物理实验室',
        subtitle: '固定条件复现穿模、堆叠与高速撞击',
        close: '返回主菜单',
        reset: '重新测试',
        drop: '跌落',
        stack: '堆叠',
        impact: '高速撞击',
        flick: '弹射基线',
      }
    : {
        title: 'Developer Physics Lab',
        subtitle: 'Reproduce tunneling, stacking, and high-speed impacts',
        close: 'Back to menu',
        reset: 'Run again',
        drop: 'Drop',
        stack: 'Stack',
        impact: 'Impact',
        flick: 'Flick baseline',
      };

  const updateMetric = useCallback((metric: Partial<LabMetrics>) => {
    setMetrics(previous => ({
      ...previous,
      tunnels: previous.tunnels + (metric.tunnels ?? 0),
      collisions: previous.collisions + (metric.collisions ?? 0),
      stableSeconds: metric.stableSeconds == null
        ? previous.stableSeconds
        : previous.stableSeconds == null
          ? metric.stableSeconds
          : Math.min(previous.stableSeconds, metric.stableSeconds),
      maxDisplacement: Math.max(previous.maxDisplacement, metric.maxDisplacement ?? 0),
      averageFps: metric.averageFps ?? previous.averageFps,
    }));
  }, []);

  const updateFlickTelemetry = useCallback((telemetry: FlickTelemetry) => {
    setFlickTelemetry(telemetry);
    if (!telemetry.record) return;
    setLaunchRecords(previous => (
      previous.some(record => record.intent.sequenceId === telemetry.record?.intent.sequenceId)
        ? previous
        : [...previous, telemetry.record]
    ));
  }, []);

  const reset = () => {
    setRunId(value => value + 1);
    setMetrics(previous => ({ ...EMPTY_METRICS, runs: previous.runs + 1 }));
    setFlickTelemetry({ ...EMPTY_FLICK_TELEMETRY, preset: launchPreset });
    setTargetHit(null);
    setLaunchRecords([]);
  };

  useEffect(() => {
    setRunId(value => value + 1);
    setMetrics({ ...EMPTY_METRICS, runs: 1 });
    setFlickTelemetry({ ...EMPTY_FLICK_TELEMETRY, preset: launchPreset });
    setSlowMotion(false);
    setTargetHit(null);
    setLaunchRecords([]);
  }, [scenario, launchPreset]);

  useEffect(() => {
    if (scenario !== 'flick') return;
    const presets: LaunchPreset[] = ['short-edge', 'long-edge-quarter', 'card-back-half'];
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || (event.key.toLowerCase() !== 'q' && event.key.toLowerCase() !== 'e')) {
        return;
      }
      event.preventDefault();
      setLaunchPreset(current => {
        const direction = event.key.toLowerCase() === 'q' ? -1 : 1;
        const index = presets.indexOf(current);
        return presets[(index + direction + presets.length) % presets.length];
      });
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [scenario]);

  return (
    <main className="physics-lab">
      <header className="physics-lab-header">
        <div>
          <span className="panel-kicker">DEV · PHYSICS</span>
          <h1>{copy.title}</h1>
          <p>{copy.subtitle}</p>
        </div>
        <div className="physics-lab-header-actions">
          <button onClick={reset}>{copy.reset}</button>
          {scenario === 'flick' && (
            <button
              className={slowMotion ? 'is-active' : ''}
              onClick={() => setSlowMotion(value => !value)}
            >
              {slowMotion ? '慢动作 ×0.25' : '正常速度 ×1'}
            </button>
          )}
          <button className="primary-button" onClick={onClose}>{copy.close}</button>
        </div>
      </header>

      <aside className="physics-lab-panel">
        <label>
          <span>ENGINE</span>
          <select value="rapier" disabled>
            <option value="rapier">Rapier 0.19 · CCD</option>
          </select>
        </label>
        <nav>
          {(Object.keys(copy) as Array<keyof typeof copy>)
            .filter(key => ['drop', 'stack', 'impact', 'flick'].includes(key))
            .map(key => (
              <button
                key={key}
                className={scenario === key ? 'is-active' : ''}
                onClick={() => setScenario(key as PhysicsLabScenario)}
              >
                {copy[key]}
              </button>
            ))}
        </nav>
        {scenario === 'stack' && (
          <div className="physics-lab-stack-count" aria-label="堆叠性能牌数">
            <span>PERFORMANCE CARDS</span>
            {[10, 30, 60].map(count => (
              <button
                key={count}
                className={stackCount === count ? 'is-active' : ''}
                onClick={() => {
                  setStackCount(count as 10 | 30 | 60);
                  reset();
                }}
              >
                {count}
              </button>
            ))}
          </div>
        )}
        {scenario === 'flick' && (
          <>
            <div className="physics-lab-stack-count" aria-label="弹射工具">
              <span>TOOL</span>
              {(['launch', 'push'] as const).map(nextTool => (
                <button
                  key={nextTool}
                  className={flickTool === nextTool ? 'is-active' : ''}
                  onClick={() => setFlickTool(nextTool)}
                >
                  {nextTool === 'launch'
                    ? (lang === 'zh' ? '预设弹射' : 'Preset launch')
                    : (lang === 'zh' ? '自由推拨' : 'Free push')}
                </button>
              ))}
            </div>
            <div className="physics-lab-stack-count" aria-label="弹射预设">
              <span>PRESET · Q / E</span>
              {([
                ['short-edge', lang === 'zh' ? '短边' : 'Short edge'],
                ['long-edge-quarter', lang === 'zh' ? '长边¼' : 'Long edge ¼'],
                ['card-back-half', lang === 'zh' ? '卡背½' : 'Back half'],
              ] as const).map(([nextPreset, label]) => (
                <button
                  key={nextPreset}
                  className={launchPreset === nextPreset ? 'is-active' : ''}
                  onClick={() => setLaunchPreset(nextPreset)}
                  disabled={flickTool === 'push'}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="physics-lab-stack-count" aria-label="弹射牌堆张数">
              <span>AMMO CARDS</span>
              {([1, 2, 3, 4, 6] as const).map(count => (
                <button
                  key={count}
                  className={ammoCount === count ? 'is-active' : ''}
                  onClick={() => {
                    setAmmoCount(count);
                    reset();
                  }}
                >
                  {count}
                </button>
              ))}
            </div>
          </>
        )}
        <dl>
          <div><dt>RUNS</dt><dd>{metrics.runs}</dd></div>
          <div><dt>TUNNELS</dt><dd className={metrics.tunnels ? 'is-danger' : ''}>{metrics.tunnels}</dd></div>
          <div><dt>COLLISIONS</dt><dd>{metrics.collisions}</dd></div>
          <div><dt>STABLE</dt><dd>{metrics.stableSeconds?.toFixed(2) ?? '—'} s</dd></div>
          <div><dt>MAX Δ</dt><dd>{metrics.maxDisplacement.toFixed(2)}</dd></div>
          <div><dt>AVG FPS</dt><dd>{metrics.averageFps.toFixed(0)}</dd></div>
        </dl>
        {scenario === 'flick' && (
          <>
            <div className="physics-lab-telemetry">
              <span>{flickTool === 'launch' ? 'LAUNCH' : 'PUSH'} · {flickTelemetry.status.toUpperCase()}</span>
              <strong>{Math.round(flickTelemetry.power * 100)}%</strong>
              <small>PRESET {flickTelemetry.preset}</small>
              <small>MEMBERS {flickTelemetry.memberCount || '—'}</small>
              <small>TOTAL IMPULSE {flickTelemetry.totalImpulse.toFixed(2)}</small>
              <small>PER CARD {flickTelemetry.memberImpulse.toFixed(2)}</small>
              <small>TARGET SPEED {flickTelemetry.targetSpeed.toFixed(2)}</small>
              <small>FORCE {flickTelemetry.currentForce.toFixed(1)}</small>
              <small>STROKE {flickTelemetry.actualStroke.toFixed(3)}</small>
              <small>STOP {flickTelemetry.terminationReason ?? '—'}</small>
              {flickTool === 'push' && (
                <small>GESTURE {flickTelemetry.gestureSpeed.toFixed(0)} px/s</small>
              )}
              <small>LINEAR {flickTelemetry.linearSpeed.toFixed(2)}</small>
              <small>ANGULAR {flickTelemetry.angularSpeed.toFixed(2)}</small>
              <small>TARGET {targetHit == null ? '—' : ['近', '中', '远'][targetHit - 1]}</small>
              <small>
                SEQ {flickTelemetry.intent?.sequenceId.slice(0, 8) ?? '—'}
              </small>
              <small>RECORDS {launchRecords.length}</small>
            </div>
            <div className="physics-lab-parameters">
              <span>LAUNCH PARAMETERS</span>
              {([
                ['minimumSpeed', 'MIN SPEED', 0, 10, 0.1],
                ['maximumSpeed', 'MAX SPEED', 5, 50, 0.5],
                ['maximumForce', 'MAX FORCE', 20, 400, 5],
                ['strokeDistance', 'STROKE', 0.1, 1.5, 0.05],
                ['maximumActuationMs', 'CONTACT MS', 50, 500, 10],
                ['linearDamping', 'LINEAR DAMP', 0, 1, 0.01],
                ['angularDamping', 'ANGULAR DAMP', 0, 1, 0.01],
              ] as const).map(([key, label, min, max, step]) => (
                <label key={key}>
                  <span>{label}</span>
                  <input
                    type="range"
                    min={min}
                    max={max}
                    step={step}
                    value={flickParameters[key]}
                    onChange={event => setFlickParameters(previous => ({
                      ...previous,
                      [key]: Number(event.target.value),
                    }))}
                  />
                  <output>{flickParameters[key].toFixed(2)}</output>
                </label>
              ))}
            </div>
          </>
        )}
        <div className="physics-lab-baseline">
          <span>STEP {LAB_BASELINE.stepSize}</span>
          <span>MASS {LAB_BASELINE.cardMass}</span>
          <span>μ CARD {LAB_BASELINE.cardFriction}</span>
          <span>μ FLOOR {LAB_BASELINE.floorFriction}</span>
        </div>
      </aside>

      <section className="physics-lab-canvas">
        <Canvas shadows camera={{ position: [9, 7, 11], fov: 45 }}>
          <color attach="background" args={['#dfe5ec']} />
          <ambientLight intensity={0.7} />
          <directionalLight position={[8, 14, 8]} intensity={1.25} castShadow />
          <Stats />
          <Suspense fallback={null}>
            <RapierPhysics
              key={`rapier-${scenario}-${runId}`}
              gravity={[0, -9.81, 0]}
              timeStep={slowMotion && scenario === 'flick' ? 1 / 240 : 1 / 60}
              interpolate
            >
              <RapierCcdSettings />
              <RapierLabFloor />
              {scenario === 'flick' ? (
                <FlickLabScene
                  cardSize={cardSize}
                  runId={runId}
                  preset={launchPreset}
                  tool={flickTool}
                  ammoCount={ammoCount}
                  onTelemetry={updateFlickTelemetry}
                  onMetric={updateMetric}
                  onTargetHit={setTargetHit}
                  parameters={flickParameters}
                />
              ) : (
                <RapierScenario
                  scenario={scenario}
                  cardSize={cardSize}
                  runId={runId}
                  stackCount={stackCount}
                  onMetric={updateMetric}
                />
              )}
            </RapierPhysics>
          </Suspense>
          <FpsSampler onAverage={averageFps => updateMetric({ averageFps })} />
          <OrbitControls makeDefault target={[0, 1.4, 0]} />
        </Canvas>
      </section>
    </main>
  );
};

export default PhysicsLab;
