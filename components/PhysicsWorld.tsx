import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Physics, usePlane } from '@react-three/cannon';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import Card from './Card';
import { CardData, RotationMode } from '../types';

const CARD_WIDTH = 2.0;
const CARD_HEIGHT = 2.8;

interface PhysicsWorldProps {
  rotationMode: RotationMode;
  isFreezeMode: boolean;
  cards: CardData[];
  addCard: (card: CardData) => void;
}

// The Floor component
const Floor = () => {
  const [ref] = usePlane(() => ({
    rotation: [-Math.PI / 2, 0, 0],
    position: [0, 0, 0],
    material: { friction: 1, restitution: 0 }
  }));

  return (
    <mesh ref={ref as any} receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[100, 100]} />
      <shadowMaterial opacity={0.3} />
      <gridHelper args={[100, 100, 0x444444, 0x222222]} rotation={[-Math.PI / 2, 0, 0]} />
    </mesh>
  );
};

// The Ghost Card follows the mouse to show where a card will be placed
const GhostCard = ({ 
  rotationMode, 
  isFreezeMode,
  onPlace 
}: { 
  rotationMode: RotationMode; 
  isFreezeMode: boolean;
  onPlace: (pos: THREE.Vector3, rot: THREE.Euler) => void 
}) => {
  const { camera, raycaster, scene } = useThree();
  const meshRef = useRef<THREE.Mesh>(null);
  const [position, setPosition] = useState(new THREE.Vector3(0, 0, 0));
  
  // Custom Rotation Offsets
  const [yaw, setYaw] = useState(0);   // Y-axis rotation (Spin)
  const [pitch, setPitch] = useState(0); // X-axis rotation (Tilt)
  const [roll, setRoll] = useState(0);   // Z-axis rotation (Roll)

  // Handle Input for Rotation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const ROT_SPEED = 0.1; // Radians
      switch(e.key.toLowerCase()) {
        case 'q': setYaw(y => y + ROT_SPEED); break;
        case 'e': setYaw(y => y - ROT_SPEED); break;
        case 'r': setPitch(p => p - ROT_SPEED); break; // Tilt forward
        case 'f': setPitch(p => p + ROT_SPEED); break; // Tilt back
        case 'z': setRoll(r => r - ROT_SPEED); break; // Roll left
        case 'x': setRoll(r => r + ROT_SPEED); break; // Roll right
        case ' ': setYaw(0); setPitch(0); setRoll(0); break; // Reset
      }
    };

    const handleWheel = (e: WheelEvent) => {
      // Prevent default zoom if possible
      if (Math.abs(e.deltaY) > 10) {
        const speed = 0.002;
        setYaw(y => y + e.deltaY * speed);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('wheel', handleWheel);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('wheel', handleWheel);
    };
  }, []);

  // Reset pitch/roll when mode changes
  useEffect(() => {
    setPitch(0);
    setRoll(0);
  }, [rotationMode]);

  // Calculate target rotation based on mode + offsets
  const targetRotation = useMemo(() => {
    // Order YXZ: Rotate Y (Direction) first, then X (Tilt/Pitch), then Z (Roll)
    const euler = new THREE.Euler(0, 0, 0, 'YXZ');
    
    let basePitch = 0; // X axis
    let baseRoll = 0;  // Z axis

    switch (rotationMode) {
      case RotationMode.FLAT:
        basePitch = 0;
        break;
      case RotationMode.VERTICAL_X:
        basePitch = Math.PI / 2; 
        break;
      case RotationMode.VERTICAL_Z:
        baseRoll = Math.PI / 2; 
        break;
      case RotationMode.TILTED_LEFT:
         basePitch = Math.PI / 2 - 0.35; // Tented
         break;
      case RotationMode.TILTED_RIGHT:
         basePitch = Math.PI / 2 + 0.35; // Tented
         break;
    }

    euler.x = basePitch + pitch;
    euler.y = yaw;
    euler.z = baseRoll + roll;

    return euler;
  }, [rotationMode, yaw, pitch, roll]);

  useFrame(({ mouse }) => {
    // Raycast to floor and other objects to find placement point
    raycaster.setFromCamera(mouse, camera);
    
    const intersects = raycaster.intersectObjects(scene.children, true);
    
    const hit = intersects.find(i => 
      i.object !== meshRef.current && 
      i.object.type === 'Mesh' &&
      (i.object.name !== 'ghost')
    );

    if (hit) {
      // Determine height offset based on rotation
      let yOffset = 0.02;
      const isStanding = Math.abs(targetRotation.x) > 0.5;
      const isVerticalZ = Math.abs(targetRotation.z) > 0.5;

      if (isStanding) {
          yOffset = CARD_HEIGHT / 2 * Math.sin(Math.abs(targetRotation.x));
      } else if (isVerticalZ) {
          yOffset = CARD_WIDTH / 2; 
      }

      const newPos = hit.point.clone().add(new THREE.Vector3(0, yOffset, 0));
      
      // Snap to grid slightly
      const SNAP = 0.1; 
      newPos.x = Math.round(newPos.x / SNAP) * SNAP;
      newPos.z = Math.round(newPos.z / SNAP) * SNAP;
      
      if (meshRef.current) {
        meshRef.current.position.lerp(newPos, 0.5);
        meshRef.current.rotation.copy(targetRotation);
      }
      setPosition(newPos);
    }
  });

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      // Fix: Ensure we are clicking on the canvas, not the UI
      if ((e.target as HTMLElement).tagName !== 'CANVAS') return;

      if (meshRef.current) {
        onPlace(position, targetRotation);
      }
    };
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, [position, targetRotation, onPlace]);

  return (
    <mesh ref={meshRef} name="ghost">
      <boxGeometry args={[CARD_WIDTH, 0.02, CARD_HEIGHT]} />
      {/* Change color based on Freeze Mode: Green = Normal, Cyan = Frozen */}
      <meshBasicMaterial 
        color={isFreezeMode ? 0x00ffff : 0x00ff00} 
        opacity={0.5} 
        transparent 
        wireframe 
      />
      <arrowHelper args={[new THREE.Vector3(0, 0, 1), new THREE.Vector3(0,0,0), 1.5, isFreezeMode ? 0x00ffff : 0xffff00]} />
    </mesh>
  );
};

const PhysicsWorld: React.FC<PhysicsWorldProps> = ({ rotationMode, isFreezeMode, cards, addCard }) => {
  const handlePlace = (pos: THREE.Vector3, rot: THREE.Euler) => {
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
      locked: isFreezeMode // Use current freeze mode
    });
  };

  return (
    <Physics gravity={[0, -9.81, 0]} iterations={20} tolerance={0.0001}>
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 20, 10]} intensity={1} castShadow shadow-mapSize={[2048, 2048]} />
      
      <Floor />
      
      {cards.map((card) => (
        <Card key={card.id} data={card} />
      ))}

      <GhostCard 
        rotationMode={rotationMode} 
        isFreezeMode={isFreezeMode}
        onPlace={handlePlace} 
      />
    </Physics>
  );
};

export default PhysicsWorld;