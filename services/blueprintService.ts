import * as THREE from 'three';
import {
  Blueprint,
  BlueprintBounds,
  BlueprintCategory,
  BlueprintGuideState,
  BlueprintStep,
  BlueprintTargetMatch,
  BlueprintTolerance,
  BlueprintSnapshot,
  CARD_DIMENSIONS,
  CardData,
  CardSize,
  LiveCardTransform,
} from '../types';

const BLUEPRINT_STORAGE_KEY = 'hoc_blueprints_v1';
const BLUEPRINT_SCHEMA_VERSION = 2;

export const DEFAULT_BLUEPRINT_TOLERANCE: BlueprintTolerance = {
  horizontal: 0.18,
  height: 0.12,
  rotationDegrees: 5,
  nearHorizontal: 0.42,
  nearHeight: 0.3,
  nearRotationDegrees: 18,
};

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
  status?: Blueprint['status'];
  steps?: BlueprintStep[];
  tolerances?: BlueprintTolerance;
}

export const createDefaultBlueprintSteps = (
  snapshot: BlueprintSnapshot,
): BlueprintStep[] => (
  [...snapshot.cards]
    .sort((left, right) => left.order - right.order)
    .map((card, index) => ({
      id: `step_${index + 1}_${Math.random().toString(36).slice(2, 7)}`,
      order: index,
      title: `步骤 ${index + 1}`,
      description: '',
      cardIds: [card.id],
      freezeDuringBuild: false,
      releasePhysicsAfterStep: false,
      stableSeconds: 0.35,
    }))
);

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
    status: input.status ?? 'draft',
    tolerances: input.tolerances ?? { ...DEFAULT_BLUEPRINT_TOLERANCE },
    steps: input.steps ?? createDefaultBlueprintSteps(input.snapshot),
    snapshot: input.snapshot,
  };
};

export interface BlueprintWorldCard {
  id: string;
  order: number;
  position: [number, number, number];
  quaternion: [number, number, number, number];
}

export const getBlueprintWorldCards = (
  guide: Pick<BlueprintGuideState, 'blueprint' | 'origin' | 'yaw'>,
): BlueprintWorldCard[] => {
  const origin = new THREE.Vector3(...guide.origin);
  const yawQuaternion = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(0, 1, 0),
    guide.yaw,
  );

  return guide.blueprint.snapshot.cards.map(card => {
    const position = new THREE.Vector3(...card.position)
      .applyQuaternion(yawQuaternion)
      .add(origin);
    const quaternion = yawQuaternion
      .clone()
      .multiply(new THREE.Quaternion(...card.quaternion))
      .normalize();

    return {
      id: card.id,
      order: card.order,
      position: [position.x, position.y, position.z],
      quaternion: [quaternion.x, quaternion.y, quaternion.z, quaternion.w],
    };
  });
};

const structuralAngleErrorDegrees = (
  targetQuaternion: THREE.Quaternion,
  playerQuaternion: THREE.Quaternion,
) => {
  const axes = [
    new THREE.Vector3(1, 0, 0),
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(0, 0, 1),
  ];
  let largestError = 0;

  for (const axis of axes) {
    const targetAxis = axis.clone().applyQuaternion(targetQuaternion);
    const playerAxis = axis.clone().applyQuaternion(playerQuaternion);
    const dot = THREE.MathUtils.clamp(Math.abs(targetAxis.dot(playerAxis)), -1, 1);
    largestError = Math.max(largestError, THREE.MathUtils.radToDeg(Math.acos(dot)));
  }

  return largestError;
};

export const matchCardsToBlueprint = (
  worldCards: BlueprintWorldCard[],
  cards: CardData[],
  liveTransforms: ReadonlyMap<string, LiveCardTransform>,
  tolerance: BlueprintTolerance = DEFAULT_BLUEPRINT_TOLERANCE,
): BlueprintTargetMatch[] => {
  const available = new Set(cards.map(card => card.id));
  const players = new Map(cards.map(card => {
    const transform = liveTransforms.get(card.id);
    return [
      card.id,
      {
        position: new THREE.Vector3(...(transform?.position ?? card.position)),
        quaternion: new THREE.Quaternion().setFromEuler(
          new THREE.Euler(...(transform?.rotation ?? card.rotation), 'XYZ'),
        ),
      },
    ];
  }));

  return [...worldCards]
    .sort((left, right) => left.order - right.order)
    .map(target => {
      const targetPosition = new THREE.Vector3(...target.position);
      const targetQuaternion = new THREE.Quaternion(...target.quaternion);
      let best: {
        id: string;
        score: number;
        positionError: number;
        heightError: number;
        angleError: number;
        groundedEdgeMatch: boolean;
      } | null = null;

      for (const playerId of available) {
        const player = players.get(playerId);
        if (!player) continue;
        const positionError = Math.hypot(
          targetPosition.x - player.position.x,
          targetPosition.z - player.position.z,
        );
        const heightError = Math.abs(targetPosition.y - player.position.y);
        if (positionError > tolerance.nearHorizontal * 1.5 || heightError > tolerance.nearHeight * 1.5) continue;
        const angleError = structuralAngleErrorDegrees(targetQuaternion, player.quaternion);
        const groundedEdgeMatch =
          inferGroundedEdge(targetQuaternion) === inferGroundedEdge(player.quaternion);
        const score =
          positionError / tolerance.horizontal +
          heightError / tolerance.height +
          angleError / tolerance.rotationDegrees +
          (groundedEdgeMatch ? 0 : 2);
        if (!best || score < best.score) {
          best = { id: playerId, score, positionError, heightError, angleError, groundedEdgeMatch };
        }
      }

      if (!best) {
        return {
          targetId: target.id,
          status: 'missing',
          playerCardId: null,
          positionError: null,
          angleErrorDegrees: null,
          groundedEdgeMatch: null,
          feedback: 'missing',
        };
      }

      const matched =
        best.positionError <= tolerance.horizontal &&
        best.heightError <= tolerance.height &&
        best.angleError <= tolerance.rotationDegrees &&
        best.groundedEdgeMatch;
      const near =
        best.positionError <= tolerance.nearHorizontal &&
        best.heightError <= tolerance.nearHeight &&
        best.angleError <= tolerance.nearRotationDegrees;

      if (matched || near) available.delete(best.id);

      const feedback = matched
        ? 'correct'
        : !best.groundedEdgeMatch
          ? 'groundedEdge'
          : best.heightError > tolerance.height
            ? 'height'
            : best.positionError > tolerance.horizontal
              ? 'position'
              : 'rotation';

      return {
        targetId: target.id,
        status: matched ? 'matched' : near ? 'near' : 'missing',
        playerCardId: matched || near ? best.id : null,
        positionError: best.positionError,
        angleErrorDegrees: best.angleError,
        groundedEdgeMatch: best.groundedEdgeMatch,
        feedback,
      };
    });
};

const inferGroundedEdge = (
  quaternion: THREE.Quaternion,
): 'long' | 'short' | 'none' => {
  const up = new THREE.Vector3(0, 1, 0);
  const widthAxis = new THREE.Vector3(1, 0, 0).applyQuaternion(quaternion);
  const normalAxis = new THREE.Vector3(0, 1, 0).applyQuaternion(quaternion);
  const heightAxis = new THREE.Vector3(0, 0, 1).applyQuaternion(quaternion);
  const normalVertical = Math.abs(normalAxis.dot(up));
  if (normalVertical > 0.7) return 'none';
  return Math.abs(widthAxis.dot(up)) > Math.abs(heightAxis.dot(up)) ? 'long' : 'short';
};

const validTolerance = (value: unknown): value is BlueprintTolerance => {
  if (!value || typeof value !== 'object') return false;
  const tolerance = value as Partial<BlueprintTolerance>;
  return [
    tolerance.horizontal,
    tolerance.height,
    tolerance.rotationDegrees,
    tolerance.nearHorizontal,
    tolerance.nearHeight,
    tolerance.nearRotationDegrees,
  ].every(item => typeof item === 'number' && Number.isFinite(item) && item > 0);
};

const validStep = (value: unknown): value is BlueprintStep => {
  if (!value || typeof value !== 'object') return false;
  const step = value as Partial<BlueprintStep>;
  return (
    typeof step.id === 'string' &&
    typeof step.order === 'number' &&
    typeof step.title === 'string' &&
    typeof step.description === 'string' &&
    Array.isArray(step.cardIds) &&
    step.cardIds.every(id => typeof id === 'string') &&
    typeof step.freezeDuringBuild === 'boolean' &&
    typeof step.releasePhysicsAfterStep === 'boolean' &&
    typeof step.stableSeconds === 'number' &&
    Number.isFinite(step.stableSeconds) &&
    step.stableSeconds >= 0 &&
    (!step.cameraHint ||
      (finiteTuple(step.cameraHint.position, 3) && finiteTuple(step.cameraHint.target, 3)))
  );
};

const normalizeBlueprint = (value: unknown): Blueprint | null => {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<Blueprint>;
  const schemaVersion = (value as { schemaVersion?: number }).schemaVersion;
  const validCategories: BlueprintCategory[] = [
    'tutorial',
    'architecture',
    'battle',
    'challenge',
    'experiment',
  ];
  const validCommon = (
    (schemaVersion === 1 || schemaVersion === BLUEPRINT_SCHEMA_VERSION) &&
    typeof candidate.id === 'string' &&
    typeof candidate.name === 'string' &&
    typeof candidate.description === 'string' &&
    typeof candidate.author === 'string' &&
    !!candidate.category &&
    validCategories.includes(candidate.category) &&
    Array.isArray(candidate.tags) &&
    candidate.tags.every(tag => typeof tag === 'string') &&
    (candidate.cardSize === CardSize.BRIDGE || candidate.cardSize === CardSize.POKER) &&
    !!candidate.cardDimensions &&
    typeof candidate.cardDimensions.width === 'number' &&
    typeof candidate.cardDimensions.height === 'number' &&
    typeof candidate.cardDimensions.thickness === 'number' &&
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
  if (!validCommon || !candidate.snapshot || !candidate.cardSize || !candidate.category) return null;

  const steps =
    candidate.schemaVersion === BLUEPRINT_SCHEMA_VERSION &&
    Array.isArray(candidate.steps) &&
    candidate.steps.every(validStep)
      ? candidate.steps
      : createDefaultBlueprintSteps(candidate.snapshot);

  return {
    ...(candidate as Blueprint),
    schemaVersion: BLUEPRINT_SCHEMA_VERSION,
    status: candidate.status === 'published' ? 'published' : 'draft',
    tolerances: validTolerance(candidate.tolerances)
      ? candidate.tolerances
      : { ...DEFAULT_BLUEPRINT_TOLERANCE },
    steps,
  };
};

export const loadBlueprints = (): Blueprint[] => {
  try {
    const raw = localStorage.getItem(BLUEPRINT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeBlueprint).filter((item): item is Blueprint => !!item);
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
  const blueprint = normalizeBlueprint(parsed);
  if (!blueprint) {
    throw new Error('Unsupported or damaged blueprint file');
  }
  return blueprint;
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
