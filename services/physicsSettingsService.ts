import type { PhysicsSettings } from '../types';

export const PHYSICS_SETTINGS_STORAGE_KEY = 'paker_physics_settings_v1';

export const DEFAULT_PHYSICS_SETTINGS: PhysicsSettings = Object.freeze({
  schemaVersion: 1,
  cardMass: 0.1,
  cardFriction: 1,
  floorFriction: 1.1,
  launchMinimumImpulse: 0.25,
  launchMaximumImpulse: 2.45,
  structureLinearDamping: 0.5,
  structureAngularDamping: 0.5,
  flightLinearDamping: 0.08,
  flightAngularDamping: 0.08,
  pushMaximumImpulse: 0.45,
  meterOneWayDurationMs: 1200,
});

export const PHYSICS_SETTING_RANGES = Object.freeze({
  cardMass: { min: 0.02, max: 0.5, step: 0.01 },
  cardFriction: { min: 0, max: 2, step: 0.05 },
  floorFriction: { min: 0, max: 2, step: 0.05 },
  launchMinimumImpulse: { min: 0, max: 1, step: 0.05 },
  launchMaximumImpulse: { min: 0.5, max: 5, step: 0.05 },
  structureLinearDamping: { min: 0, max: 2, step: 0.05 },
  structureAngularDamping: { min: 0, max: 2, step: 0.05 },
  flightLinearDamping: { min: 0, max: 1, step: 0.01 },
  flightAngularDamping: { min: 0, max: 1, step: 0.01 },
  pushMaximumImpulse: { min: 0.05, max: 1, step: 0.01 },
  meterOneWayDurationMs: { min: 400, max: 3000, step: 100 },
} satisfies Record<Exclude<keyof PhysicsSettings, 'schemaVersion'>, {
  min: number;
  max: number;
  step: number;
}>);

type PhysicsSettingKey = keyof typeof PHYSICS_SETTING_RANGES;
type ReadStorage = Pick<Storage, 'getItem'>;
type WriteStorage = Pick<Storage, 'setItem'>;

const clampSetting = (key: PhysicsSettingKey, value: unknown) => {
  const fallback = DEFAULT_PHYSICS_SETTINGS[key];
  const numeric = typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  const range = PHYSICS_SETTING_RANGES[key];
  return Math.min(range.max, Math.max(range.min, numeric));
};

export const normalizePhysicsSettings = (value: unknown): PhysicsSettings => {
  if (!value || typeof value !== 'object') return { ...DEFAULT_PHYSICS_SETTINGS };
  const candidate = value as Partial<PhysicsSettings>;
  if (candidate.schemaVersion !== 1) return { ...DEFAULT_PHYSICS_SETTINGS };
  const normalized = Object.fromEntries(
    (Object.keys(PHYSICS_SETTING_RANGES) as PhysicsSettingKey[])
      .map(key => [key, clampSetting(key, candidate[key])]),
  ) as Omit<PhysicsSettings, 'schemaVersion'>;
  normalized.launchMinimumImpulse = Math.min(
    normalized.launchMinimumImpulse,
    normalized.launchMaximumImpulse,
  );
  return { schemaVersion: 1, ...normalized };
};

export const loadPhysicsSettings = (storage: ReadStorage): PhysicsSettings => {
  try {
    const raw = storage.getItem(PHYSICS_SETTINGS_STORAGE_KEY);
    return raw ? normalizePhysicsSettings(JSON.parse(raw)) : { ...DEFAULT_PHYSICS_SETTINGS };
  } catch {
    return { ...DEFAULT_PHYSICS_SETTINGS };
  }
};

export const persistPhysicsSettings = (
  storage: WriteStorage,
  settings: PhysicsSettings,
): PhysicsSettings => {
  const normalized = normalizePhysicsSettings(settings);
  storage.setItem(PHYSICS_SETTINGS_STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
};

export const physicsSettingsEqual = (left: PhysicsSettings, right: PhysicsSettings) =>
  (Object.keys(DEFAULT_PHYSICS_SETTINGS) as Array<keyof PhysicsSettings>)
    .every(key => left[key] === right[key]);
