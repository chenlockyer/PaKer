
export interface CardData {
  id: string;
  position: [number, number, number];
  rotation: [number, number, number];
  suit: 'spades' | 'hearts' | 'clubs' | 'diamonds';
  rank: string;
  color: 'red' | 'black';
  locked: boolean;
}

export interface LiveCardTransform {
  position: [number, number, number];
  rotation: [number, number, number];
}

export type BlueprintCategory =
  | 'tutorial'
  | 'architecture'
  | 'battle'
  | 'challenge'
  | 'experiment';

export interface BlueprintCardData {
  id: string;
  order: number;
  position: [number, number, number];
  quaternion: [number, number, number, number];
  suit: CardData['suit'];
  rank: string;
  color: CardData['color'];
}

export interface BlueprintBounds {
  min: [number, number, number];
  max: [number, number, number];
  size: [number, number, number];
}

export interface BlueprintSnapshot {
  capturedAt: string;
  source: 'live-physics';
  originWorld: [number, number, number];
  bounds: BlueprintBounds;
  cards: BlueprintCardData[];
}

export interface BlueprintTolerance {
  horizontal: number;
  height: number;
  rotationDegrees: number;
  nearHorizontal: number;
  nearHeight: number;
  nearRotationDegrees: number;
}

export interface BlueprintCameraHint {
  position: [number, number, number];
  target: [number, number, number];
}

export interface BlueprintStep {
  id: string;
  order: number;
  title: string;
  description: string;
  cardIds: string[];
  // Retained for schema compatibility. Blueprint runtime never overrides
  // the scene-wide physics lock state.
  freezeDuringBuild: boolean;
  releasePhysicsAfterStep: boolean;
  stableSeconds: number;
  recommendedPresetId?: string;
  cameraHint?: BlueprintCameraHint;
}

export interface Blueprint {
  schemaVersion: 2;
  id: string;
  name: string;
  description: string;
  author: string;
  category: BlueprintCategory;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  cardSize: CardSize;
  cardDimensions: {
    width: number;
    height: number;
    thickness: number;
  };
  cardCount: number;
  coordinateSpace: 'structure-local';
  status: 'draft' | 'published';
  tolerances: BlueprintTolerance;
  steps: BlueprintStep[];
  snapshot: BlueprintSnapshot;
}

export interface BlueprintGuideState {
  blueprint: Blueprint;
  origin: [number, number, number];
  yaw: number;
  placing: boolean;
  visible: boolean;
  currentStepIndex: number;
}

export type BlueprintMatchStatus = 'matched' | 'near' | 'missing';
export type BlueprintFeedbackReason =
  | 'correct'
  | 'missing'
  | 'position'
  | 'height'
  | 'rotation'
  | 'groundedEdge';

export interface BlueprintTargetMatch {
  targetId: string;
  status: BlueprintMatchStatus;
  playerCardId: string | null;
  positionError: number | null;
  angleErrorDegrees: number | null;
  groundedEdgeMatch: boolean | null;
  feedback: BlueprintFeedbackReason;
}

export interface BlueprintGuideProgress {
  matched: number;
  near: number;
  total: number;
  activeTargetId: string | null;
  currentStepMatched: number;
  currentStepTotal: number;
  currentStepPlayerCardIds: string[];
  feedback: BlueprintFeedbackReason;
  complete: boolean;
}

export interface BlueprintRecordingState {
  startedAt: string;
  recordedCardIds: string[];
}

export interface RotationPreset {
  id: string;
  name: string; // Can be a translation key or raw text
  icon: string;
  shortcut: string;
  rotation: [number, number, number]; // Euler Angles [x, y, z]
}

export enum InteractionMode {
  QUICK = 'QUICK',
  PRECISION = 'PRECISION'
}

export enum PointerMode {
  PLACE = 'PLACE',
  DELETE = 'DELETE',
  MOVE = 'MOVE'
}

export enum AppState {
  MENU = 'MENU',
  GAME = 'GAME'
}

export enum GameMode {
  CHALLENGE = 'CHALLENGE',
  FREE = 'FREE'
}

export enum ChallengePhase {
  BUILDING = 'BUILDING',
  COUNTDOWN = 'COUNTDOWN',
  TESTING = 'TESTING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED'
}

export enum ChallengeTestType {
  STABILITY = 'STABILITY',
  WIND = 'WIND',
  WEIGHT_DROP = 'WEIGHT_DROP'
}

export interface ChallengeLevel {
  id: string;
  name: Record<'en' | 'zh', string>;
  description: Record<'en' | 'zh', string>;
  maxCards: number;
  minCards: number;
  heightMultiplier: number;
  testDuration: number;
  testType: ChallengeTestType;
  windStrength?: number;
  weightMass?: number;
  weightDropOffset?: number;
}

export enum CardSize {
  POKER = 'POKER',
  BRIDGE = 'BRIDGE'
}

export type AppTheme = 'blue' | 'warm' | 'dark';

export const CARD_DIMENSIONS: Record<CardSize, {
  width: number;
  height: number;
  thickness: number;
  millimeters: string;
}> = {
  [CardSize.POKER]: {
    width: 2,
    height: 2.8,
    thickness: 0.02,
    millimeters: '63 × 88 mm'
  },
  [CardSize.BRIDGE]: {
    width: 1.8,
    height: 2.8,
    thickness: 0.02,
    millimeters: '56 × 87 mm'
  }
};
