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

/**
 * Fifth-order Hermite blend from `p0` (leaving with velocity `v0`) to `p1` (arriving at rest) over `duration` seconds.
 * With `v0 = 0` it is the classic smootherstep ease-in-out: zero velocity and acceleration at both ends,
 * monotonic, no overshoot. A non-zero `v0` lets a glide that is interrupted by a new request continue
 * without a velocity jump. Returns the position and writes the velocity to `out[0]`.
 */
export function glideAt(p0: number, v0: number, p1: number, duration: number, elapsed: number, out?: number[]): number {
  if (duration <= 0 || elapsed >= duration) {
    if (out) out[0] = 0;
    return p1;
  }
  const s = elapsed <= 0 ? 0 : elapsed / duration;
  const s2 = s * s;
  const s3 = s2 * s;
  const s4 = s3 * s;
  const s5 = s4 * s;
  const h0 = 1 - 10 * s3 + 15 * s4 - 6 * s5;
  const h1 = s - 6 * s3 + 8 * s4 - 3 * s5;
  const h5 = 10 * s3 - 15 * s4 + 6 * s5;
  if (out) {
    const d0 = -30 * s2 + 60 * s3 - 30 * s4;
    const d1 = 1 - 18 * s2 + 32 * s3 - 15 * s4;
    const d5 = 30 * s2 - 60 * s3 + 30 * s4;
    out[0] = (d0 * p0 + d1 * duration * v0 + d5 * p1) / duration;
  }
  return h0 * p0 + h1 * duration * v0 + h5 * p1;
}

/**
 * How long a move of `distance` meters takes. Fixed per move (not a spring), so a slow frame never
 * makes the glide drag on: short hops take about a second, a trip across the museum under two.
 */
export function glideDuration(distance: number, reducedMotion: boolean): number {
  if (reducedMotion) return 0;
  const d = Math.abs(distance);
  return 0.9 + 0.8 * (1 - Math.exp(-d / 18));
}

/** Longest simulated step per frame: a hitch eats part of a glide (and the ease hides it), it never teleports the camera. */
export const MAX_GLIDE_STEP = 0.08;

export type MoveInput = {
  /** The very first pose: nothing to animate from. */
  first: boolean;
  stopChanged: boolean;
  /** The loading hold just ended: the opening glide. */
  releasing: boolean;
  zoomChanged: boolean;
  aspectChanged: boolean;
  /** Distance the camera has to travel along the wall (m). */
  distance: number;
  introSeconds: number;
  reducedMotion: boolean;
};

export type MovePlan =
  | { kind: "init" }
  /** The target moved without a request to travel (a rebuilt pose): follow it, nothing else changes. */
  | { kind: "follow" }
  /** A resize or rotation: jump to the new framing without counting as a move. */
  | { kind: "snap" }
  | { kind: "glide"; seconds: number; /** Arriving counts as reaching a stop (fires onArrive). */ arrival: boolean };

/** What the rail does when its inputs change. Pure, so every case is tested. */
export function planMove(input: MoveInput): MovePlan {
  if (input.first) return { kind: "init" };
  const seconds = (value: number) => (input.reducedMotion ? 0 : value);
  if (input.releasing) return { kind: "glide", seconds: seconds(input.introSeconds), arrival: true };
  if (input.stopChanged) return { kind: "glide", seconds: seconds(glideDuration(input.distance, false)), arrival: true };
  if (input.zoomChanged) return { kind: "glide", seconds: seconds(0.45), arrival: false };
  if (input.aspectChanged) return { kind: "snap" };
  return { kind: "follow" };
}

/** Advances a glide clock by one frame: the frame is capped so a hitch cannot teleport the camera, and the first frame after a request only starts the clock. */
export function advanceClock(elapsed: number, delta: number, fresh: boolean): number {
  return fresh ? elapsed : elapsed + Math.min(Math.max(delta, 0), MAX_GLIDE_STEP);
}
