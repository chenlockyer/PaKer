import {
  CardData,
  CardSize,
  LiveCardTransform,
} from '../types';

export const GAME_SAVE_SCHEMA_VERSION = 1;

export type GameSaveSlot = 'manual' | 'autosave';

export interface GameSaveData {
  schemaVersion: 1;
  kind: 'paker-build';
  slot: GameSaveSlot;
  savedAt: string;
  cardSize: CardSize;
  currentPresetId: string;
  isFreezeMode: boolean;
  cards: CardData[];
}

export interface GameSaveSummary {
  slot: GameSaveSlot;
  savedAt: string;
  cardCount: number;
}

export interface LoadedGameSave {
  save: GameSaveData;
  recoveredFromBackup: boolean;
}

const SLOT_KEYS: Record<GameSaveSlot, string> = {
  manual: 'paker_build_save_manual_v1',
  autosave: 'paker_build_save_auto_v1',
};

const BACKUP_SUFFIX = '_backup';

const finiteTuple = (value: unknown, length: number): value is number[] =>
  Array.isArray(value) &&
  value.length === length &&
  value.every(item => typeof item === 'number' && Number.isFinite(item));

const cloneCardAtLiveTransform = (
  card: CardData,
  transform: LiveCardTransform | undefined,
): CardData => ({
  ...card,
  position: [
    ...(transform?.position ?? card.position),
  ] as CardData['position'],
  rotation: [
    ...(transform?.rotation ?? card.rotation),
  ] as CardData['rotation'],
});

export const captureLiveCards = (
  cards: readonly CardData[],
  liveTransforms: ReadonlyMap<string, LiveCardTransform>,
): CardData[] =>
  cards.map(card => cloneCardAtLiveTransform(card, liveTransforms.get(card.id)));

export const createGameSave = ({
  slot,
  cards,
  liveTransforms,
  cardSize,
  currentPresetId,
  isFreezeMode,
  savedAt = new Date().toISOString(),
}: {
  slot: GameSaveSlot;
  cards: readonly CardData[];
  liveTransforms: ReadonlyMap<string, LiveCardTransform>;
  cardSize: CardSize;
  currentPresetId: string;
  isFreezeMode: boolean;
  savedAt?: string;
}): GameSaveData => ({
  schemaVersion: GAME_SAVE_SCHEMA_VERSION,
  kind: 'paker-build',
  slot,
  savedAt,
  cardSize,
  currentPresetId,
  isFreezeMode,
  cards: captureLiveCards(cards, liveTransforms),
});

const isCardData = (value: unknown): value is CardData => {
  if (!value || typeof value !== 'object') return false;
  const card = value as Partial<CardData>;
  return (
    typeof card.id === 'string' &&
    card.id.length > 0 &&
    finiteTuple(card.position, 3) &&
    finiteTuple(card.rotation, 3) &&
    (
      card.suit === 'spades' ||
      card.suit === 'hearts' ||
      card.suit === 'clubs' ||
      card.suit === 'diamonds'
    ) &&
    typeof card.rank === 'string' &&
    (card.color === 'red' || card.color === 'black') &&
    typeof card.locked === 'boolean'
  );
};

export const validateGameSave = (value: unknown): GameSaveData | null => {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<GameSaveData>;
  if (
    candidate.schemaVersion !== GAME_SAVE_SCHEMA_VERSION ||
    candidate.kind !== 'paker-build' ||
    (candidate.slot !== 'manual' && candidate.slot !== 'autosave') ||
    typeof candidate.savedAt !== 'string' ||
    !Number.isFinite(Date.parse(candidate.savedAt)) ||
    (candidate.cardSize !== CardSize.BRIDGE && candidate.cardSize !== CardSize.POKER) ||
    typeof candidate.currentPresetId !== 'string' ||
    typeof candidate.isFreezeMode !== 'boolean' ||
    !Array.isArray(candidate.cards) ||
    !candidate.cards.every(isCardData)
  ) {
    return null;
  }

  const ids = new Set(candidate.cards.map(card => card.id));
  if (ids.size !== candidate.cards.length) return null;

  return {
    ...candidate,
    cards: candidate.cards.map(card => cloneCardAtLiveTransform(card, undefined)),
  } as GameSaveData;
};

const parseStoredSave = (raw: string | null): GameSaveData | null => {
  if (!raw) return null;
  try {
    return validateGameSave(JSON.parse(raw));
  } catch {
    return null;
  }
};

export const persistGameSave = (
  storage: Pick<Storage, 'getItem' | 'setItem'>,
  save: GameSaveData,
) => {
  const key = SLOT_KEYS[save.slot];
  const previous = parseStoredSave(storage.getItem(key));
  if (previous) {
    storage.setItem(`${key}${BACKUP_SUFFIX}`, JSON.stringify(previous));
  }
  storage.setItem(key, JSON.stringify(save));
};

export const loadGameSaveSlot = (
  storage: Pick<Storage, 'getItem'>,
  slot: GameSaveSlot,
): LoadedGameSave | null => {
  const key = SLOT_KEYS[slot];
  const primary = parseStoredSave(storage.getItem(key));
  if (primary) return { save: primary, recoveredFromBackup: false };

  const backup = parseStoredSave(storage.getItem(`${key}${BACKUP_SUFFIX}`));
  return backup ? { save: backup, recoveredFromBackup: true } : null;
};

export const loadLatestGameSave = (
  storage: Pick<Storage, 'getItem'>,
): LoadedGameSave | null => {
  const saves = (['manual', 'autosave'] as const)
    .map(slot => loadGameSaveSlot(storage, slot))
    .filter((result): result is LoadedGameSave => result !== null);

  return saves.sort(
    (left, right) =>
      Date.parse(right.save.savedAt) - Date.parse(left.save.savedAt),
  )[0] ?? null;
};

export const getLatestGameSaveSummary = (
  storage: Pick<Storage, 'getItem'>,
): GameSaveSummary | null => {
  const loaded = loadLatestGameSave(storage);
  return loaded
    ? {
        slot: loaded.save.slot,
        savedAt: loaded.save.savedAt,
        cardCount: loaded.save.cards.length,
      }
    : null;
};
