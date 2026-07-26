/// <reference lib="dom" />
import React, { useMemo, useEffect, useState } from 'react';
import { useBox } from '@react-three/cannon';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { CARD_DIMENSIONS, CardData, CardSize, PointerMode } from '../types';
import { playCollisionSound } from '../services/audioService';

interface CardProps {
  data: CardData;
  pointerMode?: PointerMode;
  onRemove?: () => void;
  onDragStart?: () => void;
  isDragging?: boolean;
  interactionEnabled?: boolean;
  windStrength?: number;
  cardSize: CardSize;
}

const geometryCache = new Map<CardSize, THREE.BoxGeometry>();
const textureCache = new Map<string, THREE.CanvasTexture>();

const getCardGeometry = (cardSize: CardSize) => {
  const cachedGeometry = geometryCache.get(cardSize);
  if (cachedGeometry) return cachedGeometry;

  const { width, height, thickness } = CARD_DIMENSIONS[cardSize];
  const geometry = new THREE.BoxGeometry(width, thickness, height);
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
  isDragging = false,
  interactionEnabled = true,
  windStrength = 0,
  cardSize
}) => {
  // If dragging, we temporarily remove from physics/visual scene effectively
  // But we can't unmount component entirely or hook ordering changes.
  // Instead we sleep physics and hide mesh.

  const dimensions = CARD_DIMENSIONS[cardSize];
  const geometry = useMemo(() => getCardGeometry(cardSize), [cardSize]);

  const [ref, api] = useBox(() => ({
    mass: 0.1, // Always init as dynamic so we can sleep/wake it
    type: 'Dynamic',
    position: data.position,
    rotation: data.rotation,
    args: [dimensions.width, dimensions.thickness, dimensions.height],
    linearDamping: 0.5, 
    angularDamping: 0.5, 
    material: {
      friction: 1.0,
      restitution: 0.0, 
    },
    onCollide: (event: any) => {
      playCollisionSound(Math.abs(event.contact?.impactVelocity ?? 0));
    },
  }));
  const physicsPositionRef = React.useRef<[number, number, number]>(data.position);

  useEffect(
    () => api.position.subscribe(position => {
      physicsPositionRef.current = position;
    }),
    [api.position]
  );

  useFrame(({ clock }) => {
    if (windStrength <= 0 || data.locked || isDragging) return;

    const gust = windStrength * (0.8 + Math.sin(clock.elapsedTime * 2.4) * 0.2);
    const [x, y, z] = physicsPositionRef.current;
    api.applyForce(
      [gust, 0, gust * 0.18],
      [x, y + 0.65, z]
    );
    api.wakeUp();
  });

  // Effect 1: Handle Position Teleporting (Sync React State -> Physics World)
  // Only runs when dragging status changes or the defined position VALUES change (Placement/Move)
  // We decompose dependencies to avoid re-running when just 'locked' changes (which preserves physics settling)
  useEffect(() => {
    if (isDragging) {
      // Hide and disable physics while dragging (Ghost takes over)
      api.mass.set(0);
      api.velocity.set(0, 0, 0);
      api.position.set(0, -100, 0); 
      api.sleep();
    } else {
      // Teleport to the new position defined by React state
      api.position.set(data.position[0], data.position[1], data.position[2]);
      api.rotation.set(data.rotation[0], data.rotation[1], data.rotation[2]);
      
      // CRITICAL: Reset velocity to prevent "flinging" after a teleport
      // This ensures the card sits still immediately after being dropped
      api.velocity.set(0, 0, 0);
      api.angularVelocity.set(0, 0, 0);
      
      // If it's not locked, make sure it has mass and is awake
      if (!data.locked) {
        api.mass.set(0.1);
        api.wakeUp();
      }
    }
  }, [
    isDragging, 
    api, 
    // Decompose position/rotation to ensure check is on values, not object reference
    data.position[0], data.position[1], data.position[2], 
    data.rotation[0], data.rotation[1], data.rotation[2]
  ]);

  // Effect 2: Handle Locking/Freezing (State Sync)
  // Only runs when locked state changes
  useEffect(() => {
    if (isDragging) return; // Ignore if dragging (handled above)

    if (data.locked) {
      // Freeze: Make static, stop moving
      api.mass.set(0);
      api.velocity.set(0, 0, 0);
      api.angularVelocity.set(0, 0, 0);
      api.sleep(); // Disable collision checks to save performance
    } else {
      // Unfreeze: Make dynamic, wake up
      api.mass.set(0.1);
      api.wakeUp();
      // Tiny nudge to ensure physics engine activates it
      api.velocity.set(0, 0.01, 0); 
    }
  }, [data.locked, isDragging, api]);

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
    <mesh 
      ref={ref as any} 
      castShadow 
      receiveShadow={false}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
      onClick={handleClick}
      onPointerDown={handlePointerDown}
      visible={!isDragging}
    >
      <primitive object={geometry} attach="geometry" />
      <meshStandardMaterial map={texture} attach="material-2" emissive={emissiveColor} emissiveIntensity={emissiveIntensity} />
      <meshStandardMaterial color="#2563eb" attach="material-3" emissive={emissiveColor} emissiveIntensity={emissiveIntensity} />
      <meshStandardMaterial color="#f0f0f0" attach="material-0" emissive={emissiveColor} emissiveIntensity={emissiveIntensity} />
      <meshStandardMaterial color="#f0f0f0" attach="material-1" emissive={emissiveColor} emissiveIntensity={emissiveIntensity} />
      <meshStandardMaterial color="#f0f0f0" attach="material-4" emissive={emissiveColor} emissiveIntensity={emissiveIntensity} />
      <meshStandardMaterial color="#f0f0f0" attach="material-5" emissive={emissiveColor} emissiveIntensity={emissiveIntensity} />
    </mesh>
  );
};

export default React.memo(Card, (previous, next) =>
  previous.data === next.data &&
  previous.pointerMode === next.pointerMode &&
  previous.isDragging === next.isDragging &&
  previous.interactionEnabled === next.interactionEnabled &&
  previous.windStrength === next.windStrength &&
  previous.cardSize === next.cardSize
);
