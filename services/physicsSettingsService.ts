import type { PhysicsSettings } from '../types';

export const PHYSICS_SETTINGS_STORAGE_KEY = 'paker_physics_settings_v1';

export const DEFAULT_PHYSICS_SETTINGS: PhysicsSettings = Object.freeze({
  schemaVersion: 2,
  cardMass: 0.1,
  cardFriction: 1,
  floorFriction: 1.1,
  launchMinimumSpeed: 2.5,
  launchMaximumSpeed: 24.5,
  launchMaximumForce: 150,
  launchStrokeDistance: 0.45,
  launchMaximumActuationMs: 250,
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
  launchMinimumSpeed: { min: 0, max: 10, step: 0.1 },
  launchMaximumSpeed: { min: 5, max: 50, step: 0.5 },
  launchMaximumForce: { min: 20, max: 400, step: 5 },
  launchStrokeDistance: { min: 0.1, max: 1.5, step: 0.05 },
  launchMaximumActuationMs: { min: 50, max: 500, step: 10 },
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
  const candidate = value as Partial<Omit<PhysicsSettings, 'schemaVersion'>> & {
    schemaVersion?: number;
    launchMinimumImpulse?: number;
    launchMaximumImpulse?: number;
  };
  if (candidate.schemaVersion !== 1 && candidate.schemaVersion !== 2) {
    return { ...DEFAULT_PHYSICS_SETTINGS };
  }
  const migrated = candidate.schemaVersion === 1
    ? {
        ...candidate,
        launchMinimumSpeed: typeof candidate.launchMinimumImpulse === 'number'
          ? candidate.launchMinimumImpulse / Math.max(0.02, candidate.cardMass ?? 0.1)
          : DEFAULT_PHYSICS_SETTINGS.launchMinimumSpeed,
        launchMaximumSpeed: typeof candidate.launchMaximumImpulse === 'number'
          ? candidate.launchMaximumImpulse / Math.max(0.02, candidate.cardMass ?? 0.1)
          : DEFAULT_PHYSICS_SETTINGS.launchMaximumSpeed,
      }
    : candidate;
  const normalized = Object.fromEntries(
    (Object.keys(PHYSICS_SETTING_RANGES) as PhysicsSettingKey[])
      .map(key => [key, clampSetting(key, migrated[key])]),
  ) as Omit<PhysicsSettings, 'schemaVersion'>;
  normalized.launchMinimumSpeed = Math.min(
    normalized.launchMinimumSpeed,
    normalized.launchMaximumSpeed,
  );
  return { schemaVersion: 2, ...normalized };
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
