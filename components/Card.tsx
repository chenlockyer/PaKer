import React, { useMemo, useEffect } from 'react';
import { useBox } from '@react-three/cannon';
import * as THREE from 'three';
import { CardData } from '../types';

interface CardProps {
  data: CardData;
}

// Standard Poker Card Dimensions (Scaled down slightly for scene)
// Width: 2.5 inches, Height: 3.5 inches -> Ratio 0.71
const CARD_WIDTH = 2.0;
const CARD_HEIGHT = 2.8;
const CARD_THICKNESS = 0.02; // Slightly thicker than reality for physics stability

const Card: React.FC<CardProps> = ({ data }) => {
  // Physics Body
  const [ref, api] = useBox(() => ({
    mass: data.locked ? 0 : 0.1, // 0 = Static, >0 = Dynamic
    position: data.position,
    rotation: data.rotation,
    args: [CARD_WIDTH, CARD_THICKNESS, CARD_HEIGHT],
    linearDamping: 0.5, // Air resistance to stop infinite sliding
    angularDamping: 0.5, // Resist spinning
    material: {
      friction: 0.9, // High friction is essential for stacking
      restitution: 0.0, // No bounce
    }
  }));

  // Monitor locked state to switch physics behavior
  useEffect(() => {
    if (data.locked) {
      // Make Static
      api.mass.set(0);
      api.velocity.set(0, 0, 0);
      api.angularVelocity.set(0, 0, 0);
    } else {
      // Make Dynamic
      api.mass.set(0.1);
      // Apply a tiny velocity to force the physics engine to re-evaluate the body type and wake it up
      // This fixes the bug where cards placed while locked stay locked
      api.velocity.set(0, 0.05, 0); 
      api.wakeUp();
    }
  }, [data.locked, api]);

  // Generate texture procedurally so we don't need external assets
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 358;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Border
      ctx.strokeStyle = data.color === 'red' ? '#aa0000' : '#000000';
      ctx.lineWidth = 10;
      ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);

      // Text
      ctx.fillStyle = data.color === 'red' ? '#ff0000' : '#000000';
      ctx.font = 'bold 48px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      // Rank Center
      ctx.font = 'bold 100px Arial';
      ctx.fillText(data.rank, canvas.width / 2, canvas.height / 2);

      // Corner
      ctx.font = 'bold 32px Arial';
      ctx.fillText(data.rank, 30, 50);
      ctx.fillText(data.rank, canvas.width - 30, canvas.height - 50);
    }
    return new THREE.CanvasTexture(canvas);
  }, [data.color, data.rank]);

  return (
    <mesh ref={ref as any} castShadow receiveShadow>
      <boxGeometry args={[CARD_WIDTH, CARD_THICKNESS, CARD_HEIGHT]} />
      {/* Face material */}
      <meshStandardMaterial map={texture} attach="material-2" /> 
      {/* Back material (Blue pattern simulation) */}
      <meshStandardMaterial color="#2563eb" attach="material-3" />
      {/* Side materials (Paper white) */}
      <meshStandardMaterial color="#f0f0f0" attach="material-0" />
      <meshStandardMaterial color="#f0f0f0" attach="material-1" />
      <meshStandardMaterial color="#f0f0f0" attach="material-4" />
      <meshStandardMaterial color="#f0f0f0" attach="material-5" />
    </mesh>
  );
};

export default Card;