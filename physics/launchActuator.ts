const EPSILON = 1e-6;

export interface LaunchActuatorStepInput {
  totalMass: number;
  forwardSpeed: number;
  targetSpeed: number;
  maximumForce: number;
  deltaTime: number;
  remainingWork?: number;
}

export interface LaunchActuatorStep {
  speedError: number;
  impulseMagnitude: number;
  appliedForce: number;
  workApplied: number;
  targetReached: boolean;
}

export const resolveLaunchActuatorStep = ({
  totalMass,
  forwardSpeed,
  targetSpeed,
  maximumForce,
  deltaTime,
  remainingWork = Number.POSITIVE_INFINITY,
}: LaunchActuatorStepInput): LaunchActuatorStep => {
  const mass = Number.isFinite(totalMass) ? Math.max(0, totalMass) : 0;
  const speed = Number.isFinite(forwardSpeed) ? forwardSpeed : 0;
  const target = Number.isFinite(targetSpeed) ? Math.max(0, targetSpeed) : 0;
  const force = Number.isFinite(maximumForce) ? Math.max(0, maximumForce) : 0;
  const dt = Number.isFinite(deltaTime) ? Math.max(0, deltaTime) : 0;
  const work = Number.isFinite(remainingWork)
    ? Math.max(0, remainingWork)
    : Number.POSITIVE_INFINITY;
  const speedError = Math.max(0, target - speed);

  if (mass <= EPSILON || speedError <= EPSILON || force <= EPSILON || dt <= EPSILON) {
    return {
      speedError,
      impulseMagnitude: 0,
      appliedForce: 0,
      workApplied: 0,
      targetReached: speedError <= EPSILON,
    };
  }

  const positiveForwardSpeed = Math.max(0, speed);
  const energyLimitedImpulse = Number.isFinite(work)
    ? mass * (
        Math.sqrt(positiveForwardSpeed * positiveForwardSpeed + 2 * work / mass)
        - positiveForwardSpeed
      )
    : Number.POSITIVE_INFINITY;
  const impulseMagnitude = Math.min(mass * speedError, force * dt, energyLimitedImpulse);
  const workApplied = positiveForwardSpeed * impulseMagnitude
    + impulseMagnitude * impulseMagnitude / (2 * mass);
  return {
    speedError,
    impulseMagnitude,
    appliedForce: impulseMagnitude / dt,
    workApplied,
    targetReached: impulseMagnitude >= mass * speedError - EPSILON,
  };
};

/** Ideal frictionless exit speed for a force-limited actuator acting over a stroke. */
export const resolveIdealActuatorExitSpeed = (
  totalMass: number,
  targetSpeed: number,
  maximumForce: number,
  strokeDistance: number,
  initialForwardSpeed = 0,
) => {
  const mass = Math.max(EPSILON, totalMass);
  const target = Math.max(0, targetSpeed);
  const force = Math.max(0, maximumForce);
  const stroke = Math.max(0, strokeDistance);
  const initial = Math.max(0, initialForwardSpeed);
  return Math.min(target, Math.sqrt(initial * initial + 2 * force * stroke / mass));
};
