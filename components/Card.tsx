/// <reference lib="dom" />
import React, { useMemo, useEffect, useRef, useState } from 'react';
import {
  CoefficientCombineRule,
  CuboidCollider,
  RigidBody,
  useRapier,
  type RapierCollider,
  type RapierRigidBody,
} from '@react-three/rapier';
import { type ThreeEvent, useFrame, useThree } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import * as THREE from 'three';
import {
  CARD_DIMENSIONS,
  CardLaunchRequest,
  CardData,
  CardRole,
  CardSize,
  type LaunchGestureSample,
  type LaunchIntent,
  type LaunchPreset,
  LiveCardTransform,
  PointerMode,
  PhysicsSettings,
} from '../types';
import { playCollisionSound } from '../services/audioService';
import {
  createRapierCardPhysicsHandle,
  type CardPhysicsHandle,
} from '../physics/cardPhysics';
import {
  isLaunchGesturePastDeadZone,
  resolveLaunchGesture,
  resolvePowerMeter,
  resolvePushImpulseMagnitude,
  resolveLaunchTarget,
} from '../physics/launchGesture';

interface CardProps {
  data: CardData;
  pointerMode?: PointerMode;
  onRemove?: () => void;
  interactionEnabled?: boolean;
  windStrength?: number;
  cardSize: CardSize;
  onTransformChange?: (id: string, transform: LiveCardTransform) => void;
  launchPreset: LaunchPreset;
  onPhysicsHandleChange?: (id: string, handle: CardPhysicsHandle | null) => void;
  onLaunchRequest?: (request: CardLaunchRequest) => void;
  physicsSettings: PhysicsSettings;
  /** Battle mode: only the active side's ammo cards may be fired. */
  launchAllowed?: boolean;
}

interface ActivePushGesture {
  sequenceId: string;
  pointerId: number;
  pointerType: LaunchIntent['pointerType'];
  contactWorld: THREE.Vector3;
  contactLocal: THREE.Vector3;
  plane: THREE.Plane;
  startWorld: THREE.Vector3;
  currentWorld: THREE.Vector3;
  samples: LaunchGestureSample[];
  captureTarget: PointerCaptureTarget;
}

interface ActiveLaunchCharge {
  sequenceId: string;
  pointerId: number;
  pointerType: LaunchIntent['pointerType'];
  startedAt: number;
  contactLocal: THREE.Vector3;
  directionLocal: THREE.Vector3;
  captureTarget: PointerCaptureTarget;
}

interface PointerCaptureTarget {
  setPointerCapture?: (pointerId: number) => void;
  releasePointerCapture?: (pointerId: number) => void;
  hasPointerCapture?: (pointerId: number) => boolean;
}

const CardLaunchPreview = ({
  contact,
  current,
  power,
  cameraQuaternion,
}: {
  contact: THREE.Vector3;
  current: THREE.Vector3;
  power: number;
  cameraQuaternion: THREE.Quaternion;
}) => {
  const direction = current.clone().sub(contact);
  const hasDirection = direction.lengthSq() > 0.0001;
  if (hasDirection) direction.normalize();
  const arrowRotation = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    hasDirection ? direction : new THREE.Vector3(0, 1, 0),
  );
  return (
    <group>
      <mesh position={contact}>
        <sphereGeometry args={[0.06, 14, 10]} />
        <meshBasicMaterial color="#f59e0b" depthTest={false} />
      </mesh>
      <mesh position={contact} quaternion={cameraQuaternion} scale={1 + power * 1.4}>
        <ringGeometry args={[0.1, 0.13, 28]} />
        <meshBasicMaterial
          color="#f59e0b"
          transparent
          opacity={0.9}
          side={THREE.DoubleSide}
          depthTest={false}
        />
      </mesh>
      <Line points={[contact, current]} color="#e66a2c" lineWidth={3} depthTest={false} />
      {hasDirection && (
        <mesh position={current} quaternion={arrowRotation}>
          <coneGeometry args={[0.08, 0.24, 14]} />
          <meshBasicMaterial color="#e66a2c" depthTest={false} />
        </mesh>
      )}
      {Array.from({ length: 3 }, (_, index) => (
        <mesh
          key={index}
          position={contact.clone().add(
            direction.clone().multiplyScalar((index + 1) * (0.3 + power * 0.42)),
          )}
        >
          <sphereGeometry args={[0.03 + power * 0.02, 8, 6]} />
          <meshBasicMaterial color="#e66a2c" transparent opacity={0.75 - index * 0.16} />
        </mesh>
      ))}
    </group>
  );
};

const LaunchChargePreview = ({
  contact,
  direction,
  power,
  cameraQuaternion,
}: {
  contact: THREE.Vector3;
  direction: THREE.Vector3;
  power: number;
  cameraQuaternion: THREE.Quaternion;
}) => {
  const end = contact.clone().add(direction.clone().multiplyScalar(0.9));
  const clampedPower = THREE.MathUtils.clamp(power, 0, 1);
  const meterWidth = 1.04;
  const fillWidth = Math.max(0.001, meterWidth * clampedPower);
  const meterLeft = -meterWidth / 2;
  const cursorX = meterLeft + meterWidth * clampedPower;
  const fillColor = `hsl(${125 - clampedPower * 70} 82% 50%)`;
  const arrowRotation = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    direction,
  );
  return (
    <group>
      <mesh position={contact}>
        <sphereGeometry args={[0.065, 14, 10]} />
        <meshBasicMaterial color="#f59e0b" depthTest={false} />
      </mesh>
      <Line points={[contact, end]} color="#e66a2c" lineWidth={4} depthTest={false} />
      <mesh position={end} quaternion={arrowRotation}>
        <coneGeometry args={[0.09, 0.26, 14]} />
        <meshBasicMaterial color="#e66a2c" depthTest={false} />
      </mesh>
      <group
        position={contact.clone().add(new THREE.Vector3(0, 0.35, 0))}
        quaternion={cameraQuaternion}
      >
        <mesh renderOrder={30}>
          <planeGeometry args={[1.16, 0.19]} />
          <meshBasicMaterial
            color="#718096"
            transparent
            opacity={0.74}
            depthTest={false}
            depthWrite={false}
          />
        </mesh>
        <mesh position={[0, 0, 0.004]} renderOrder={31}>
          <planeGeometry args={[1.1, 0.13]} />
          <meshBasicMaterial
            color="#f8fafc"
            transparent
            opacity={0.94}
            depthTest={false}
            depthWrite={false}
          />
        </mesh>
        <mesh position={[meterLeft + fillWidth / 2, 0, 0.009]} scale={[fillWidth, 1, 1]} renderOrder={32}>
          <planeGeometry args={[1, 0.085]} />
          <meshBasicMaterial
            color={fillColor}
            transparent
            opacity={1}
            depthTest={false}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
        {[-0.26, 0, 0.26].map(tickX => (
          <mesh key={tickX} position={[tickX, 0, 0.014]} renderOrder={33}>
            <planeGeometry args={[0.012, 0.072]} />
            <meshBasicMaterial
              color="#64748b"
              transparent
              opacity={0.48}
              depthTest={false}
              depthWrite={false}
            />
          </mesh>
        ))}
        <mesh position={[cursorX, 0, 0.019]} renderOrder={34}>
          <circleGeometry args={[0.082, 24]} />
          <meshBasicMaterial
            color={fillColor}
            transparent
            opacity={1}
            depthTest={false}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
        <mesh position={[cursorX, 0, 0.023]} renderOrder={35}>
          <circleGeometry args={[0.045, 20]} />
          <meshBasicMaterial
            color="#ffffff"
            transparent
            opacity={1}
            depthTest={false}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      </group>
    </group>
  );
};

const geometryCache = new Map<CardSize, THREE.BoxGeometry>();
const textureCache = new Map<string, THREE.CanvasTexture>();

const getCardGeometry = (cardSize: CardSize) => {
  const cachedGeometry = geometryCache.get(cardSize);
  if (cachedGeometry) return cachedGeometry;

  const { width, height, thickness } = CARD_DIMENSIONS[cardSize];
  const geometry = new THREE.BoxGeometry(width, thickness, height);

  // BoxGeometry normally creates one render group per face (six draw calls).
  // Reorder its index so the four thin edges share one contiguous material
  // group, leaving one group each for the front and back artwork.
  const sourceIndex = geometry.index;
  if (sourceIndex) {
    const reordered = new Uint16Array(sourceIndex.count);
    const faceOrder = [0, 1, 4, 5, 2, 3];
    faceOrder.forEach((face, outputFace) => {
      for (let index = 0; index < 6; index += 1) {
        reordered[outputFace * 6 + index] = sourceIndex.getX(face * 6 + index);
      }
    });
    geometry.setIndex(new THREE.BufferAttribute(reordered, 1));
    geometry.clearGroups();
    geometry.addGroup(0, 24, 0);
    geometry.addGroup(24, 6, 1);
    geometry.addGroup(30, 6, 2);
  }

  geometryCache.set(cardSize, geometry);
  return geometry;
};

const getCardTexture = (
  color: CardData['color'],
  rank: string,
  cardSize: CardSize,
  role?: CardRole,
) => {
  const cacheKey = `${cardSize}:${color}:${rank}:${role ?? 'plain'}`;
  const cachedTexture = textureCache.get(cacheKey);
  if (cachedTexture) return cachedTexture;

  const { width, height } = CARD_DIMENSIONS[cardSize];
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(358 * (width / height));
  canvas.height = 358;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    if (role === 'core') {
      // The core card is the win condition, so it gets its own gold face
      // instead of a suit pip: a double border and a centred crest.
      ctx.fillStyle = '#fff8e6';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = '#b45309';
      ctx.lineWidth = 16;
      ctx.strokeRect(12, 12, canvas.width - 24, canvas.height - 24);
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 6;
      ctx.strokeRect(30, 30, canvas.width - 60, canvas.height - 60);
      ctx.fillStyle = '#92400e';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = 'bold 120px Arial';
      ctx.fillText('★', canvas.width / 2, canvas.height / 2 - 18);
      ctx.font = 'bold 34px Arial';
      ctx.fillText('CORE', canvas.width / 2, canvas.height / 2 + 74);
      ctx.font = 'bold 30px Arial';
      ctx.fillText(rank, 54, 62);
      ctx.fillText(rank, canvas.width - 54, canvas.height - 62);
    } else {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = color === 'red' ? '#aa0000' : '#000000';
      ctx.lineWidth = 10;
      ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);
      ctx.fillStyle = color === 'red' ? '#ff0000' : '#000000';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = 'bold 100px Arial';
      ctx.fillText(rank, canvas.width / 2, canvas.height / 2);
      ctx.font = 'bold 32px Arial';
      ctx.fillText(rank, 30, 50);
      ctx.fillText(rank, canvas.width - 30, canvas.height - 50);
      if (role === 'ammo') {
        // A red triangle on the ammo face makes loaded cards readable from the
        // build camera without changing the card's physics at all.
        ctx.beginPath();
        ctx.moveTo(canvas.width - 62, 74);
        ctx.lineTo(canvas.width - 34, 122);
        ctx.lineTo(canvas.width - 90, 122);
        ctx.closePath();
        ctx.fillStyle = '#dc2626';
        ctx.fill();
      }
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  textureCache.set(cacheKey, texture);
  return texture;
};

const Card: React.FC<CardProps> = ({ 
  data, 
  pointerMode = PointerMode.PLACE, 
  onRemove,
  interactionEnabled = true,
  windStrength = 0,
  cardSize,
  onTransformChange,
  launchPreset,
  onPhysicsHandleChange,
  onLaunchRequest,
  physicsSettings,
  launchAllowed = true,
}) => {
  const dimensions = CARD_DIMENSIONS[cardSize];
  const geometry = useMemo(() => getCardGeometry(cardSize), [cardSize]);
  const bodyRef = useRef<RapierRigidBody>(null);
  const colliderRef = useRef<RapierCollider>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const { rapier } = useRapier();
  const { camera, size } = useThree();
  const physicsPositionRef = React.useRef<[number, number, number]>(data.position);
  const physicsRotationRef = React.useRef<[number, number, number]>(data.rotation);
  const transformSampleTimeRef = React.useRef(0);
  const pushGestureRef = useRef<ActivePushGesture | null>(null);
  const launchChargeRef = useRef<ActiveLaunchCharge | null>(null);
  const launchedSequencesRef = useRef(new Set<string>());
  const [launchPreview, setLaunchPreview] = useState<{
    contact: THREE.Vector3;
    current: THREE.Vector3;
    power: number;
  } | null>(null);
  const [chargePreview, setChargePreview] = useState<{
    contact: THREE.Vector3;
    direction: THREE.Vector3;
    power: number;
  } | null>(null);

  useFrame(({ clock }) => {
    const body = bodyRef.current;
    if (!body) return;
    const position = body.translation();
    const quaternion = body.rotation();
    const euler = new THREE.Euler().setFromQuaternion(
      new THREE.Quaternion(quaternion.x, quaternion.y, quaternion.z, quaternion.w),
      'XYZ',
    );
    physicsPositionRef.current = [position.x, position.y, position.z];
    physicsRotationRef.current = [euler.x, euler.y, euler.z];

    const charge = launchChargeRef.current;
    if (charge) {
      const quaternion = new THREE.Quaternion(
        body.rotation().x,
        body.rotation().y,
        body.rotation().z,
        body.rotation().w,
      );
      const origin = new THREE.Vector3(position.x, position.y, position.z);
      const contact = charge.contactLocal.clone().applyQuaternion(quaternion).add(origin);
      const direction = charge.directionLocal.clone().applyQuaternion(quaternion).normalize();
      setChargePreview({
        contact,
        direction,
        power: resolvePowerMeter(
          performance.now() - charge.startedAt,
          physicsSettings.meterOneWayDurationMs,
        ),
      });
    }

    if (clock.elapsedTime - transformSampleTimeRef.current >= 0.05) {
      transformSampleTimeRef.current = clock.elapsedTime;
      onTransformChange?.(data.id, {
        position: physicsPositionRef.current,
        rotation: physicsRotationRef.current,
      });
    }

    if (windStrength <= 0 || data.locked) return;

    const gust = windStrength * (0.8 + Math.sin(clock.elapsedTime * 2.4) * 0.2);
    const [x, y, z] = physicsPositionRef.current;
    // Rapier keeps user forces and torques until they are reset, so a per-frame
    // wind gust has to clear last frame's contribution first. Without this the
    // wind ramps up linearly and every wind test becomes a countdown to launch.
    body.resetForces(false);
    body.resetTorques(false);
    body.addForceAtPoint(
      { x: gust, y: 0, z: gust * 0.18 },
      { x, y: y + 0.65, z },
      true,
    );
  });

  // Sync explicit scene-state changes (new card, load, undo) into Rapier.
  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    const quaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(...data.rotation, 'XYZ'));
    body.setEnabled(true);
    body.setTranslation({ x: data.position[0], y: data.position[1], z: data.position[2] }, false);
    body.setRotation(quaternion, false);
    body.setLinvel({ x: 0, y: 0, z: 0 }, false);
    body.setAngvel({ x: 0, y: 0, z: 0 }, false);
  }, [
    data.position[0], data.position[1], data.position[2], 
    data.rotation[0], data.rotation[1], data.rotation[2]
  ]);

  // Effect 2: Handle Locking/Freezing (State Sync)
  // Only runs when locked state changes
  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    body.setLinvel({ x: 0, y: data.locked ? 0 : 0.01, z: 0 }, !data.locked);
    body.setAngvel({ x: 0, y: 0, z: 0 }, false);
    body.setBodyType(
      data.locked ? rapier.RigidBodyType.Fixed : rapier.RigidBodyType.Dynamic,
      !data.locked,
    );
  }, [data.locked, rapier.RigidBodyType.Dynamic, rapier.RigidBodyType.Fixed]);

  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    const handle = createRapierCardPhysicsHandle(body, locked => {
      body.setBodyType(
        locked ? rapier.RigidBodyType.Fixed : rapier.RigidBodyType.Dynamic,
        true,
      );
    });
    onPhysicsHandleChange?.(data.id, handle);
    return () => onPhysicsHandleChange?.(data.id, null);
  }, [
    data.id,
    onPhysicsHandleChange,
    rapier.RigidBodyType.Dynamic,
    rapier.RigidBodyType.Fixed,
  ]);

  // Texture Gen
  const texture = useMemo(
    () => getCardTexture(data.color, data.rank, cardSize, data.role),
    [data.color, data.rank, cardSize, data.role]
  );

  // Hover state
  const [hovered, setHovered] = useState(false);

  const handlePointerOver = (e: any) => {
    e.stopPropagation(); // Only highlight top card
    if (interactionEnabled && pointerMode !== PointerMode.PLACE) {
      setHovered(true);
    }
  };

  const handlePointerOut = () => {
    setHovered(false);
  };

  const cancelActiveGesture = React.useCallback(() => {
    const push = pushGestureRef.current;
    const charge = launchChargeRef.current;
    if (
      push &&
      (!push.captureTarget.hasPointerCapture || push.captureTarget.hasPointerCapture(push.pointerId))
    ) {
      push.captureTarget.releasePointerCapture?.(push.pointerId);
    }
    if (
      charge &&
      (!charge.captureTarget.hasPointerCapture || charge.captureTarget.hasPointerCapture(charge.pointerId))
    ) {
      charge.captureTarget.releasePointerCapture?.(charge.pointerId);
    }
    pushGestureRef.current = null;
    launchChargeRef.current = null;
    setLaunchPreview(null);
    setChargePreview(null);
  }, []);

  useEffect(() => {
    const cancelOnEscape = (event: KeyboardEvent) => {
      if (event.code === 'Escape') cancelActiveGesture();
    };
    window.addEventListener('blur', cancelActiveGesture);
    window.addEventListener('keydown', cancelOnEscape);
    return () => {
      window.removeEventListener('blur', cancelActiveGesture);
      window.removeEventListener('keydown', cancelOnEscape);
    };
  }, [cancelActiveGesture]);

  useEffect(() => {
    cancelActiveGesture();
  }, [cancelActiveGesture, data.locked, interactionEnabled, launchPreset, pointerMode]);

  const samplePushPointer = (
    event: ThreeEvent<PointerEvent>,
    gesture: ActivePushGesture,
  ) => {
    const now = performance.now();
    gesture.samples.push({ x: event.clientX, y: event.clientY, time: now });
    if (gesture.samples.length > 48) {
      gesture.samples.splice(0, gesture.samples.length - 48);
    }
    event.ray.intersectPlane(gesture.plane, gesture.currentWorld);
    const resolution = resolveLaunchGesture(
      gesture.samples,
      Math.min(size.width, size.height),
      now,
    );
    setLaunchPreview({
      contact: gesture.contactWorld.clone(),
      current: gesture.currentWorld.clone(),
      power: resolution.power,
    });
    return resolution;
  };

  const pointerTypeOf = (event: ThreeEvent<PointerEvent>) => (
    event.pointerType === 'touch' || event.pointerType === 'pen'
      ? event.pointerType
      : 'mouse'
  ) as LaunchIntent['pointerType'];

  const capturePointer = (event: ThreeEvent<PointerEvent>) => {
    const target = event.target as unknown as PointerCaptureTarget;
    target.setPointerCapture?.(event.pointerId);
    return target;
  };

  const releasePointer = (event: ThreeEvent<PointerEvent>) => {
    (event.target as unknown as PointerCaptureTarget).releasePointerCapture?.(event.pointerId);
  };

  const startLaunchCharge = (event: ThreeEvent<PointerEvent>) => {
    if (
      event.button !== 0 ||
      data.locked ||
      launchChargeRef.current ||
      !meshRef.current
    ) return;
    const clickLocal = meshRef.current.worldToLocal(event.point.clone());
    const target = resolveLaunchTarget(launchPreset, clickLocal.toArray(), dimensions);
    if (!target.valid) return;
    const startedAt = performance.now();
    const captureTarget = capturePointer(event);
    launchChargeRef.current = {
      sequenceId: crypto.randomUUID(),
      pointerId: event.pointerId,
      pointerType: pointerTypeOf(event),
      startedAt,
      contactLocal: new THREE.Vector3(...target.contactLocal),
      directionLocal: new THREE.Vector3(...target.directionLocal),
      captureTarget,
    };
    const body = bodyRef.current;
    const rotation = body?.rotation();
    const translation = body?.translation();
    const quaternion = rotation
      ? new THREE.Quaternion(rotation.x, rotation.y, rotation.z, rotation.w)
      : meshRef.current.getWorldQuaternion(new THREE.Quaternion());
    const origin = translation
      ? new THREE.Vector3(translation.x, translation.y, translation.z)
      : meshRef.current.getWorldPosition(new THREE.Vector3());
    setChargePreview({
      contact: new THREE.Vector3(...target.contactLocal).applyQuaternion(quaternion).add(origin),
      direction: new THREE.Vector3(...target.directionLocal).applyQuaternion(quaternion).normalize(),
      power: 0,
    });
  };

  const startPushGesture = (event: ThreeEvent<PointerEvent>) => {
    if (
      event.button !== 0 ||
      data.locked ||
      pushGestureRef.current ||
      !meshRef.current
    ) return;
    const contactWorld = event.point.clone();
    const contactLocal = meshRef.current.worldToLocal(contactWorld.clone());
    const cameraDirection = camera.getWorldDirection(new THREE.Vector3());
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(
      cameraDirection,
      contactWorld,
    );
    const captureTarget = capturePointer(event);
    pushGestureRef.current = {
      sequenceId: crypto.randomUUID(),
      pointerId: event.pointerId,
      pointerType: pointerTypeOf(event),
      contactWorld,
      contactLocal,
      plane,
      startWorld: contactWorld.clone(),
      currentWorld: contactWorld.clone(),
      samples: [{ x: event.clientX, y: event.clientY, time: performance.now() }],
      captureTarget,
    };
    setLaunchPreview({ contact: contactWorld.clone(), current: contactWorld.clone(), power: 0 });
  };

  const moveActiveGesture = (event: ThreeEvent<PointerEvent>) => {
    const charge = launchChargeRef.current;
    if (charge?.pointerId === event.pointerId) {
      return;
    }
    const gesture = pushGestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    event.stopPropagation();
    samplePushPointer(event, gesture);
  };

  const finishActiveGesture = (event: ThreeEvent<PointerEvent>) => {
    const charge = launchChargeRef.current;
    if (charge?.pointerId === event.pointerId) {
      event.stopPropagation();
      launchChargeRef.current = null;
      setChargePreview(null);
      releasePointer(event);
      if (!interactionEnabled || data.locked || pointerMode !== PointerMode.LAUNCH) return;
      if (!launchAllowed) return;
      if (launchedSequencesRef.current.has(charge.sequenceId)) return;
      launchedSequencesRef.current.add(charge.sequenceId);
      onLaunchRequest?.({
        sequenceId: charge.sequenceId,
        primaryCardId: data.id,
        preset: launchPreset,
        contactPointLocal: charge.contactLocal.toArray(),
        directionLocal: charge.directionLocal.toArray(),
        meterPower: resolvePowerMeter(
          performance.now() - charge.startedAt,
          physicsSettings.meterOneWayDurationMs,
        ),
        pointerType: charge.pointerType,
      });
      return;
    }

    const gesture = pushGestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    event.stopPropagation();
    const resolution = samplePushPointer(event, gesture);
    pushGestureRef.current = null;
    setLaunchPreview(null);
    releasePointer(event);
    if (!interactionEnabled || data.locked || pointerMode !== PointerMode.PUSH) return;
    const worldDelta = gesture.currentWorld.clone().sub(gesture.startWorld);
    if (
      !isLaunchGesturePastDeadZone(gesture.samples, Math.min(size.width, size.height)) ||
      worldDelta.lengthSq() < 0.0001
    ) return;
    const body = bodyRef.current;
    if (!body || launchedSequencesRef.current.has(gesture.sequenceId)) return;
    launchedSequencesRef.current.add(gesture.sequenceId);
    const direction = worldDelta.normalize();
    const impulseMagnitude = resolvePushImpulseMagnitude(
      resolution.rawPower,
      undefined,
      physicsSettings.pushMaximumImpulse,
    );
    const impulse = direction.multiplyScalar(impulseMagnitude);
    const handle = createRapierCardPhysicsHandle(body, locked => {
      body.setBodyType(
        locked ? rapier.RigidBodyType.Fixed : rapier.RigidBodyType.Dynamic,
        true,
      );
    });
    handle.applyImpulseAtPoint(impulse.toArray(), gesture.contactWorld.toArray());
  };

  useEffect(() => {
    const collider = colliderRef.current;
    if (!collider) return;
    collider.setMass(physicsSettings.cardMass);
    collider.setFriction(physicsSettings.cardFriction);
    if (!data.locked) bodyRef.current?.wakeUp();
  }, [data.locked, physicsSettings.cardFriction, physicsSettings.cardMass]);

  const handleClick = (e: any) => {
    e.stopPropagation();
    if (!interactionEnabled) return;
    if (pointerMode === PointerMode.DELETE && onRemove) {
      onRemove();
    }
  };

  const handlePointerDown = (e: any) => {
    if (!interactionEnabled || e.button !== 0) return;
    if (pointerMode === PointerMode.LAUNCH) {
      if (!launchAllowed) return;
      e.stopPropagation();
      startLaunchCharge(e as ThreeEvent<PointerEvent>);
      return;
    }
    if (pointerMode === PointerMode.PUSH) {
      e.stopPropagation();
      startPushGesture(e as ThreeEvent<PointerEvent>);
    }
  };

  // Use the original light-reactive paper material so cards retain depth and
  // do not look like flat, self-illuminated white shapes.
  let emissiveColor = data.role === 'core' ? '#b45309' : 'black';
  let emissiveIntensity = data.role === 'core' ? 0.22 : 0;

  if (hovered) {
    if (pointerMode === PointerMode.DELETE) {
      emissiveColor = '#ef4444';
      emissiveIntensity = 0.6;
    } else if (pointerMode === PointerMode.PUSH) {
      emissiveColor = '#3b82f6';
      emissiveIntensity = 0.6;
    } else if (pointerMode === PointerMode.LAUNCH && !launchAllowed) {
      emissiveColor = '#f97316';
      emissiveIntensity = 0.45;
    }
  }

  const backColor = data.role === 'core'
    ? '#b45309'
    : data.role === 'ammo' ? '#b91c1c' : '#2563eb';

  return (
    <>
    <RigidBody
      ref={bodyRef}
      type={data.locked ? 'fixed' : 'dynamic'}
      colliders={false}
      position={data.position}
      rotation={data.rotation}
      linearDamping={physicsSettings.structureLinearDamping}
      angularDamping={physicsSettings.structureAngularDamping}
      canSleep
      ccd={!data.locked}
      additionalSolverIterations={4}
    >
      <CuboidCollider
        ref={colliderRef}
        args={[dimensions.width / 2, dimensions.thickness / 2, dimensions.height / 2]}
        mass={physicsSettings.cardMass}
        friction={physicsSettings.cardFriction}
        frictionCombineRule={CoefficientCombineRule.Multiply}
        restitution={0}
        onContactForce={event => {
          playCollisionSound(Math.min(8, Math.abs(event.totalForceMagnitude) / 12));
        }}
      />
      <mesh
        ref={meshRef}
        name="card-surface"
        castShadow
        receiveShadow={false}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
        onClick={handleClick}
        onPointerDown={handlePointerDown}
        onPointerMove={moveActiveGesture}
        onPointerUp={finishActiveGesture}
        onPointerCancel={cancelActiveGesture}
        onLostPointerCapture={cancelActiveGesture}
      >
        <primitive object={geometry} attach="geometry" />
        <meshStandardMaterial color="#f0f0f0" attach="material-0" emissive={emissiveColor} emissiveIntensity={emissiveIntensity} />
        <meshStandardMaterial map={texture} attach="material-1" emissive={emissiveColor} emissiveIntensity={emissiveIntensity} />
        <meshStandardMaterial color={backColor} attach="material-2" emissive={emissiveColor} emissiveIntensity={emissiveIntensity} />
      </mesh>
    </RigidBody>
    {launchPreview && (
      <CardLaunchPreview
        contact={launchPreview.contact}
        current={launchPreview.current}
        power={launchPreview.power}
        cameraQuaternion={camera.quaternion}
      />
    )}
    {chargePreview && (
      <LaunchChargePreview
        contact={chargePreview.contact}
        direction={chargePreview.direction}
        power={chargePreview.power}
        cameraQuaternion={camera.quaternion}
      />
    )}
    </>
  );
};

export default React.memo(Card, (previous, next) =>
  previous.data === next.data &&
  previous.pointerMode === next.pointerMode &&
  previous.interactionEnabled === next.interactionEnabled &&
  previous.windStrength === next.windStrength &&
  previous.cardSize === next.cardSize &&
  previous.onTransformChange === next.onTransformChange &&
  previous.launchPreset === next.launchPreset &&
  previous.physicsSettings === next.physicsSettings &&
  previous.onPhysicsHandleChange === next.onPhysicsHandleChange &&
  previous.onLaunchRequest === next.onLaunchRequest &&
  previous.launchAllowed === next.launchAllowed
);
