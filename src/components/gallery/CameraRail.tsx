/* eslint-disable react-hooks/immutability -- three.js objects (camera, lights, renderer) are mutated imperatively inside the render loop by design */
"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useState } from "react";
import { PerspectiveCamera } from "three";
import { DEFAULT_TUNING, advanceClock, glideAt, planMove, restingPose, type RailPose, type RailTuning } from "@/lib/gallery/camera-math";
import { useGallery } from "./context";

export type FixedCamera = { position: [number, number, number]; target: [number, number, number]; fov: number; ndcShiftY?: number };

type Props = {
  stopIndex: number;
  zoomed: boolean;
  reducedMotion: boolean;
  /** While true the camera waits in front of the entrance wall (loading screen visible). */
  hold: boolean;
  tuning?: RailTuning;
  /** Photo exports and tests place the camera exactly and never animate it. */
  fixed?: FixedCamera;
  /** Seconds the opening glide takes. */
  introSeconds?: number;
  onArrive?: (stopIndex: number) => void;
  /** Reports the live camera x for tests and for the UI. */
  telemetry?: (sample: { x: number; z: number; t: number; target?: number; smooth?: number }) => void;
};

const ZOOM_IN = 0.62;
/** Frames still drawn after a glide ends, so the restored resolution and the final pose are on screen. */
const SETTLE_FRAMES = 3;

// Axes: 0 x, 1 y, 2 z of the camera; 3 x, 4 y of the gaze point on the wall.
const AXES = 5;
const poseInto = (pose: RailPose, out: Float64Array) => {
  out[0] = pose.position.x;
  out[1] = pose.position.y;
  out[2] = pose.position.z;
  out[3] = pose.target.x;
  out[4] = pose.target.y;
};

type Rail = {
  cur: Float64Array;
  vel: Float64Array;
  from: Float64Array;
  v0: Float64Array;
  to: Float64Array;
  next: Float64Array;
  scratch: number[];
  elapsed: number;
  duration: number;
  gliding: boolean;
  /** The glide was just requested: its clock starts on the next frame, so a hitch before it is not eaten by the ease. */
  fresh: boolean;
  initialised: boolean;
  clock: number;
  tail: number;
  arrivedStop: number;
  prevStop: number;
  prevHold: boolean;
  prevZoom: boolean;
  prevAspect: number;
};

function createRail(): Rail {
  return {
    cur: new Float64Array(AXES),
    vel: new Float64Array(AXES),
    from: new Float64Array(AXES),
    v0: new Float64Array(AXES),
    to: new Float64Array(AXES),
    next: new Float64Array(AXES),
    scratch: [0],
    elapsed: 0,
    duration: 0,
    gliding: false,
    fresh: false,
    initialised: false,
    clock: 0,
    tail: 0,
    arrivedStop: -1,
    prevStop: -1,
    prevHold: true,
    prevZoom: false,
    prevAspect: 0,
  };
}

/**
 * The rail: the camera never moves freely. Every move is a glide of fixed duration (longer for longer
 * trips) along a smootherstep curve, evaluated from elapsed time, so it is deterministic and arrives on
 * time whatever the frame rate. Position and gaze share the same curve (no overshoot, no jitter); an
 * interrupted glide hands its velocity to the next one. Nothing here touches React state.
 */
export function CameraRail({ stopIndex, zoomed, reducedMotion, hold, tuning = DEFAULT_TUNING, fixed, introSeconds = 2.6, onArrive, telemetry }: Props) {
  const { layout, cameraX, motion } = useGallery();
  const camera = useThree((state) => state.camera) as PerspectiveCamera;
  const size = useThree((state) => state.size);
  const invalidate = useThree((state) => state.invalidate);

  const stop = layout.stops[stopIndex] ?? layout.stops[0];
  const entrance = layout.stops[0];
  const [rail] = useState(createRail);
  const aspect = size.width / Math.max(size.height, 1);

  const poses = useMemo(() => {
    if (!stop || !entrance) return null;
    return {
      rest: restingPose(stop.x, stop.targetW, stop.targetH, stop.focusY, aspect, tuning, 1),
      zoom: restingPose(stop.x, stop.targetW, stop.targetH, stop.focusY, aspect, tuning, ZOOM_IN),
      entrance: restingPose(entrance.x, entrance.targetW, entrance.targetH, entrance.focusY, aspect, tuning, 1),
    };
  }, [stop, entrance, aspect, tuning]);

  // Fixed cameras (photo exports): set once, never animate.
  useEffect(() => {
    if (!fixed) return;
    camera.fov = fixed.fov;
    camera.position.set(...fixed.position);
    camera.lookAt(...fixed.target);
    camera.updateProjectionMatrix();
    if (fixed.ndcShiftY) {
      // Lens shift: move the principal point so the subject sits where the composition wants it.
      camera.projectionMatrix.elements[9] = -fixed.ndcShiftY;
      camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    }
    cameraX.current = fixed.position[0];
    invalidate();
  }, [fixed, camera, cameraX, invalidate]);

  useEffect(() => {
    if (fixed) return;
    camera.fov = tuning.fov;
    camera.near = 0.1;
    camera.far = 90;
    camera.updateProjectionMatrix();
  }, [camera, tuning.fov, fixed]);

  // A new stop, a zoom toggle, a resize or the end of the loading hold starts a glide.
  useEffect(() => {
    if (fixed || !poses) return;
    const r = rail;
    const pose = hold ? poses.entrance : zoomed ? poses.zoom : poses.rest;
    poseInto(pose, r.next);
    motion.targetX = r.next[0];

    const first = r.prevStop === -1 || !r.initialised;
    const plan = planMove({
      first,
      stopChanged: r.prevStop !== stopIndex,
      releasing: r.prevHold && !hold,
      zoomChanged: r.prevZoom !== zoomed,
      aspectChanged: r.prevAspect !== aspect,
      distance: Math.abs(r.next[0] - r.cur[0]),
      introSeconds,
      reducedMotion,
    });
    r.prevStop = stopIndex;
    r.prevHold = hold;
    r.prevZoom = zoomed;
    r.prevAspect = aspect;

    if (plan.kind === "init" || plan.kind === "follow" || (plan.kind === "snap" && r.gliding)) {
      // The glide in progress (if any) simply heads for the new framing.
      r.to.set(r.next);
      invalidate();
      return;
    }
    if (plan.kind === "snap") {
      // A resize or rotation re-frames at once: it is not a move (no lowered resolution, no deferred uploads,
      // no governor samples, no arrival).
      r.cur.set(r.next);
      r.to.set(r.next);
      r.vel.fill(0);
      invalidate();
      return;
    }
    r.from.set(r.cur);
    r.v0.set(r.vel);
    r.to.set(r.next);
    r.duration = plan.seconds;
    r.elapsed = 0;
    r.gliding = true;
    r.fresh = true;
    if (plan.arrival) r.arrivedStop = -1;
    motion.moving = true;
    motion.glideStartedAt = performance.now();
    invalidate();
  }, [poses, stopIndex, zoomed, hold, aspect, reducedMotion, introSeconds, invalidate, fixed, motion, rail]);

  useFrame((_, delta) => {
    const r = rail;
    if (fixed || !poses || !stop) return;
    r.clock += delta;

    if (!r.initialised) {
      r.cur.set(r.to);
      r.initialised = true;
    }

    if (r.gliding) {
      if (r.fresh) {
        r.fresh = false;
      } else {
        r.elapsed = advanceClock(r.elapsed, delta, false);
      }
      const done = r.duration <= 0 || r.elapsed >= r.duration;
      for (let i = 0; i < AXES; i += 1) {
        r.cur[i] = glideAt(r.from[i], r.v0[i], r.to[i], r.duration, r.elapsed, r.scratch);
        r.vel[i] = done ? 0 : r.scratch[0];
      }
      if (done) {
        r.gliding = false;
        r.tail = SETTLE_FRAMES;
        motion.moving = false;
        motion.restSince = performance.now();
        motion.glides += 1;
        if (!hold && r.arrivedStop !== stopIndex) {
          r.arrivedStop = stopIndex;
          onArrive?.(stopIndex);
        }
      }
    } else {
      r.cur.set(r.to);
      r.vel.fill(0);
    }

    camera.position.set(r.cur[0], r.cur[1], r.cur[2]);
    camera.lookAt(r.cur[3], r.cur[4], 0);
    cameraX.current = r.cur[0];
    telemetry?.({ x: r.cur[0], z: r.cur[2], t: r.clock, target: r.to[0] });

    if (r.gliding) {
      invalidate();
    } else if (r.tail > 0) {
      r.tail -= 1;
      invalidate();
    }
  });

  return null;
}
