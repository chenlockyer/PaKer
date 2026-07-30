import {
  CardData,
  CardSize,
  LiveCardTransform,
} from '../types';

export const GAME_SAVE_SCHEMA_VERSION = 2;

export type GameSaveSource = 'manual' | 'autosave';

export interface GameSaveData {
  schemaVersion: 2;
  kind: 'paker-build';
  id: string;
  name: string;
  source: GameSaveSource;
  savedAt: string;
  cardSize: CardSize;
  currentPresetId: string;
  isFreezeMode: boolean;
  cards: CardData[];
}

export interface GameSaveSummary {
  id: string;
  name: string;
  source: GameSaveSource;
  savedAt: string;
  cardCount: number;
  cardSize: CardSize;
}

export interface GameSaveLibrary {
  manualSaves: GameSaveData[];
  autosave: GameSaveData | null;
  recoveredManualBackup: boolean;
  recoveredAutosaveBackup: boolean;
}

const MANUAL_LIBRARY_KEY = 'paker_build_save_library_v2';
const AUTOSAVE_KEY = 'paker_build_autosave_v2';
const BACKUP_SUFFIX = '_backup';

type ReadStorage = Pick<Storage, 'getItem'>;
type WriteStorage = Pick<Storage, 'getItem' | 'setItem'>;
type MutableStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const finiteTuple = (value: unknown, length: number): value is number[] =>
  Array.isArray(value) &&
  value.length === length &&
  value.every(item => typeof item === 'number' && Number.isFinite(item));

const cloneCardAtLiveTransform = (
  card: CardData,
  transform: LiveCardTransform | undefined,
): CardData => {
  const livePosition = finiteTuple(transform?.position, 3)
    ? transform.position
    : card.position;
  const liveRotation = finiteTuple(transform?.rotation, 3)
    ? transform.rotation
    : card.rotation;
  return {
    ...card,
    position: [...livePosition] as CardData['position'],
    rotation: [...liveRotation] as CardData['rotation'],
  };
};

const createId = () =>
  globalThis.crypto?.randomUUID?.() ??
  `save-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;

const normalizeName = (name: string, fallback: string) =>
  name.trim().replace(/\s+/g, ' ').slice(0, 40) || fallback;

export const captureLiveCards = (
  cards: readonly CardData[],
  liveTransforms: ReadonlyMap<string, LiveCardTransform>,
): CardData[] =>
  cards.map(card => cloneCardAtLiveTransform(card, liveTransforms.get(card.id)));

export const createGameSave = ({
  id = createId(),
  name,
  source,
  cards,
  liveTransforms,
  cardSize,
  currentPresetId,
  isFreezeMode,
  savedAt = new Date().toISOString(),
}: {
  id?: string;
  name: string;
  source: GameSaveSource;
  cards: readonly CardData[];
  liveTransforms: ReadonlyMap<string, LiveCardTransform>;
  cardSize: CardSize;
  currentPresetId: string;
  isFreezeMode: boolean;
  savedAt?: string;
}): GameSaveData => ({
  schemaVersion: GAME_SAVE_SCHEMA_VERSION,
  kind: 'paker-build',
  id,
  name: normalizeName(name, source === 'autosave' ? '自动存档' : '未命名搭建'),
  source,
  savedAt,
  cardSize,
  currentPresetId,
  isFreezeMode,
  cards: captureLiveCards(cards, liveTransforms),
});

const getCardValidationIssue = (value: unknown): string | null => {
  if (!value || typeof value !== 'object') return 'not an object';
  const card = value as Partial<CardData>;
  if (typeof card.id !== 'string' || card.id.length === 0) return 'id';
  if (!finiteTuple(card.position, 3)) return 'position';
  if (!finiteTuple(card.rotation, 3)) return 'rotation';
  if (
    card.suit !== 'spades' &&
    card.suit !== 'hearts' &&
    card.suit !== 'clubs' &&
    card.suit !== 'diamonds'
  ) return 'suit';
  if (typeof card.rank !== 'string') return 'rank';
  if (card.color !== 'red' && card.color !== 'black') return 'color';
  if (typeof card.locked !== 'boolean') return 'locked';
  return null;
};

const isCardData = (value: unknown): value is CardData =>
  getCardValidationIssue(value) === null;

const getGameSaveValidationIssue = (value: unknown): string | null => {
  if (!value || typeof value !== 'object') return 'save is not an object';
  const candidate = value as Partial<GameSaveData>;
  if (candidate.schemaVersion !== GAME_SAVE_SCHEMA_VERSION) return 'schema version';
  if (candidate.kind !== 'paker-build') return 'save kind';
  if (typeof candidate.id !== 'string' || candidate.id.length === 0) return 'save id';
  if (typeof candidate.name !== 'string') return 'save name';
  if (candidate.source !== 'manual' && candidate.source !== 'autosave') return 'save source';
  if (
    typeof candidate.savedAt !== 'string' ||
    !Number.isFinite(Date.parse(candidate.savedAt))
  ) return 'save timestamp';
  if (
    candidate.cardSize !== CardSize.BRIDGE &&
    candidate.cardSize !== CardSize.POKER
  ) return 'card size';
  if (typeof candidate.currentPresetId !== 'string') return 'preset id';
  if (typeof candidate.isFreezeMode !== 'boolean') return 'freeze state';
  if (!Array.isArray(candidate.cards)) return 'cards collection';
  const invalidCardIndex = candidate.cards.findIndex(card => !isCardData(card));
  if (invalidCardIndex >= 0) {
    return `card ${invalidCardIndex} ${getCardValidationIssue(candidate.cards[invalidCardIndex])}`;
  }
  const ids = new Set(candidate.cards.map(card => card.id));
  if (ids.size !== candidate.cards.length) return 'duplicate card ids';
  return null;
};

export const validateGameSave = (value: unknown): GameSaveData | null => {
  if (getGameSaveValidationIssue(value)) return null;
  const candidate = value as GameSaveData;

  return {
    ...candidate,
    name: normalizeName(
      candidate.name,
      candidate.source === 'autosave' ? '自动存档' : '未命名搭建',
    ),
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

const validateManualLibrary = (value: unknown): GameSaveData[] | null => {
  if (!Array.isArray(value)) return null;
  const saves = value.map(validateGameSave);
  if (saves.some(save => save === null)) return null;
  const valid = saves as GameSaveData[];
  if (valid.some(save => save.source !== 'manual')) return null;
  const ids = new Set(valid.map(save => save.id));
  if (ids.size !== valid.length) return null;
  return valid
    .sort((left, right) => Date.parse(right.savedAt) - Date.parse(left.savedAt));
};

const parseStoredLibrary = (raw: string | null): GameSaveData[] | null => {
  if (!raw) return [];
  try {
    return validateManualLibrary(JSON.parse(raw));
  } catch {
    return null;
  }
};

const loadManualLibrary = (storage: ReadStorage) => {
  const primary = parseStoredLibrary(storage.getItem(MANUAL_LIBRARY_KEY));
  if (primary) return { saves: primary, recoveredFromBackup: false };

  const backup = parseStoredLibrary(
    storage.getItem(`${MANUAL_LIBRARY_KEY}${BACKUP_SUFFIX}`),
  );
  return {
    saves: backup ?? [],
    recoveredFromBackup: backup !== null,
  };
};

const loadAutosave = (storage: ReadStorage) => {
  const primary = parseStoredSave(storage.getItem(AUTOSAVE_KEY));
  if (primary?.source === 'autosave') {
    return { save: primary, recoveredFromBackup: false };
  }

  const backup = parseStoredSave(storage.getItem(`${AUTOSAVE_KEY}${BACKUP_SUFFIX}`));
  return {
    save: backup?.source === 'autosave' ? backup : null,
    recoveredFromBackup: backup?.source === 'autosave',
  };
};

export const loadGameSaveLibrary = (storage: ReadStorage): GameSaveLibrary => {
  const manual = loadManualLibrary(storage);
  const automatic = loadAutosave(storage);
  return {
    manualSaves: manual.saves,
    autosave: automatic.save,
    recoveredManualBackup: manual.recoveredFromBackup,
    recoveredAutosaveBackup: automatic.recoveredFromBackup,
  };
};

const backupAndWriteManualLibrary = (
  storage: WriteStorage,
  saves: GameSaveData[],
) => {
  const previous = parseStoredLibrary(storage.getItem(MANUAL_LIBRARY_KEY));
  if (previous) {
    storage.setItem(
      `${MANUAL_LIBRARY_KEY}${BACKUP_SUFFIX}`,
      JSON.stringify(previous),
    );
  }
  storage.setItem(MANUAL_LIBRARY_KEY, JSON.stringify(saves));
};

export const persistGameSave = (
  storage: WriteStorage,
  save: GameSaveData,
): GameSaveLibrary => {
  const validatedSave = validateGameSave(save);
  if (!validatedSave) {
    throw new Error(
      `Refusing to persist an invalid game save: ${getGameSaveValidationIssue(save)}`,
    );
  }

  if (validatedSave.source === 'autosave') {
    const previous = parseStoredSave(storage.getItem(AUTOSAVE_KEY));
    if (previous?.source === 'autosave') {
      storage.setItem(`${AUTOSAVE_KEY}${BACKUP_SUFFIX}`, JSON.stringify(previous));
    }
    storage.setItem(AUTOSAVE_KEY, JSON.stringify(validatedSave));
    return loadGameSaveLibrary(storage);
  }

  const current = loadManualLibrary(storage).saves;
  const next = [
    validatedSave,
    ...current.filter(item => item.id !== validatedSave.id),
  ]
    .sort((left, right) => Date.parse(right.savedAt) - Date.parse(left.savedAt));
  backupAndWriteManualLibrary(storage, next);
  return loadGameSaveLibrary(storage);
};

export const renameManualGameSave = (
  storage: WriteStorage,
  id: string,
  name: string,
): GameSaveLibrary => {
  const current = loadManualLibrary(storage).saves;
  const next = current.map(save =>
    save.id === id
      ? { ...save, name: normalizeName(name, save.name) }
      : save
  );
  backupAndWriteManualLibrary(storage, next);
  return loadGameSaveLibrary(storage);
};

export const deleteManualGameSave = (
  storage: MutableStorage,
  id: string,
): GameSaveLibrary => {
  const current = loadManualLibrary(storage).saves;
  backupAndWriteManualLibrary(
    storage,
    current.filter(save => save.id !== id),
  );
  return loadGameSaveLibrary(storage);
};

export const clearAutosave = (
  storage: MutableStorage,
): GameSaveLibrary => {
  storage.removeItem(AUTOSAVE_KEY);
  storage.removeItem(`${AUTOSAVE_KEY}${BACKUP_SUFFIX}`);
  return loadGameSaveLibrary(storage);
};

export const findGameSave = (
  library: GameSaveLibrary,
  id: string,
): GameSaveData | null =>
  library.manualSaves.find(save => save.id === id) ??
  (library.autosave?.id === id ? library.autosave : null);

export const loadLatestGameSave = (
  storage: ReadStorage,
): { save: GameSaveData; recoveredFromBackup: boolean } | null => {
  const library = loadGameSaveLibrary(storage);
  const candidates = [
    ...library.manualSaves.map(save => ({
      save,
      recoveredFromBackup: library.recoveredManualBackup,
    })),
    ...(library.autosave
      ? [{
          save: library.autosave,
          recoveredFromBackup: library.recoveredAutosaveBackup,
        }]
      : []),
  ];
  return candidates.sort(
    (left, right) =>
      Date.parse(right.save.savedAt) - Date.parse(left.save.savedAt),
  )[0] ?? null;
};

export const summarizeGameSave = (save: GameSaveData): GameSaveSummary => ({
  id: save.id,
  name: save.name,
  source: save.source,
  savedAt: save.savedAt,
  cardCount: save.cards.length,
  cardSize: save.cardSize,
});
