
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

export interface Blueprint {
  schemaVersion: 1;
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
  snapshot: BlueprintSnapshot;
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
