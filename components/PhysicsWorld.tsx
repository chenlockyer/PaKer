/// <reference lib="dom" />
import React, { useState, useRef, useEffect, useLayoutEffect, useMemo, useCallback } from 'react';
import { Physics, usePlane, useSphere } from '@react-three/cannon';
import { useThree, useFrame, ThreeElements } from '@react-three/fiber';
import { TransformControls } from '@react-three/drei';
import * as THREE from 'three';
import Card from './Card';
import BlueprintProjection from './BlueprintProjection';
import {
  BlueprintGuideProgress,
  BlueprintGuideState,
  CARD_DIMENSIONS,
  CardData,
  CardSize,
  LiveCardTransform,
  RotationPreset,
  InteractionMode,
  PointerMode
} from '../types';
import { ChallengeTestType } from '../types';
import { playPlaceSound } from '../services/audioService';
import {
  InputAction,
  InputActionEvent,
  useInputAction,
} from '../input/InputContext';

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
  setPointerMode: (mode: PointerMode) => void;
  isFreezeMode: boolean;
  cards: CardData[];
  addCard: (card: CardData) => void;
  removeCard: (id: string) => void;
  updateCard: (id: string, pos: [number, number, number], rot: [number, number, number]) => void;
  draggingCardId: string | null;
  setDraggingCardId: (id: string | null) => void;
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
  onCardTransformChange: (id: string, transform: LiveCardTransform) => void;
  blueprintGuide: BlueprintGuideState | null;
  onBlueprintPlaceOrigin: (origin: [number, number, number]) => void;
  onBlueprintProgress: (progress: BlueprintGuideProgress) => void;
  onBlueprintStepComplete: (playerCardIds: string[]) => void;
  onBlueprintStepRegression: (stepIndex: number) => void;
}

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
  const [ref] = useSphere(() => ({
    mass,
    args: [radius],
    position: [0, dropHeight, 0],
    linearDamping: 0.02,
    angularDamping: 0.1,
    material: {
      friction: 0.65,
      restitution: 0.05,
    },
  }));

  return (
    <mesh ref={ref as React.RefObject<THREE.Mesh>} castShadow>
      <sphereGeometry args={[radius, 24, 16]} />
      <meshStandardMaterial color="#f97316" metalness={0.55} roughness={0.3} />
    </mesh>
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
  cardSize
}: {
  meshRef: React.RefObject<THREE.Mesh>;
  cardSize: CardSize;
}) => {
  const gridCellSize = CARD_DIMENSIONS[cardSize].width / 2;
  const gridDivisions = 100;
  const gridSize = gridCellSize * gridDivisions;
  const gridColor = 0x8492a3;

  usePlane(() => ({
    rotation: [-Math.PI / 2, 0, 0],
    position: [0, 0, 0],
    material: { friction: 1.1, restitution: 0 }
  }), meshRef);

  return (
    <mesh ref={meshRef} receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[100, 100]} />
      <shadowMaterial opacity={0.3} />
      <gridHelper
        args={[gridSize, gridDivisions, gridColor, gridColor]}
        rotation={[-Math.PI / 2, 0, 0]}
      />
    </mesh>
  );
};

// The Ghost Card follows the mouse to show where a card will be placed
const GhostCard = ({ 
  rotationPreset, 
  isFreezeMode,
  onPlace,
  floorRef,
  cardsGroupRef,
  dragMode = false,
  cardSize
}: { 
  rotationPreset: RotationPreset; 
  isFreezeMode: boolean;
  onPlace: (pos: THREE.Vector3, rot: THREE.Euler) => void;
  floorRef: React.RefObject<THREE.Mesh>;
  cardsGroupRef: React.RefObject<THREE.Group>;
  dragMode?: boolean;
  cardSize: CardSize;
}) => {
  const { camera, raycaster } = useThree();
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
  const dimensions = CARD_DIMENSIONS[cardSize];
  
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

    if (heightLockRef.current.active) {
      // While height is locked, ignore every scene surface. Project the
      // pointer directly onto a horizontal plane through the captured height
      // so crossing cards or empty gaps cannot make the ghost jump.
      heightLockPlaneRef.current.constant = -heightLockRef.current.height;
      const lockedPoint = raycaster.ray.intersectPlane(
        heightLockPlaneRef.current,
        heightLockPointRef.current
      );

      if (lockedPoint && meshRef.current) {
        meshRef.current.position.copy(lockedPoint);
        meshRef.current.rotation.copy(targetRotation);
        rotationDirtyRef.current = false;
      }
      return;
    }
    
    // OPTIMIZATION: Only intersect with floor and card meshes
    const targets: THREE.Object3D[] = [];
    if (floorRef.current) targets.push(floorRef.current);
    if (cardsGroupRef.current) targets.push(cardsGroupRef.current);

    const intersects = raycaster.intersectObjects(targets, true);
    
    // Ignore self and hidden cards
    const hit = intersects.find(i => 
      i.object !== meshRef.current && 
      i.object.type === 'Mesh' &&
      (i.object.name !== 'ghost') &&
      i.object.visible 
    );

    if (hit && hit.face) {
      // Anti-clipping projection
      const hitNormal = hit.face.normal.clone();
      hitNormal.transformDirection(hit.object.matrixWorld).normalize();

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

      if (meshRef.current) {
        meshRef.current.position.copy(newPos);
        meshRef.current.rotation.copy(targetRotation);
        rotationDirtyRef.current = false;
      }
    }
  });

  // Handle Placement Trigger
  useEffect(() => {
    const triggerPlace = () => {
      if (meshRef.current) {
        onPlace(meshRef.current.position.clone(), meshRef.current.rotation.clone());
      }
    };

    if (dragMode) {
      const handleUp = () => triggerPlace();
      window.addEventListener('pointerup', handleUp);
      return () => window.removeEventListener('pointerup', handleUp);
    } else {
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
    }
  }, [onPlace, dragMode]);

  const ghostColor = isHeightLocked
    ? 0xa855f7
    : dragMode
      ? 0x3b82f6
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
    </mesh>
  );
};

// Precision Mode component (Blender-like)
const PrecisionGhost = ({
  isFreezeMode,
  onPlace,
  cardSize
}: {
  isFreezeMode: boolean;
  onPlace: (pos: THREE.Vector3, rot: THREE.Euler) => void;
  cardSize: CardSize;
}) => {
  const [target, setTarget] = useState<THREE.Object3D | null>(null);
  const [mode, setMode] = useState<'translate' | 'rotate'>('translate');
  const targetRef = useRef<THREE.Object3D | null>(null);
  useEffect(() => { targetRef.current = target; }, [target]);
  const initialPos = useMemo(() => new THREE.Vector3(0, 1.5, 0), []);
  const dimensions = CARD_DIMENSIONS[cardSize];

  useInputAction('precision.translate', event => {
    if (event.phase === 'down') setMode('translate');
  });
  useInputAction('precision.rotate', event => {
    if (event.phase === 'down') setMode('rotate');
  });
  useInputAction('action.confirm', event => {
    if (event.phase === 'down' && targetRef.current) {
      onPlace(targetRef.current.position.clone(), targetRef.current.rotation.clone());
    }
  });

  useEffect(() => {
    const handleCustomEvent = () => {
         if (targetRef.current) {
             onPlace(targetRef.current.position.clone(), targetRef.current.rotation.clone());
          }
    };
    window.addEventListener('trigger-precision-place', handleCustomEvent);
    return () => {
        window.removeEventListener('trigger-precision-place', handleCustomEvent);
    };
  }, [onPlace]);

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
  setPointerMode,
  isFreezeMode, 
  cards, 
  addCard,
  removeCard,
  updateCard,
  draggingCardId,
  setDraggingCardId,
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
  onCardTransformChange,
  blueprintGuide,
  onBlueprintPlaceOrigin,
  onBlueprintProgress,
  onBlueprintStepComplete,
  onBlueprintStepRegression,
}) => {
  
  const draggingCardData = useMemo(() => cards.find(c => c.id === draggingCardId) || null, [cards, draggingCardId]);
  
  const floorRef = useRef<THREE.Mesh>(null);
  const cardsGroupRef = useRef<THREE.Group>(null);
  const heightSampleTimeRef = useRef(0);
  const measurementBoxRef = useRef(new THREE.Box3());
  const liveCardTransformsRef = useRef(new Map<string, LiveCardTransform>());

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

  useFrame(({ clock }) => {
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

  const handlePlaceMoved = (pos: THREE.Vector3, rot: THREE.Euler) => {
    if (draggingCardData) {
      updateCard(draggingCardData.id, [pos.x, pos.y, pos.z], [rot.x, rot.y, rot.z]);
      setDraggingCardId(null);
    }
  };

  const onCardDragStart = (card: CardData) => {
    setDraggingCardId(card.id);
  };

  const showNewCardGhost = interactionEnabled && placementEnabled && pointerMode === PointerMode.PLACE;
  const showMoveCardGhost = interactionEnabled && pointerMode === PointerMode.MOVE && !!draggingCardData;

  return (
    <Physics
      gravity={[0, -9.81, 0]}
      iterations={12}
      tolerance={0.001}
      allowSleep
      broadphase="SAP"
    >
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
      
      <Floor meshRef={floorRef} cardSize={cardSize} />
      {blueprintGuide && (
        <BlueprintProjection
          guide={blueprintGuide}
          cards={cards}
          liveTransformsRef={liveCardTransformsRef}
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
          const isDragging = draggingCardData?.id === card.id;
          return (
            <Card 
              key={`${card.id}-${cardSize}`}
              data={card} 
              pointerMode={pointerMode}
              onRemove={() => removeCard(card.id)}
              onDragStart={() => onCardDragStart(card)}
              onQuickMove={() => {
                setPointerMode(PointerMode.MOVE);
                onCardDragStart(card);
              }}
              isDragging={isDragging}
              interactionEnabled={interactionEnabled}
              windStrength={windStrength}
              cardSize={cardSize}
              onTransformChange={handleCardTransformChange}
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
          />
        ) : (
          <PrecisionGhost 
              isFreezeMode={isFreezeMode}
              onPlace={handlePlaceNew}
              cardSize={cardSize}
          />
        )
      )}

      {/* GHOST FOR MOVING EXISTING CARDS */}
      {showMoveCardGhost && (
        <GhostCard 
            rotationPreset={rotationPreset}
            isFreezeMode={isFreezeMode}
            onPlace={handlePlaceMoved}
            dragMode={true} 
            floorRef={floorRef}
            cardsGroupRef={cardsGroupRef}
            cardSize={cardSize}
        />
      )}
      
    </Physics>
  );
};

export default PhysicsWorld;
