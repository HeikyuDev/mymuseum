// Pure camera-rail math: damped motion, framing distance and the resting pose
// for a stop. Kept free of three.js so it can be unit tested.

export const EYE_HEIGHT = 1.6;
export const DEFAULT_FOV = 46;

export type Vec3 = { x: number; y: number; z: number };

export type RailTuning = {
  fov: number;
  /** Portion of the wall area (viewport above the floor strip) the stop's content may take. */
  fillV: number;
  /** Portion of the viewport width the stop's content may take. */
  fillH: number;
  minDistance: number;
  maxDistance: number;
  /** Share of the viewport height (from the bottom) where the wall meets the floor. */
  floorShare: number;
  eyeHeight: number;
};

export const DEFAULT_TUNING: RailTuning = {
  fov: DEFAULT_FOV,
  fillV: 0.62,
  fillH: 0.7,
  minDistance: 3.2,
  maxDistance: 7.5,
  floorShare: 0.2,
  eyeHeight: EYE_HEIGHT,
};

const rad = (deg: number) => (deg * Math.PI) / 180;

export function horizontalFov(vfovDeg: number, aspect: number): number {
  return 2 * Math.atan(Math.tan(rad(vfovDeg) / 2) * aspect) * (180 / Math.PI);
}

/** Camera distance from the wall so that a w x h target fits the viewport comfortably. */
export function framingDistance(targetW: number, targetH: number, aspect: number, tuning: RailTuning = DEFAULT_TUNING): number {
  const tanV = Math.tan(rad(tuning.fov) / 2);
  const tanH = tanV * Math.max(aspect, 0.1);
  const byHeight = targetH / (tuning.fillV * (1 - tuning.floorShare)) / (2 * tanV);
  const byWidth = targetW / tuning.fillH / (2 * tanH);
  return Math.min(tuning.maxDistance, Math.max(tuning.minDistance, byHeight, byWidth));
}

/**
 * Downward pitch (radians) that puts the subject's center (wall height `focusY`)
 * in the middle of the wall area, i.e. at the middle of the viewport above the
 * floor strip. The floor then fills about `floorShare` of the frame (a little
 * more when the camera backs away), never half of it.
 */
export function pitchForFocus(distance: number, focusY: number, tuning: RailTuning = DEFAULT_TUNING): number {
  const focusAngle = Math.atan((tuning.eyeHeight - focusY) / distance); // below the horizon
  const centerNdc = tuning.floorShare; // middle of [-(1 - 2f), 1]
  return Math.max(0, focusAngle + Math.atan(centerNdc * Math.tan(rad(tuning.fov) / 2)));
}

export type RailPose = { position: Vec3; target: Vec3 };

/** Resting pose for a stop centered at wall position `x`. */
export function restingPose(x: number, targetW: number, targetH: number, focusY: number, aspect: number, tuning: RailTuning = DEFAULT_TUNING, zoom = 1): RailPose {
  const distance = framingDistance(targetW, targetH, aspect, tuning) * zoom;
  const pitch = pitchForFocus(distance, focusY, tuning);
  return {
    position: { x, y: tuning.eyeHeight, z: distance },
    target: { x, y: tuning.eyeHeight - Math.tan(pitch) * distance, z: 0 },
  };
}

export type DampState = { value: number; velocity: number };

/**
 * Critically damped spring (Game Programming Gems 4, as used by Unity's
 * SmoothDamp). Mutates `state`; the result is continuous in position and velocity.
 */
export function smoothDamp(state: DampState, target: number, smoothTime: number, dt: number, maxSpeed = Infinity): number {
  const time = Math.max(0.0001, smoothTime);
  const omega = 2 / time;
  const x = omega * dt;
  const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  let change = state.value - target;
  const originalTarget = target;
  const maxChange = maxSpeed * time;
  change = Math.max(-maxChange, Math.min(maxChange, change));
  const adjustedTarget = state.value - change;
  const temp = (state.velocity + omega * change) * dt;
  state.velocity = (state.velocity - omega * temp) * exp;
  let output = adjustedTarget + (change + temp) * exp;
  if (originalTarget - state.value > 0 === output > originalTarget) {
    output = originalTarget;
    state.velocity = (output - originalTarget) / Math.max(dt, 1e-6);
  }
  state.value = output;
  return output;
}

export function isSettled(state: DampState, target: number, positionEpsilon = 0.0008, velocityEpsilon = 0.0008): boolean {
  return Math.abs(state.value - target) < positionEpsilon && Math.abs(state.velocity) < velocityEpsilon;
}

/** Longer hops (across halls) take a little longer, bounded so nothing drags. */
export function travelTime(distance: number, reducedMotion: boolean): number {
  if (reducedMotion) return 0.0001;
  return Math.min(1.6, 0.7 + Math.abs(distance) * 0.06);
}
