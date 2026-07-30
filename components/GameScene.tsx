
/// <reference types="vite/client" />
import React, { Suspense, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, PerformanceMonitor, Sky, Stats } from '@react-three/drei';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import PhysicsWorld from './PhysicsWorld';
import {
  AppTheme,
  BlueprintGuideProgress,
  BlueprintGuideState,
  BlueprintCameraHint,
  CardData,
  CardRole,
  CardSize,
  LaunchRecord,
  LiveCardTransform,
  RotationPreset,
  InteractionMode,
  PointerMode,
} from '../types';
import { ChallengeTestType } from '../types';

interface GameSceneProps {
  rotationPreset: RotationPreset;
  interactionMode: InteractionMode;
  pointerMode: PointerMode;
  setPointerMode: (mode: PointerMode) => void;
  isFreezeMode: boolean;
  cards: CardData[];
  addCard: (card: CardData) => void;
  removeCard: (id: string) => void;
  updateCard: (id: string, pos: [number, number, number], rot: [number, number, number]) => void;
  setCardRole: (id: string, role: CardRole) => void;
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
  theme: AppTheme;
  onCardTransformChange: (id: string, transform: LiveCardTransform) => void;
  onCardLaunch: (record: LaunchRecord) => void;
  blueprintGuide: BlueprintGuideState | null;
  onBlueprintPlaceOrigin: (origin: [number, number, number]) => void;
  onBlueprintProgress: (progress: BlueprintGuideProgress) => void;
  onBlueprintStepComplete: (playerCardIds: string[]) => void;
  onBlueprintStepRegression: (stepIndex: number) => void;
  onCameraHintChange: (hint: BlueprintCameraHint) => void;
}

class SceneErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error('3D scene failed to render', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="scene-fallback">
          <strong>3D 场景暂时无法渲染</strong>
          <span>请刷新页面或检查浏览器是否启用了硬件加速。</span>
        </div>
      );
    }
    return this.props.children;
  }
}

const LocalEnvironment = () => {
  const { gl, scene } = useThree();

  useEffect(() => {
    const generator = new THREE.PMREMGenerator(gl);
    generator.compileEquirectangularShader();

    const room = new RoomEnvironment();
    const environment = generator.fromScene(room, 0.04).texture;
    const previousEnvironment = scene.environment;
    scene.environment = environment;

    room.dispose();
    generator.dispose();

    return () => {
      scene.environment = previousEnvironment;
      environment.dispose();
    };
  }, [gl, scene]);

  return null;
};

const CameraBridge = ({
  guide,
  onCameraHintChange,
}: {
  guide: BlueprintGuideState | null;
  onCameraHintChange: (hint: BlueprintCameraHint) => void;
}) => {
  const { camera, controls } = useThree();
  const sampleTimeRef = React.useRef(0);
  const lastStepRef = React.useRef<string | null>(null);
  const transitionRef = React.useRef<{
    elapsed: number;
    duration: number;
    fromPosition: THREE.Vector3;
    toPosition: THREE.Vector3;
    fromTarget: THREE.Vector3;
    toTarget: THREE.Vector3;
  } | null>(null);

  useFrame(({ clock }, delta) => {
    const orderedSteps = guide
      ? [...guide.blueprint.steps].sort((left, right) => left.order - right.order)
      : [];
    const activeStep = guide ? orderedSteps[guide.currentStepIndex] : undefined;
    const cameraHintKey = activeStep && guide
      ? `${activeStep.id}:${guide.origin.join(',')}:${guide.yaw}`
      : null;

    if (activeStep && cameraHintKey && lastStepRef.current !== cameraHintKey) {
      lastStepRef.current = cameraHintKey;
      if (!activeStep.cameraHint) {
        transitionRef.current = null;
      } else {
        const orbitControls = controls as { target?: THREE.Vector3; update?: () => void } | null;
        if (!orbitControls?.target) return;
        const yaw = new THREE.Quaternion().setFromAxisAngle(
          new THREE.Vector3(0, 1, 0),
          guide?.yaw ?? 0,
        );
        const origin = new THREE.Vector3(...(guide?.origin ?? [0, 0, 0]));
        const cameraPosition = new THREE.Vector3(...activeStep.cameraHint.position)
          .applyQuaternion(yaw)
          .add(origin);
        const cameraTarget = new THREE.Vector3(...activeStep.cameraHint.target)
          .applyQuaternion(yaw)
          .add(origin);
        transitionRef.current = {
          elapsed: 0,
          duration: 0.8,
          fromPosition: camera.position.clone(),
          toPosition: cameraPosition,
          fromTarget: orbitControls.target.clone(),
          toTarget: cameraTarget,
        };
      }
    } else if (!activeStep) {
      lastStepRef.current = null;
      transitionRef.current = null;
    }

    const transition = transitionRef.current;
    const orbitControls = controls as { target?: THREE.Vector3; update?: () => void } | null;
    if (transition && orbitControls?.target) {
      transition.elapsed = Math.min(transition.duration, transition.elapsed + delta);
      const linearProgress = transition.elapsed / transition.duration;
      const easedProgress = linearProgress < 0.5
        ? 4 * linearProgress * linearProgress * linearProgress
        : 1 - Math.pow(-2 * linearProgress + 2, 3) / 2;
      camera.position.lerpVectors(
        transition.fromPosition,
        transition.toPosition,
        easedProgress,
      );
      orbitControls.target.lerpVectors(
        transition.fromTarget,
        transition.toTarget,
        easedProgress,
      );
      orbitControls.update?.();
      if (linearProgress >= 1) transitionRef.current = null;
    }

    if (clock.elapsedTime - sampleTimeRef.current < 0.25) return;
    sampleTimeRef.current = clock.elapsedTime;
    const orbitTarget = (controls as { target?: THREE.Vector3 } | null)?.target;
    onCameraHintChange({
      position: [camera.position.x, camera.position.y, camera.position.z],
      target: orbitTarget
        ? [orbitTarget.x, orbitTarget.y, orbitTarget.z]
        : [0, 0, 0],
    });
  });

  return null;
};

const GameScene: React.FC<GameSceneProps> = ({ 
  rotationPreset, 
  interactionMode, 
  pointerMode,
  setPointerMode,
  isFreezeMode, 
  cards, 
  addCard,
  removeCard,
  updateCard,
  setCardRole,
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
  theme,
  onCardTransformChange,
  onCardLaunch,
  blueprintGuide,
  onBlueprintPlaceOrigin,
  onBlueprintProgress,
  onBlueprintStepComplete,
  onBlueprintStepRegression,
  onCameraHintChange,
}) => {
  const background = theme === 'dark' ? '#171d24' : theme === 'warm' ? '#e9e6df' : '#e4e9ef';
  const nativeDpr = Math.min(window.devicePixelRatio || 1, 1.5);
  const minimumDpr = Math.min(nativeDpr, 0.75);
  const [renderDpr, setRenderDpr] = React.useState(nativeDpr);
  const [launchBusy, setLaunchBusy] = React.useState(false);

  useEffect(() => {
    const nextNativeDpr = Math.min(window.devicePixelRatio || 1, 1.5);
    setRenderDpr(nextNativeDpr);
  }, []);

  return (
    <div
      className="game-canvas"
      style={{ background }}
      onContextMenu={event => event.preventDefault()}
      onAuxClick={event => event.preventDefault()}
    >
      <SceneErrorBoundary>
        <Canvas
          shadows
          dpr={renderDpr}
          gl={{ powerPreference: 'high-performance', antialias: true }}
          camera={{ position: [0, 8, 12], fov: 45 }}
        >
          {import.meta.env.DEV && <Stats />}
          <PerformanceMonitor
            factor={1}
            step={0.15}
            bounds={() => [57, 60]}
            flipflops={5}
            onChange={({ factor }) => {
              const nextDpr = minimumDpr + (nativeDpr - minimumDpr) * factor;
              setRenderDpr(Number(nextDpr.toFixed(2)));
            }}
            onFallback={() => setRenderDpr(minimumDpr)}
          />
          <Suspense fallback={null}>
            <Sky sunPosition={[100, 20, 100]} />
            <LocalEnvironment />
            <CameraBridge guide={blueprintGuide} onCameraHintChange={onCameraHintChange} />

            <PhysicsWorld
              rotationPreset={rotationPreset}
              interactionMode={interactionMode}
              pointerMode={pointerMode}
              setPointerMode={setPointerMode}
              isFreezeMode={isFreezeMode}
              cards={cards}
              addCard={addCard}
              removeCard={removeCard}
              updateCard={updateCard}
              setCardRole={setCardRole}
              draggingCardId={draggingCardId}
              setDraggingCardId={setDraggingCardId}
              interactionEnabled={interactionEnabled}
              placementEnabled={placementEnabled}
              windStrength={windStrength}
              onHeightChange={onHeightChange}
              showTargetGuide={showTargetGuide}
              targetHeight={targetHeight}
              cardSize={cardSize}
              testType={testType}
              testActive={testActive}
              weightMass={weightMass}
              weightDropHeight={weightDropHeight}
              onCardTransformChange={onCardTransformChange}
              onCardLaunch={onCardLaunch}
              onLaunchBusyChange={setLaunchBusy}
              blueprintGuide={blueprintGuide}
              onBlueprintPlaceOrigin={onBlueprintPlaceOrigin}
              onBlueprintProgress={onBlueprintProgress}
              onBlueprintStepComplete={onBlueprintStepComplete}
              onBlueprintStepRegression={onBlueprintStepRegression}
            />

            <OrbitControls
              makeDefault
              minPolarAngle={0}
              maxPolarAngle={Math.PI / 2 - 0.1}
              dampingFactor={0.05}
              enabled={!draggingCardId && !launchBusy}
              mouseButtons={{
                LEFT: -1 as THREE.MOUSE,
                MIDDLE: THREE.MOUSE.PAN,
                RIGHT: THREE.MOUSE.ROTATE,
              }}
            />
          </Suspense>
        </Canvas>
      </SceneErrorBoundary>
    </div>
  );
};

export default GameScene;
