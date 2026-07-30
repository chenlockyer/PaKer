/// <reference lib="dom" />
import React, { useMemo, useEffect, useRef, useState } from 'react';
import {
  CoefficientCombineRule,
  CuboidCollider,
  RigidBody,
  useRapier,
  type RapierRigidBody,
} from '@react-three/rapier';
import { type ThreeEvent, useFrame, useThree } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import * as THREE from 'three';
import {
  CARD_DIMENSIONS,
  CardData,
  CardSize,
  type LaunchGestureSample,
  type LaunchIntent,
  type LaunchRecord,
  LiveCardTransform,
  PointerMode,
} from '../types';
import { playCollisionSound } from '../services/audioService';
import { createRapierCardPhysicsHandle } from '../physics/cardPhysics';
import {
  isLaunchGesturePastDeadZone,
  resolveLaunchGesture,
  resolveLaunchImpulseMagnitude,
} from '../physics/launchGesture';

interface CardProps {
  data: CardData;
  pointerMode?: PointerMode;
  onRemove?: () => void;
  onDragStart?: () => void;
  onQuickMove?: () => void;
  isDragging?: boolean;
  interactionEnabled?: boolean;
  windStrength?: number;
  cardSize: CardSize;
  onTransformChange?: (id: string, transform: LiveCardTransform) => void;
  launchEnabled?: boolean;
  onArmForLaunch?: (id: string) => void;
  onLaunchStateChange?: (id: string, active: boolean) => void;
  onLaunch?: (record: LaunchRecord) => void;
}

interface ActiveLaunchGesture {
  sequenceId: string;
  pointerId: number;
  pointerType: LaunchIntent['pointerType'];
  contactWorld: THREE.Vector3;
  contactLocal: THREE.Vector3;
  plane: THREE.Plane;
  startWorld: THREE.Vector3;
  currentWorld: THREE.Vector3;
  samples: LaunchGestureSample[];
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

const getCardTexture = (color: CardData['color'], rank: string, cardSize: CardSize) => {
  const cacheKey = `${cardSize}:${color}:${rank}`;
  const cachedTexture = textureCache.get(cacheKey);
  if (cachedTexture) return cachedTexture;

  const { width, height } = CARD_DIMENSIONS[cardSize];
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(358 * (width / height));
  canvas.height = 358;
  const ctx = canvas.getContext('2d');
  if (ctx) {
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
  onDragStart,
  onQuickMove,
  isDragging = false,
  interactionEnabled = true,
  windStrength = 0,
  cardSize,
  onTransformChange,
  launchEnabled = false,
  onArmForLaunch,
  onLaunchStateChange,
  onLaunch,
}) => {
  // If dragging, we temporarily remove from physics/visual scene effectively
  // But we can't unmount component entirely or hook ordering changes.
  // Instead we sleep physics and hide mesh.

  const dimensions = CARD_DIMENSIONS[cardSize];
  const geometry = useMemo(() => getCardGeometry(cardSize), [cardSize]);
  const bodyRef = useRef<RapierRigidBody>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const { rapier } = useRapier();
  const { camera, size } = useThree();
  const physicsPositionRef = React.useRef<[number, number, number]>(data.position);
  const physicsRotationRef = React.useRef<[number, number, number]>(data.rotation);
  const transformSampleTimeRef = React.useRef(0);
  const launchGestureRef = useRef<ActiveLaunchGesture | null>(null);
  const launchedSequencesRef = useRef(new Set<string>());
  const launchedRef = useRef(false);
  const launchStartedAtRef = useRef(0);
  const launchStableAtRef = useRef<number | null>(null);
  const [launchPreview, setLaunchPreview] = useState<{
    contact: THREE.Vector3;
    current: THREE.Vector3;
    power: number;
  } | null>(null);

  useFrame(({ clock }) => {
    const body = bodyRef.current;
    if (!body || isDragging) return;
    const position = body.translation();
    const quaternion = body.rotation();
    const euler = new THREE.Euler().setFromQuaternion(
      new THREE.Quaternion(quaternion.x, quaternion.y, quaternion.z, quaternion.w),
      'XYZ',
    );
    physicsPositionRef.current = [position.x, position.y, position.z];
    physicsRotationRef.current = [euler.x, euler.y, euler.z];

    if (launchedRef.current) {
      const linear = body.linvel();
      const angular = body.angvel();
      const linearSpeed = Math.hypot(linear.x, linear.y, linear.z);
      const angularSpeed = Math.hypot(angular.x, angular.y, angular.z);
      const nowSeconds = performance.now() / 1000;
      if (linearSpeed < 0.08 && angularSpeed < 0.08) {
        launchStableAtRef.current ??= nowSeconds;
      } else {
        launchStableAtRef.current = null;
      }
      const settled = (
        launchStableAtRef.current != null &&
        nowSeconds - launchStableAtRef.current >= 0.5
      ) || nowSeconds - launchStartedAtRef.current >= 6;
      if (settled) {
        launchedRef.current = false;
        onLaunchStateChange?.(data.id, false);
      }
    }

    if (clock.elapsedTime - transformSampleTimeRef.current >= 0.05) {
      transformSampleTimeRef.current = clock.elapsedTime;
      onTransformChange?.(data.id, {
        position: physicsPositionRef.current,
        rotation: physicsRotationRef.current,
      });
    }

    if (windStrength <= 0 || data.locked || isDragging) return;

    const gust = windStrength * (0.8 + Math.sin(clock.elapsedTime * 2.4) * 0.2);
    const [x, y, z] = physicsPositionRef.current;
    body.addForceAtPoint(
      { x: gust, y: 0, z: gust * 0.18 },
      { x, y: y + 0.65, z },
      true,
    );
  });

  // Effect 1: Handle Position Teleporting (Sync React State -> Physics World)
  // Only runs when dragging status changes or the defined position VALUES change (Placement/Move)
  // We decompose dependencies to avoid re-running when just 'locked' changes (which preserves physics settling)
  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    if (isDragging) {
      body.setLinvel({ x: 0, y: 0, z: 0 }, false);
      body.setAngvel({ x: 0, y: 0, z: 0 }, false);
      body.setEnabled(false);
    } else {
      const quaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(...data.rotation, 'XYZ'));
      body.setEnabled(true);
      body.setTranslation({ x: data.position[0], y: data.position[1], z: data.position[2] }, false);
      body.setRotation(quaternion, false);
      body.setLinvel({ x: 0, y: 0, z: 0 }, false);
      body.setAngvel({ x: 0, y: 0, z: 0 }, false);
    }
  }, [
    isDragging,
    data.position[0], data.position[1], data.position[2], 
    data.rotation[0], data.rotation[1], data.rotation[2]
  ]);

  // Effect 2: Handle Locking/Freezing (State Sync)
  // Only runs when locked state changes
  useEffect(() => {
    const body = bodyRef.current;
    if (!body || isDragging) return;
    body.setLinvel({ x: 0, y: data.locked ? 0 : 0.01, z: 0 }, !data.locked);
    body.setAngvel({ x: 0, y: 0, z: 0 }, false);
    body.setBodyType(
      data.locked ? rapier.RigidBodyType.Fixed : rapier.RigidBodyType.Dynamic,
      !data.locked,
    );
  }, [data.locked, isDragging, rapier.RigidBodyType.Dynamic, rapier.RigidBodyType.Fixed]);

  // Texture Gen
  const texture = useMemo(
    () => getCardTexture(data.color, data.rank, cardSize),
    [data.color, data.rank, cardSize]
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

  const cancelLaunchGesture = React.useCallback(() => {
    if (!launchGestureRef.current) return;
    launchGestureRef.current = null;
    setLaunchPreview(null);
    onLaunchStateChange?.(data.id, false);
  }, [data.id, onLaunchStateChange]);

  useEffect(() => {
    window.addEventListener('blur', cancelLaunchGesture);
    return () => window.removeEventListener('blur', cancelLaunchGesture);
  }, [cancelLaunchGesture]);

  useEffect(() => {
    if (pointerMode !== PointerMode.LAUNCH) cancelLaunchGesture();
  }, [cancelLaunchGesture, pointerMode]);

  useEffect(() => () => {
    if (launchGestureRef.current || launchedRef.current) {
      onLaunchStateChange?.(data.id, false);
    }
  }, [data.id, onLaunchStateChange]);

  const sampleLaunchPointer = (
    event: ThreeEvent<PointerEvent>,
    gesture: ActiveLaunchGesture,
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

  const startLaunchGesture = (event: ThreeEvent<PointerEvent>) => {
    if (
      event.button !== 0 ||
      !launchEnabled ||
      data.locked ||
      data.role === 'core' ||
      launchGestureRef.current ||
      launchedRef.current ||
      !meshRef.current
    ) return;
    const contactWorld = event.point.clone();
    const contactLocal = meshRef.current.worldToLocal(contactWorld.clone());
    const cameraDirection = camera.getWorldDirection(new THREE.Vector3());
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(
      cameraDirection,
      contactWorld,
    );
    const pointerType = (
      event.pointerType === 'touch' || event.pointerType === 'pen'
        ? event.pointerType
        : 'mouse'
    ) as LaunchIntent['pointerType'];
    launchGestureRef.current = {
      sequenceId: crypto.randomUUID(),
      pointerId: event.pointerId,
      pointerType,
      contactWorld,
      contactLocal,
      plane,
      startWorld: contactWorld.clone(),
      currentWorld: contactWorld.clone(),
      samples: [{ x: event.clientX, y: event.clientY, time: performance.now() }],
    };
    if (data.role !== 'ammo') onArmForLaunch?.(data.id);
    onLaunchStateChange?.(data.id, true);
    setLaunchPreview({ contact: contactWorld.clone(), current: contactWorld.clone(), power: 0 });
    (event.target as unknown as { setPointerCapture?: (pointerId: number) => void })
      .setPointerCapture?.(event.pointerId);
  };

  const moveLaunchGesture = (event: ThreeEvent<PointerEvent>) => {
    const gesture = launchGestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    event.stopPropagation();
    sampleLaunchPointer(event, gesture);
  };

  const finishLaunchGesture = (event: ThreeEvent<PointerEvent>) => {
    const gesture = launchGestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    event.stopPropagation();
    const resolution = sampleLaunchPointer(event, gesture);
    launchGestureRef.current = null;
    setLaunchPreview(null);
    (event.target as unknown as { releasePointerCapture?: (pointerId: number) => void })
      .releasePointerCapture?.(event.pointerId);

    const worldDelta = gesture.currentWorld.clone().sub(gesture.startWorld);
    if (
      !isLaunchGesturePastDeadZone(gesture.samples, Math.min(size.width, size.height)) ||
      worldDelta.lengthSq() < 0.0001
    ) {
      onLaunchStateChange?.(data.id, false);
      return;
    }
    const body = bodyRef.current;
    if (!body || launchedSequencesRef.current.has(gesture.sequenceId)) {
      onLaunchStateChange?.(data.id, false);
      return;
    }
    launchedSequencesRef.current.add(gesture.sequenceId);
    const direction = worldDelta.normalize();
    const impulseMagnitude = resolveLaunchImpulseMagnitude(resolution.power, 0.25, 2.45);
    const impulse = direction.multiplyScalar(impulseMagnitude);
    const intent: LaunchIntent = {
      sequenceId: gesture.sequenceId,
      cardId: data.id,
      contactPointWorld: gesture.contactWorld.toArray(),
      contactPointLocal: gesture.contactLocal.toArray(),
      directionWorld: direction.clone().normalize().toArray(),
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
    const snapshotBefore = handle.getSnapshot();
    handle.setLocked(false);
    handle.setVelocity([0, 0, 0], [0, 0, 0]);
    handle.applyImpulseAtPoint(impulse.toArray(), gesture.contactWorld.toArray());
    onLaunch?.({
      intent,
      impulse: impulse.toArray(),
      impulseMagnitude,
      snapshotBefore,
      createdAt: Date.now(),
    });
    launchedRef.current = true;
    launchStartedAtRef.current = performance.now() / 1000;
    launchStableAtRef.current = null;
  };

  const handleClick = (e: any) => {
    e.stopPropagation();
    if (!interactionEnabled) return;
    if (pointerMode === PointerMode.DELETE && onRemove) {
      onRemove();
    }
  };

  const handlePointerDown = (e: any) => {
    e.stopPropagation();
    if (!interactionEnabled) return;
    if (pointerMode === PointerMode.LAUNCH) {
      startLaunchGesture(e as ThreeEvent<PointerEvent>);
      return;
    }
    if (pointerMode === PointerMode.MOVE && onDragStart) {
      // Capture pointer? R3F handles this mostly, but logic is in PhysicsWorld
      onDragStart();
    }
  };

  const handleDoubleClick = (e: any) => {
    e.stopPropagation();
    if (interactionEnabled && pointerMode !== PointerMode.LAUNCH && onQuickMove) onQuickMove();
  };

  // Use the original light-reactive paper material so cards retain depth and
  // do not look like flat, self-illuminated white shapes.
  let emissiveColor = 'black';
  let emissiveIntensity = 0;
  
  if (hovered && !isDragging) {
    if (pointerMode === PointerMode.DELETE) {
      emissiveColor = '#ef4444';
      emissiveIntensity = 0.6;
    } else if (pointerMode === PointerMode.MOVE) {
      emissiveColor = '#3b82f6';
      emissiveIntensity = 0.6;
    }
  }

  return (
    <>
    <RigidBody
      ref={bodyRef}
      type={data.locked ? 'fixed' : 'dynamic'}
      colliders={false}
      position={data.position}
      rotation={data.rotation}
      linearDamping={data.role === 'ammo' ? 0.08 : 0.5}
      angularDamping={data.role === 'ammo' ? 0.08 : 0.5}
      canSleep
      ccd={!data.locked}
      additionalSolverIterations={4}
    >
      <CuboidCollider
        args={[dimensions.width / 2, dimensions.thickness / 2, dimensions.height / 2]}
        mass={0.1}
        friction={1}
        frictionCombineRule={CoefficientCombineRule.Multiply}
        restitution={0}
        onContactForce={event => {
          playCollisionSound(Math.min(8, Math.abs(event.totalForceMagnitude) / 12));
        }}
      />
      <mesh
        ref={meshRef}
        castShadow
        receiveShadow={false}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onPointerDown={handlePointerDown}
        onPointerMove={moveLaunchGesture}
        onPointerUp={finishLaunchGesture}
        onPointerCancel={cancelLaunchGesture}
        visible={!isDragging}
      >
        <primitive object={geometry} attach="geometry" />
        <meshStandardMaterial color="#f0f0f0" attach="material-0" emissive={emissiveColor} emissiveIntensity={emissiveIntensity} />
        <meshStandardMaterial map={texture} attach="material-1" emissive={emissiveColor} emissiveIntensity={emissiveIntensity} />
        <meshStandardMaterial color="#2563eb" attach="material-2" emissive={emissiveColor} emissiveIntensity={emissiveIntensity} />
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
    </>
  );
};

export default React.memo(Card, (previous, next) =>
  previous.data === next.data &&
  previous.pointerMode === next.pointerMode &&
  previous.isDragging === next.isDragging &&
  previous.interactionEnabled === next.interactionEnabled &&
  previous.windStrength === next.windStrength &&
  previous.cardSize === next.cardSize &&
  previous.onTransformChange === next.onTransformChange &&
  previous.launchEnabled === next.launchEnabled &&
  previous.onArmForLaunch === next.onArmForLaunch &&
  previous.onLaunchStateChange === next.onLaunchStateChange &&
  previous.onLaunch === next.onLaunch
);
