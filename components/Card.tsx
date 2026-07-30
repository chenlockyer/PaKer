/// <reference lib="dom" />
import React, { useMemo, useEffect, useRef, useState } from 'react';
import {
  CoefficientCombineRule,
  CuboidCollider,
  RigidBody,
  useRapier,
  type RapierRigidBody,
} from '@react-three/rapier';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { CARD_DIMENSIONS, CardData, CardSize, LiveCardTransform, PointerMode } from '../types';
import { playCollisionSound } from '../services/audioService';

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
}

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
}) => {
  // If dragging, we temporarily remove from physics/visual scene effectively
  // But we can't unmount component entirely or hook ordering changes.
  // Instead we sleep physics and hide mesh.

  const dimensions = CARD_DIMENSIONS[cardSize];
  const geometry = useMemo(() => getCardGeometry(cardSize), [cardSize]);
  const bodyRef = useRef<RapierRigidBody>(null);
  const { rapier } = useRapier();
  const physicsPositionRef = React.useRef<[number, number, number]>(data.position);
  const physicsRotationRef = React.useRef<[number, number, number]>(data.rotation);
  const transformSampleTimeRef = React.useRef(0);

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
      body.setBodyType(
        data.locked ? rapier.RigidBodyType.Fixed : rapier.RigidBodyType.Dynamic,
        !data.locked,
      );
    }
  }, [
    data.locked,
    isDragging,
    rapier.RigidBodyType.Dynamic,
    rapier.RigidBodyType.Fixed,
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
    if (pointerMode === PointerMode.MOVE && onDragStart) {
      // Capture pointer? R3F handles this mostly, but logic is in PhysicsWorld
      onDragStart();
    }
  };

  const handleDoubleClick = (e: any) => {
    e.stopPropagation();
    if (interactionEnabled && onQuickMove) onQuickMove();
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
    <RigidBody
      ref={bodyRef}
      type={data.locked ? 'fixed' : 'dynamic'}
      colliders={false}
      position={data.position}
      rotation={data.rotation}
      linearDamping={0.5}
      angularDamping={0.5}
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
        castShadow
        receiveShadow={false}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onPointerDown={handlePointerDown}
        visible={!isDragging}
      >
        <primitive object={geometry} attach="geometry" />
        <meshStandardMaterial color="#f0f0f0" attach="material-0" emissive={emissiveColor} emissiveIntensity={emissiveIntensity} />
        <meshStandardMaterial map={texture} attach="material-1" emissive={emissiveColor} emissiveIntensity={emissiveIntensity} />
        <meshStandardMaterial color="#2563eb" attach="material-2" emissive={emissiveColor} emissiveIntensity={emissiveIntensity} />
      </mesh>
    </RigidBody>
  );
};

export default React.memo(Card, (previous, next) =>
  previous.data === next.data &&
  previous.pointerMode === next.pointerMode &&
  previous.isDragging === next.isDragging &&
  previous.interactionEnabled === next.interactionEnabled &&
  previous.windStrength === next.windStrength &&
  previous.cardSize === next.cardSize &&
  previous.onTransformChange === next.onTransformChange
);
