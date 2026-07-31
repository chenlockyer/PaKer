import type { CardRole, LaunchGestureSample } from '../types';

export interface LaunchGestureResolution {
  distanceRatio: number;
  speedRatio: number;
  gestureSpeed: number;
  rawPower: number;
  power: number;
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export const DEFAULT_LAUNCH_MINIMUM_IMPULSE = 0.25;
export const DEFAULT_LAUNCH_MAXIMUM_IMPULSE = 2.45;
export const DEFAULT_PUSH_MINIMUM_IMPULSE = 0.02;
export const DEFAULT_PUSH_MAXIMUM_IMPULSE = 0.45;
export const DEFAULT_LAUNCH_METER_ONE_WAY_MS = 1200;

const interpolateImpulseRange = (
  power: number,
  minimumImpulse: number,
  maximumImpulse: number,
) => {
  const minimum = Math.max(0, Math.min(minimumImpulse, maximumImpulse));
  const maximum = Math.max(minimum, maximumImpulse);
  return minimum + clamp01(power) * (maximum - minimum);
};

/**
 * Deterministic 0 -> 1 -> 0 power meter. elapsedMs is measured from pointer
 * down; oneWayDurationMs controls each half of the cycle.
 */
export const resolveLaunchMeterPower = (
  elapsedMs: number,
  oneWayDurationMs = DEFAULT_LAUNCH_METER_ONE_WAY_MS,
) => {
  if (!Number.isFinite(elapsedMs) || !Number.isFinite(oneWayDurationMs)) return 0;
  const duration = Math.max(1, oneWayDurationMs);
  const elapsed = Math.max(0, elapsedMs);
  const phase = (elapsed % (duration * 2)) / duration;
  return phase <= 1 ? phase : 2 - phase;
};

export const resolvePowerMeter = resolveLaunchMeterPower;

export const resolveFormalLaunchImpulseMagnitude = (
  meterPower: number,
  minimumImpulse = DEFAULT_LAUNCH_MINIMUM_IMPULSE,
  maximumImpulse = DEFAULT_LAUNCH_MAXIMUM_IMPULSE,
) => resolveLaunchImpulseMagnitude(
  meterPower,
  minimumImpulse,
  maximumImpulse,
);

export const resolvePushImpulseMagnitude = (
  rawPower: number,
  minimumImpulse = DEFAULT_PUSH_MINIMUM_IMPULSE,
  maximumImpulse = DEFAULT_PUSH_MAXIMUM_IMPULSE,
) => interpolateImpulseRange(
  Math.pow(clamp01(Number.isFinite(rawPower) ? rawPower : 0), 1.6),
  minimumImpulse,
  maximumImpulse,
);

export const resolveCardRole = (role?: CardRole): CardRole => role ?? 'structure';

export const canLaunchCardRole = (role?: CardRole) => resolveCardRole(role) === 'ammo';

export const resolveLaunchGesture = (
  samples: LaunchGestureSample[],
  viewportShortSide: number,
  now = samples.at(-1)?.time ?? 0,
): LaunchGestureResolution => {
  if (samples.length < 2 || viewportShortSide <= 0) {
    return { distanceRatio: 0, speedRatio: 0, gestureSpeed: 0, rawPower: 0, power: 0 };
  }

  const first = samples[0];
  const last = samples[samples.length - 1];
  const distance = Math.hypot(last.x - first.x, last.y - first.y);
  const distanceRatio = clamp01(distance / (viewportShortSide * 0.18));
  const recent = samples.find(sample => sample.time >= now - 120) ?? first;
  const recentSeconds = Math.max(0.016, (last.time - recent.time) / 1000);
  const recentDistance = Math.hypot(last.x - recent.x, last.y - recent.y);
  const gestureSpeed = recentDistance / recentSeconds;
  const speedRatio = clamp01(gestureSpeed / (viewportShortSide * 2));
  const rawPower = clamp01(distanceRatio * 0.6 + speedRatio * 0.4);

  return {
    distanceRatio,
    speedRatio,
    gestureSpeed,
    rawPower,
    power: Math.pow(rawPower, 1.6),
  };
};

export const isLaunchGesturePastDeadZone = (
  samples: LaunchGestureSample[],
  viewportShortSide: number,
) => {
  if (samples.length < 2 || viewportShortSide <= 0) return false;
  const first = samples[0];
  const last = samples[samples.length - 1];
  return Math.hypot(last.x - first.x, last.y - first.y) >= viewportShortSide * 0.01;
};

export const resolveLaunchImpulseMagnitude = (
  power: number,
  minimumImpulse = DEFAULT_LAUNCH_MINIMUM_IMPULSE,
  maximumImpulse = DEFAULT_LAUNCH_MAXIMUM_IMPULSE,
) => {
  const curvedPower = Math.pow(clamp01(Number.isFinite(power) ? power : 0), 1.6);
  return interpolateImpulseRange(curvedPower, minimumImpulse, maximumImpulse);
};

export {
  areCardsStackNeighbors,
  distributeImpulseByMass,
  distributeImpulseMagnitudeByMass,
  distributeImpulseVectorByMass,
  findStackedCardIds,
  getLaunchPresetCandidates,
  isCardBackContact,
  localPointToWorld,
  quaternionToWorldDirection,
  quaternionToWorldVector,
  resolveLaunchTarget,
  resolveLaunchStack,
  snapLaunchPresetContact,
  worldDirectionFromQuaternion,
} from './launchPresets';

export type {
  LaunchCardDimensions,
  LaunchPreset,
  LaunchPresetCandidate,
  LaunchQuaternion,
  LaunchTarget,
  LaunchStackCard,
  LaunchStackOptions,
  LaunchVector3,
  MassImpulseShare,
  MassImpulseVectorShare,
  SnappedLaunchPreset,
} from './launchPresets';
