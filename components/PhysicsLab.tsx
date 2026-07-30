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
  useRapier,
  type RapierRigidBody,
} from '@react-three/rapier';
import * as THREE from 'three';
import {
  CARD_DIMENSIONS,
  CardSize,
  type LaunchGestureSample,
  type LaunchIntent,
} from '../types';
import { createRapierCardPhysicsHandle } from '../physics/cardPhysics';
import {
  isLaunchGesturePastDeadZone,
  resolveLaunchGesture,
} from '../physics/launchGesture';

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
  linearSpeed: number;
  angularSpeed: number;
  status: 'ready' | 'aiming' | 'launched' | 'settled' | 'cancelled';
  intent: LaunchIntent | null;
}

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
  linearSpeed: 0,
  angularSpeed: 0,
  status: 'ready',
  intent: null,
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
    if (!body) return;
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
  onMetric,
}: {
  scenario: PhysicsLabScenario;
  cardSize: CardSize;
  runId: number;
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
    return (
      <>
        {Array.from({ length: 12 }, (_, index) => (
          <RapierLabCard
            key={`${runId}-rapier-stack-${index}`}
            cardSize={cardSize}
            position={[0, dimensions.thickness / 2 + index * (dimensions.thickness + 0.002), 0]}
          />
        ))}
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

interface ActiveFlickGesture {
  pointerId: number;
  pointerType: LaunchIntent['pointerType'];
  contactWorld: THREE.Vector3;
  contactLocal: THREE.Vector3;
  plane: THREE.Plane;
  startWorld: THREE.Vector3;
  currentWorld: THREE.Vector3;
  samples: LaunchGestureSample[];
}

const FlickAmmoCard = ({
  cardSize,
  runId,
  onGestureActive,
  onTelemetry,
  onCollision,
}: {
  cardSize: CardSize;
  runId: number;
  onGestureActive: (active: boolean) => void;
  onTelemetry: (telemetry: FlickTelemetry) => void;
  onCollision: () => void;
}) => {
  const dimensions = CARD_DIMENSIONS[cardSize];
  const bodyRef = useRef<RapierRigidBody>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const gestureRef = useRef<ActiveFlickGesture | null>(null);
  const launchedSequencesRef = useRef(new Set<string>());
  const launchTelemetryRef = useRef<FlickTelemetry>(EMPTY_FLICK_TELEMETRY);
  const launchedRef = useRef(false);
  const launchStartedAtRef = useRef(0);
  const stableStartedAtRef = useRef<number | null>(null);
  const telemetrySampleRef = useRef(0);
  const { camera, size } = useThree();
  const { rapier } = useRapier();
  const [preview, setPreview] = useState<{
    contact: THREE.Vector3;
    current: THREE.Vector3;
    power: number;
  } | null>(null);

  const cancelGesture = useCallback(() => {
    if (!gestureRef.current) return;
    gestureRef.current = null;
    setPreview(null);
    onGestureActive(false);
    onTelemetry({ ...EMPTY_FLICK_TELEMETRY, status: 'cancelled' });
  }, [onGestureActive, onTelemetry]);

  useEffect(() => {
    window.addEventListener('blur', cancelGesture);
    return () => window.removeEventListener('blur', cancelGesture);
  }, [cancelGesture]);

  useAfterPhysicsStep(() => {
    const body = bodyRef.current;
    if (!body || !launchedRef.current || telemetrySampleRef.current++ % 6 !== 0) return;
    const linear = body.linvel();
    const angular = body.angvel();
    const linearSpeed = Math.hypot(linear.x, linear.y, linear.z);
    const angularSpeed = Math.hypot(angular.x, angular.y, angular.z);
    const now = performance.now();
    if (linearSpeed < 0.08 && angularSpeed < 0.08) {
      stableStartedAtRef.current ??= now;
    } else {
      stableStartedAtRef.current = null;
    }
    const settled = (
      stableStartedAtRef.current != null && now - stableStartedAtRef.current >= 500
    ) || now - launchStartedAtRef.current >= 6000;
    if (settled) launchedRef.current = false;
    const telemetry = {
      ...launchTelemetryRef.current,
      status: settled ? 'settled' : 'launched',
      linearSpeed,
      angularSpeed,
    } satisfies FlickTelemetry;
    launchTelemetryRef.current = telemetry;
    onTelemetry(telemetry);
  });

  const samplePointer = (
    event: ThreeEvent<PointerEvent>,
    gesture: ActiveFlickGesture,
  ) => {
    const now = performance.now();
    gesture.samples.push({ x: event.clientX, y: event.clientY, time: now });
    if (gesture.samples.length > 48) gesture.samples.splice(0, gesture.samples.length - 48);
    event.ray.intersectPlane(gesture.plane, gesture.currentWorld);
    const resolution = resolveLaunchGesture(
      gesture.samples,
      Math.min(size.width, size.height),
      now,
    );
    setPreview({
      contact: gesture.contactWorld.clone(),
      current: gesture.currentWorld.clone(),
      power: resolution.power,
    });
    return resolution;
  };

  const onPointerDown = (event: ThreeEvent<PointerEvent>) => {
    if (event.button !== 0 || gestureRef.current || launchedRef.current || !meshRef.current) return;
    event.stopPropagation();
    const contactWorld = event.point.clone();
    const contactLocal = meshRef.current.worldToLocal(contactWorld.clone());
    const cameraDirection = camera.getWorldDirection(new THREE.Vector3());
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(cameraDirection, contactWorld);
    const pointerType = (
      event.pointerType === 'touch' || event.pointerType === 'pen'
        ? event.pointerType
        : 'mouse'
    ) as LaunchIntent['pointerType'];
    const gesture: ActiveFlickGesture = {
      pointerId: event.pointerId,
      pointerType,
      contactWorld,
      contactLocal,
      plane,
      startWorld: contactWorld.clone(),
      currentWorld: contactWorld.clone(),
      samples: [{ x: event.clientX, y: event.clientY, time: performance.now() }],
    };
    gestureRef.current = gesture;
    (event.target as unknown as { setPointerCapture?: (pointerId: number) => void })
      .setPointerCapture?.(event.pointerId);
    setPreview({ contact: contactWorld.clone(), current: contactWorld.clone(), power: 0 });
    onGestureActive(true);
    onTelemetry({ ...EMPTY_FLICK_TELEMETRY, status: 'aiming' });
  };

  const onPointerMove = (event: ThreeEvent<PointerEvent>) => {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    event.stopPropagation();
    const resolution = samplePointer(event, gesture);
    onTelemetry({
      ...EMPTY_FLICK_TELEMETRY,
      status: 'aiming',
      power: resolution.power,
      gestureSpeed: resolution.gestureSpeed,
    });
  };

  const finishGesture = (event: ThreeEvent<PointerEvent>) => {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    event.stopPropagation();
    const resolution = samplePointer(event, gesture);
    gestureRef.current = null;
    setPreview(null);
    onGestureActive(false);
    (event.target as unknown as { releasePointerCapture?: (pointerId: number) => void })
      .releasePointerCapture?.(event.pointerId);

    const worldDelta = gesture.currentWorld.clone().sub(gesture.startWorld);
    if (
      !isLaunchGesturePastDeadZone(gesture.samples, Math.min(size.width, size.height)) ||
      worldDelta.lengthSq() < 0.0001
    ) {
      onTelemetry({ ...EMPTY_FLICK_TELEMETRY, status: 'cancelled' });
      return;
    }

    const body = bodyRef.current;
    if (!body) return;
    const sequenceId = crypto.randomUUID();
    if (launchedSequencesRef.current.has(sequenceId)) return;
    launchedSequencesRef.current.add(sequenceId);
    const direction = worldDelta.normalize();
    const impulseMagnitude = 0.25 + resolution.power * 2.2;
    const impulse = direction.multiplyScalar(impulseMagnitude);
    const intent: LaunchIntent = {
      sequenceId,
      cardId: `physics-lab-ammo-${runId}`,
      contactPointWorld: gesture.contactWorld.toArray(),
      contactPointLocal: gesture.contactLocal.toArray(),
      directionWorld: worldDelta.clone().normalize().toArray(),
      power: resolution.power,
      gestureSpeed: resolution.gestureSpeed,
      pointerType: gesture.pointerType,
    };
    const handle = createRapierCardPhysicsHandle(body, locked => {
      body.setBodyType(
        locked ? rapier.RigidBodyType.Fixed : rapier.RigidBodyType.Dynamic,
        true,
      );
    });
    handle.setVelocity([0, 0, 0], [0, 0, 0]);
    handle.applyImpulseAtPoint(impulse.toArray(), gesture.contactWorld.toArray());
    const telemetry = {
      ...EMPTY_FLICK_TELEMETRY,
      status: 'launched',
      power: resolution.power,
      gestureSpeed: resolution.gestureSpeed,
      intent,
    } satisfies FlickTelemetry;
    launchedRef.current = true;
    launchStartedAtRef.current = performance.now();
    stableStartedAtRef.current = null;
    launchTelemetryRef.current = telemetry;
    onTelemetry(telemetry);
  };

  return (
    <>
      <RigidBody
        ref={bodyRef}
        type="dynamic"
        colliders={false}
        position={[0, 0.16, -4.5]}
        linearDamping={0.08}
        angularDamping={0.08}
        canSleep
        ccd
        additionalSolverIterations={4}
        onCollisionEnter={onCollision}
      >
        <CuboidCollider
          args={[dimensions.width / 2, dimensions.thickness / 2, dimensions.height / 2]}
          mass={0.1}
          friction={1}
          frictionCombineRule={CoefficientCombineRule.Multiply}
          restitution={0}
        />
        <mesh
          ref={meshRef}
          castShadow
          receiveShadow
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={finishGesture}
          onPointerCancel={cancelGesture}
        >
          <boxGeometry args={[dimensions.width, dimensions.thickness, dimensions.height]} />
          <meshStandardMaterial color="#fffefa" roughness={0.48} />
        </mesh>
      </RigidBody>
      {preview && (
        <group>
          <mesh position={preview.contact}>
            <sphereGeometry args={[0.09, 18, 12]} />
            <meshBasicMaterial color="#f59e0b" depthTest={false} />
          </mesh>
          <Line
            points={[preview.contact, preview.current]}
            color="#e66a2c"
            lineWidth={3}
            depthTest={false}
          />
          {Array.from({ length: 4 }, (_, index) => {
            const direction = preview.current.clone().sub(preview.contact);
            if (direction.lengthSq() > 0.0001) direction.normalize();
            const point = preview.contact.clone().add(
              direction.multiplyScalar((index + 1) * (0.35 + preview.power * 0.45)),
            );
            return (
              <mesh key={index} position={point}>
                <sphereGeometry args={[0.035 + preview.power * 0.025, 10, 8]} />
                <meshBasicMaterial color="#e66a2c" transparent opacity={0.8 - index * 0.12} />
              </mesh>
            );
          })}
        </group>
      )}
    </>
  );
};

const FlickLabScene = ({
  cardSize,
  runId,
  onGestureActive,
  onTelemetry,
  onMetric,
}: {
  cardSize: CardSize;
  runId: number;
  onGestureActive: (active: boolean) => void;
  onTelemetry: (telemetry: FlickTelemetry) => void;
  onMetric: (metric: Partial<LabMetrics>) => void;
}) => {
  const dimensions = CARD_DIMENSIONS[cardSize];
  const collisionRef = useRef(false);
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
          onCollision={recordCollision}
        />
      ))}
      <FlickAmmoCard
        cardSize={cardSize}
        runId={runId}
        onGestureActive={onGestureActive}
        onTelemetry={onTelemetry}
        onCollision={recordCollision}
      />
    </>
  );
};

const PhysicsLab: React.FC<PhysicsLabProps> = ({ lang, cardSize, onClose }) => {
  const [scenario, setScenario] = useState<PhysicsLabScenario>('drop');
  const [runId, setRunId] = useState(1);
  const [metrics, setMetrics] = useState<LabMetrics>({ ...EMPTY_METRICS, runs: 1 });
  const [gestureActive, setGestureActive] = useState(false);
  const [flickTelemetry, setFlickTelemetry] = useState<FlickTelemetry>(EMPTY_FLICK_TELEMETRY);
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

  const reset = () => {
    setRunId(value => value + 1);
    setMetrics(previous => ({ ...EMPTY_METRICS, runs: previous.runs + 1 }));
    setGestureActive(false);
    setFlickTelemetry(EMPTY_FLICK_TELEMETRY);
  };

  useEffect(() => {
    setRunId(value => value + 1);
    setMetrics({ ...EMPTY_METRICS, runs: 1 });
    setGestureActive(false);
    setFlickTelemetry(EMPTY_FLICK_TELEMETRY);
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
        <dl>
          <div><dt>RUNS</dt><dd>{metrics.runs}</dd></div>
          <div><dt>TUNNELS</dt><dd className={metrics.tunnels ? 'is-danger' : ''}>{metrics.tunnels}</dd></div>
          <div><dt>COLLISIONS</dt><dd>{metrics.collisions}</dd></div>
          <div><dt>STABLE</dt><dd>{metrics.stableSeconds?.toFixed(2) ?? '—'} s</dd></div>
          <div><dt>MAX Δ</dt><dd>{metrics.maxDisplacement.toFixed(2)}</dd></div>
          <div><dt>AVG FPS</dt><dd>{metrics.averageFps.toFixed(0)}</dd></div>
        </dl>
        {scenario === 'flick' && (
          <div className="physics-lab-telemetry">
            <span>FLICK · {flickTelemetry.status.toUpperCase()}</span>
            <strong>{Math.round(flickTelemetry.power * 100)}%</strong>
            <small>GESTURE {flickTelemetry.gestureSpeed.toFixed(0)} px/s</small>
            <small>LINEAR {flickTelemetry.linearSpeed.toFixed(2)}</small>
            <small>ANGULAR {flickTelemetry.angularSpeed.toFixed(2)}</small>
          </div>
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
              timeStep={1 / 60}
              interpolate
            >
              <RapierCcdSettings />
              <RapierLabFloor />
              {scenario === 'flick' ? (
                <FlickLabScene
                  cardSize={cardSize}
                  runId={runId}
                  onGestureActive={setGestureActive}
                  onTelemetry={setFlickTelemetry}
                  onMetric={updateMetric}
                />
              ) : (
                <RapierScenario
                  scenario={scenario}
                  cardSize={cardSize}
                  runId={runId}
                  onMetric={updateMetric}
                />
              )}
            </RapierPhysics>
          </Suspense>
          <FpsSampler onAverage={averageFps => updateMetric({ averageFps })} />
          <OrbitControls makeDefault target={[0, 1.4, 0]} enabled={!gestureActive} />
        </Canvas>
      </section>
    </main>
  );
};

export default PhysicsLab;
