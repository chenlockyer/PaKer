import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Edges } from '@react-three/drei';
import { ThreeEvent, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import {
  BlueprintGuideProgress,
  BlueprintGuideState,
  BlueprintTargetMatch,
  CardData,
  LiveCardTransform,
} from '../types';
import {
  findEarliestBrokenBlueprintStep,
  getBlueprintWorldCards,
  matchCardsToBlueprint,
} from '../services/blueprintService';

interface BlueprintProjectionProps {
  guide: BlueprintGuideState;
  cards: CardData[];
  liveTransformsRef: React.MutableRefObject<Map<string, LiveCardTransform>>;
  onPlaceOrigin: (origin: [number, number, number]) => void;
  onProgress: (progress: BlueprintGuideProgress) => void;
  onStepComplete: (playerCardIds: string[]) => void;
  onStepRegression: (stepIndex: number) => void;
}

const EMPTY_PROGRESS: BlueprintGuideProgress = {
  matched: 0,
  near: 0,
  total: 0,
  activeTargetId: null,
  currentStepMatched: 0,
  currentStepTotal: 0,
  currentStepPlayerCardIds: [],
  feedback: 'missing',
  complete: false,
};

const statusSignature = (matches: BlueprintTargetMatch[]) =>
  matches.map(match => `${match.targetId}:${match.status}:${match.playerCardId ?? ''}`).join('|');

const BlueprintProjection: React.FC<BlueprintProjectionProps> = ({
  guide,
  cards,
  liveTransformsRef,
  onPlaceOrigin,
  onProgress,
  onStepComplete,
  onStepRegression,
}) => {
  const [hoverOrigin, setHoverOrigin] = useState<[number, number, number]>(guide.origin);
  const [matches, setMatches] = useState<BlueprintTargetMatch[]>([]);
  const matchSampleTimeRef = useRef(0);
  const matchSignatureRef = useRef('');
  const completedStepRef = useRef<number | null>(null);
  const regressionCandidateRef = useRef<{ index: number; since: number } | null>(null);

  useEffect(() => {
    if (guide.placing) setHoverOrigin(guide.origin);
  }, [guide.origin, guide.placing]);

  const projectedGuide = useMemo(
    () => guide.placing ? { ...guide, origin: hoverOrigin } : guide,
    [guide, hoverOrigin],
  );
  const worldCards = useMemo(
    () => getBlueprintWorldCards(projectedGuide),
    [projectedGuide],
  );
  const orderedSteps = useMemo(
    () => [...guide.blueprint.steps].sort((left, right) => left.order - right.order),
    [guide.blueprint.steps],
  );
  const currentStep = orderedSteps[guide.currentStepIndex];
  const currentStepCardIds = useMemo(
    () => new Set(currentStep?.cardIds ?? worldCards.map(card => card.id)),
    [currentStep, worldCards],
  );
  const matchingOrder = useMemo(() => {
    const worldCardById = new Map(worldCards.map(card => [card.id, card]));
    const orderedIds = orderedSteps.flatMap(step => step.cardIds);
    const assignedIds = new Set(orderedIds);
    return [
      ...orderedIds.map(id => worldCardById.get(id)).filter(Boolean),
      ...worldCards.filter(card => !assignedIds.has(card.id)),
    ] as typeof worldCards;
  }, [orderedSteps, worldCards]);

  useEffect(() => {
    matchSignatureRef.current = '';
    setMatches([]);
    onProgress({
      ...EMPTY_PROGRESS,
      total: guide.blueprint.cardCount,
      activeTargetId: currentStep?.cardIds[0] ?? guide.blueprint.snapshot.cards[0]?.id ?? null,
      currentStepTotal: currentStepCardIds.size,
    });
    completedStepRef.current = null;
    regressionCandidateRef.current = null;
  }, [
    currentStep?.id,
    currentStepCardIds,
    guide.blueprint.cardCount,
    guide.blueprint.id,
    guide.blueprint.snapshot.cards,
    guide.placing,
    onProgress,
  ]);

  useFrame(({ clock }) => {
    if (guide.placing || clock.elapsedTime - matchSampleTimeRef.current < 0.15) return;
    matchSampleTimeRef.current = clock.elapsedTime;

    const next = matchCardsToBlueprint(
      matchingOrder,
      cards,
      liveTransformsRef.current,
      guide.blueprint.tolerances,
    );
    const signature = statusSignature(next);
    if (signature !== matchSignatureRef.current) {
      matchSignatureRef.current = signature;
      setMatches(next);
    }

    const matched = next.filter(item => item.status === 'matched').length;
    const near = next.filter(item => item.status === 'near').length;
    const currentMatches = next.filter(item => currentStepCardIds.has(item.targetId));
    const currentStepMatched = currentMatches.filter(item => item.status === 'matched').length;
    const activeMatch = currentMatches.find(item => item.status !== 'matched');
    const activeTargetId = activeMatch?.targetId ?? null;
    const currentStepPlayerCardIds = currentMatches
      .filter(item => item.status === 'matched' && item.playerCardId)
      .map(item => item.playerCardId as string);
    const finalStep = guide.currentStepIndex >= orderedSteps.length - 1;
    const stepComplete = currentMatches.length > 0 && currentStepMatched === currentMatches.length;
    const earliestBrokenStep = findEarliestBrokenBlueprintStep(
      orderedSteps,
      next,
      guide.currentStepIndex,
    );
    onProgress({
      matched,
      near,
      total: next.length,
      activeTargetId,
      currentStepMatched,
      currentStepTotal: currentMatches.length,
      currentStepPlayerCardIds,
      feedback: activeMatch?.feedback ?? 'correct',
      complete: finalStep && stepComplete && matched === next.length,
    });

    if (earliestBrokenStep !== null) {
      const candidate = regressionCandidateRef.current;
      if (!candidate || candidate.index !== earliestBrokenStep) {
        regressionCandidateRef.current = {
          index: earliestBrokenStep,
          since: clock.elapsedTime,
        };
      } else if (clock.elapsedTime - candidate.since >= 0.3) {
        regressionCandidateRef.current = null;
        completedStepRef.current = null;
        onStepRegression(earliestBrokenStep);
        return;
      }
    } else {
      regressionCandidateRef.current = null;
    }

    if (!stepComplete) {
      completedStepRef.current = null;
      return;
    }

    if (completedStepRef.current !== guide.currentStepIndex) {
      completedStepRef.current = guide.currentStepIndex;
      onStepComplete(currentStepPlayerCardIds);
    }
  });

  const matchByTarget = useMemo(
    () => new Map(matches.map(match => [match.targetId, match])),
    [matches],
  );
  const activeTargetId = matches.find(
    match => currentStepCardIds.has(match.targetId) && match.status !== 'matched',
  )?.targetId ?? currentStep?.cardIds[0] ?? worldCards[0]?.id ?? null;
  const dimensions = guide.blueprint.cardDimensions;

  const handlePointerMove = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    setHoverOrigin([
      Math.round(event.point.x * 10) / 10,
      0,
      Math.round(event.point.z * 10) / 10,
    ]);
  };

  const handlePlace = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    onPlaceOrigin(hoverOrigin);
  };

  return (
    <group>
      {guide.placing && (
        <mesh
          position={[0, 0.008, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          onPointerMove={handlePointerMove}
          onClick={handlePlace}
          renderOrder={20}
        >
          <planeGeometry args={[100, 100]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      )}

      {guide.visible && worldCards.map(target => {
        const match = matchByTarget.get(target.id);
        const status = match?.status ?? 'missing';
        const targetStepIndex = orderedSteps.findIndex(step => step.cardIds.includes(target.id));
        const isFuture = targetStepIndex > guide.currentStepIndex;
        const isActive = target.id === activeTargetId && status !== 'matched';
        const isCurrentStep = currentStepCardIds.has(target.id);
        if (
          (guide.assistance === 'step' && !isCurrentStep) ||
          (guide.assistance === 'minimal' && !isActive)
        ) return null;
        const color =
          status === 'matched'
            ? '#2a9b70'
            : status === 'near'
              ? '#d99a2b'
              : isActive
                ? '#3b82f6'
                : isFuture
                  ? '#9aa9ba'
                  : '#7da3cf';
        const opacity =
          status === 'matched'
            ? 0.08
            : status === 'near'
              ? 0.25
              : isActive
                ? 0.3
                : isFuture
                  ? 0.045
                  : 0.09;

        return (
          <mesh
            key={target.id}
            position={target.position}
            quaternion={target.quaternion}
            renderOrder={status === 'matched' ? 3 : 4}
          >
            <boxGeometry args={[dimensions.width, dimensions.thickness * 1.8, dimensions.height]} />
            <meshBasicMaterial
              color={color}
              transparent
              opacity={opacity}
              depthWrite={false}
              side={THREE.DoubleSide}
            />
            <Edges
              color={color}
              threshold={8}
              scale={1.002}
              renderOrder={5}
            />
          </mesh>
        );
      })}

      {guide.visible && (
        <group position={projectedGuide.origin}>
          <mesh position={[0, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={6}>
            <ringGeometry args={[0.18, 0.23, 32]} />
            <meshBasicMaterial color="#3b82f6" transparent opacity={0.75} depthWrite={false} />
          </mesh>
          <mesh position={[0, 0.014, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={6}>
            <ringGeometry args={[0.44, 0.46, 4]} />
            <meshBasicMaterial color="#3b82f6" transparent opacity={0.35} depthWrite={false} />
          </mesh>
        </group>
      )}
    </group>
  );
};

export default BlueprintProjection;
