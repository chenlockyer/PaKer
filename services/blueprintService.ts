import * as THREE from 'three';
import {
  Blueprint,
  BlueprintBounds,
  BlueprintCategory,
  BlueprintSnapshot,
  CARD_DIMENSIONS,
  CardData,
  CardSize,
  LiveCardTransform,
} from '../types';

const BLUEPRINT_STORAGE_KEY = 'hoc_blueprints_v1';
const BLUEPRINT_SCHEMA_VERSION = 1;

const finiteTuple = (values: unknown, length: number): values is number[] =>
  Array.isArray(values) && values.length === length && values.every(Number.isFinite);

export const createBlueprintSnapshot = (
  cards: CardData[],
  liveTransforms: ReadonlyMap<string, LiveCardTransform>,
  cardSize: CardSize,
): BlueprintSnapshot => {
  const dimensions = CARD_DIMENSIONS[cardSize];
  const box = new THREE.Box3();
  const cardBox = new THREE.Box3();
  const center = new THREE.Vector3();
  const size = new THREE.Vector3(dimensions.width, dimensions.thickness, dimensions.height);

  const worldCards = cards.map((card, order) => {
    const transform = liveTransforms.get(card.id);
    const position = new THREE.Vector3(...(transform?.position ?? card.position));
    const rotation = new THREE.Euler(...(transform?.rotation ?? card.rotation), 'XYZ');
    const quaternion = new THREE.Quaternion().setFromEuler(rotation).normalize();
    const matrix = new THREE.Matrix4().compose(position, quaternion, new THREE.Vector3(1, 1, 1));

    cardBox.setFromCenterAndSize(new THREE.Vector3(), size).applyMatrix4(matrix);
    box.union(cardBox);

    return { card, order, position, quaternion };
  });

  if (box.isEmpty()) {
    box.min.set(0, 0, 0);
    box.max.set(0, 0, 0);
  }

  box.getCenter(center);
  const origin = new THREE.Vector3(center.x, box.min.y, center.z);
  const localBox = box.clone().translate(origin.clone().multiplyScalar(-1));
  const boundsSize = new THREE.Vector3();
  localBox.getSize(boundsSize);

  const tuple = (vector: THREE.Vector3): [number, number, number] => [
    Number(vector.x.toFixed(5)),
    Number(vector.y.toFixed(5)),
    Number(vector.z.toFixed(5)),
  ];

  const bounds: BlueprintBounds = {
    min: tuple(localBox.min),
    max: tuple(localBox.max),
    size: tuple(boundsSize),
  };

  return {
    capturedAt: new Date().toISOString(),
    source: 'live-physics',
    originWorld: tuple(origin),
    bounds,
    cards: worldCards.map(({ card, order, position, quaternion }) => {
      position.sub(origin);
      return {
        id: card.id,
        order,
        position: tuple(position),
        quaternion: [
          Number(quaternion.x.toFixed(6)),
          Number(quaternion.y.toFixed(6)),
          Number(quaternion.z.toFixed(6)),
          Number(quaternion.w.toFixed(6)),
        ],
        suit: card.suit,
        rank: card.rank,
        color: card.color,
      };
    }),
  };
};

export interface CreateBlueprintInput {
  name: string;
  description: string;
  author: string;
  category: BlueprintCategory;
  tags: string[];
  cardSize: CardSize;
  snapshot: BlueprintSnapshot;
}

export const createBlueprint = (input: CreateBlueprintInput): Blueprint => {
  const now = new Date().toISOString();
  const dimensions = CARD_DIMENSIONS[input.cardSize];
  return {
    schemaVersion: BLUEPRINT_SCHEMA_VERSION,
    id: `bp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    name: input.name.trim(),
    description: input.description.trim(),
    author: input.author.trim(),
    category: input.category,
    tags: input.tags.map(tag => tag.trim()).filter(Boolean).slice(0, 8),
    createdAt: now,
    updatedAt: now,
    cardSize: input.cardSize,
    cardDimensions: {
      width: dimensions.width,
      height: dimensions.height,
      thickness: dimensions.thickness,
    },
    cardCount: input.snapshot.cards.length,
    coordinateSpace: 'structure-local',
    snapshot: input.snapshot,
  };
};

const isBlueprint = (value: unknown): value is Blueprint => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<Blueprint>;
  const validCategories: BlueprintCategory[] = [
    'tutorial',
    'architecture',
    'battle',
    'challenge',
    'experiment',
  ];
  return (
    candidate.schemaVersion === BLUEPRINT_SCHEMA_VERSION &&
    typeof candidate.id === 'string' &&
    typeof candidate.name === 'string' &&
    typeof candidate.description === 'string' &&
    typeof candidate.author === 'string' &&
    !!candidate.category &&
    validCategories.includes(candidate.category) &&
    Array.isArray(candidate.tags) &&
    candidate.tags.every(tag => typeof tag === 'string') &&
    (candidate.cardSize === CardSize.BRIDGE || candidate.cardSize === CardSize.POKER) &&
    typeof candidate.cardCount === 'number' &&
    candidate.coordinateSpace === 'structure-local' &&
    !!candidate.snapshot &&
    candidate.snapshot.source === 'live-physics' &&
    !!candidate.snapshot.bounds &&
    finiteTuple(candidate.snapshot.bounds.min, 3) &&
    finiteTuple(candidate.snapshot.bounds.max, 3) &&
    finiteTuple(candidate.snapshot.bounds.size, 3) &&
    Array.isArray(candidate.snapshot.cards) &&
    candidate.cardCount === candidate.snapshot.cards.length &&
    candidate.snapshot.cards.every(card =>
      !!card &&
      typeof card.id === 'string' &&
      typeof card.rank === 'string' &&
      finiteTuple(card.position, 3) &&
      finiteTuple(card.quaternion, 4)
    )
  );
};

export const loadBlueprints = (): Blueprint[] => {
  try {
    const raw = localStorage.getItem(BLUEPRINT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isBlueprint);
  } catch (error) {
    console.error('Failed to load blueprints', error);
    return [];
  }
};

export const persistBlueprints = (blueprints: Blueprint[]) => {
  localStorage.setItem(BLUEPRINT_STORAGE_KEY, JSON.stringify(blueprints));
};

export const parseBlueprintFile = (content: string): Blueprint => {
  const parsed = JSON.parse(content);
  if (!isBlueprint(parsed)) {
    throw new Error('Unsupported or damaged blueprint file');
  }
  return parsed;
};

export const downloadBlueprint = (blueprint: Blueprint) => {
  const content = JSON.stringify(blueprint, null, 2);
  const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  const safeName = blueprint.name.replace(/[\\/:*?"<>|]/g, '_').slice(0, 60) || 'blueprint';
  anchor.href = url;
  anchor.download = `${safeName}.paker-blueprint.json`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
};
