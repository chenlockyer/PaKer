
export interface CardData {
  id: string;
  position: [number, number, number];
  rotation: [number, number, number];
  suit: 'spades' | 'hearts' | 'clubs' | 'diamonds';
  rank: string;
  color: 'red' | 'black';
  locked: boolean;
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
