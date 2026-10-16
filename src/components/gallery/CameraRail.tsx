/* eslint-disable react-hooks/immutability -- three.js objects (camera, lights, renderer) are mutated imperatively inside the render loop by design */
"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { MathUtils, PerspectiveCamera } from "three";
import {
  DEFAULT_TUNING,
  isSettled,
  restingPose,
  smoothDamp,
  travelTime,
  type DampState,
  type RailPose,
  type RailTuning,
} from "@/lib/gallery/camera-math";
import { useGallery } from "./context";

export type FixedCamera = { position: [number, number, number]; target: [number, number, number]; fov: number; ndcShiftY?: number };

type Props = {
  stopIndex: number;
  zoomed: boolean;
  reducedMotion: boolean;
  /** While true the camera waits at the entrance (loading screen visible). */
  hold: boolean;
  tuning?: RailTuning;
  /** Photo exports and tests place the camera exactly and never animate it. */
  fixed?: FixedCamera;
  /** Seconds the intro dolly takes. */
  introSeconds?: number;
  onArrive?: (stopIndex: number) => void;
  /** Reports the live camera x for tests and for the UI. */
  telemetry?: (sample: { x: number; z: number; t: number; target?: number; smooth?: number }) => void;
};

const damp = (): DampState => ({ value: 0, velocity: 0 });
const ZOOM_IN = 0.62;
const INTRO_DISTANCE = 6.2;

/**
 * The rail: the camera never moves freely. It always glides (critically damped,
 * ease in and out) toward the resting pose of the current stop, with a little
 * natural settling sway after each arrival.
 */
export function CameraRail({ stopIndex, zoomed, reducedMotion, hold, tuning = DEFAULT_TUNING, fixed, introSeconds = 3.4, onArrive, telemetry }: Props) {
  const { layout, cameraX } = useGallery();
  const camera = useThree((state) => state.camera) as PerspectiveCamera;
  const size = useThree((state) => state.size);
  const invalidate = useThree((state) => state.invalidate);

  const stop = layout.stops[stopIndex] ?? layout.stops[0];
  const state = useRef({
    px: damp(),
    py: damp(),
    pz: damp(),
    tx: damp(),
    ty: damp(),
    smooth: 0.9,
    arrivedAt: 0,
    arrived: true,
    initialised: false,
    stopIndex: -1,
    clock: 0,
    holdPrev: true,
  });
  const aspect = size.width / Math.max(size.height, 1);

  const rest = useMemo<RailPose | null>(() => (stop ? restingPose(stop.x, stop.targetW, stop.targetH, stop.focusY, aspect, tuning, 1) : null), [stop, aspect, tuning]);

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

  // A new stop (or the end of the loading hold) starts a transition whose
  // duration follows the travel distance.
  useEffect(() => {
    if (fixed || !stop) return;
    const s = state.current;
    if (s.stopIndex === -1) {
      s.stopIndex = stopIndex;
      s.holdPrev = hold;
      return;
    }
    if (s.holdPrev && !hold) {
      s.smooth = reducedMotion ? 0.0001 : introSeconds / 3.2;
      s.arrived = false;
    } else if (s.stopIndex !== stopIndex) {
      s.smooth = travelTime(Math.abs(stop.x - s.px.value), reducedMotion);
      s.arrived = false;
    }
    s.stopIndex = stopIndex;
    s.holdPrev = hold;
    invalidate();
  }, [stopIndex, hold, stop, reducedMotion, introSeconds, invalidate, fixed]);

  useEffect(() => {
    invalidate();
  }, [zoomed, aspect, invalidate]);

  useFrame((_, delta) => {
    if (fixed || !rest || !stop) return;
    const s = state.current;
    const dt = Math.min(delta, 0.05);
    s.clock += dt;

    const zoomPose = zoomed ? restingPose(stop.x, stop.targetW, stop.targetH, stop.focusY, aspect, tuning, ZOOM_IN) : rest;

    // While holding, wait further back in the lobby so the intro dolly has room.
    const holdOffset = hold ? -INTRO_DISTANCE : 0;
    const targetPos = { x: zoomPose.position.x + holdOffset, y: zoomPose.position.y, z: zoomPose.position.z };
    const targetLook = { x: zoomPose.target.x + holdOffset, y: zoomPose.target.y };

    if (!s.initialised) {
      s.px.value = targetPos.x;
      s.py.value = targetPos.y;
      s.pz.value = targetPos.z;
      s.tx.value = targetLook.x;
      s.ty.value = targetLook.y;
      s.initialised = true;
    }

    const smooth = s.smooth;
    if (smooth <= 0.001) {
      // Reduced motion: no travel, the camera simply cuts to the new stop.
      for (const [damper, value] of [[s.px, targetPos.x], [s.pz, targetPos.z], [s.py, targetPos.y], [s.tx, targetLook.x], [s.ty, targetLook.y]] as const) {
        damper.value = value;
        damper.velocity = 0;
      }
    } else {
      smoothDamp(s.px, targetPos.x, smooth, dt, 7.5);
      smoothDamp(s.pz, targetPos.z, smooth * 1.05, dt, 6);
      smoothDamp(s.py, targetPos.y, smooth * 1.1, dt, 4);
      // The gaze trails the body slightly: a cheap, convincing "operator" feel.
      smoothDamp(s.tx, targetLook.x, smooth * 1.28, dt, 9);
      smoothDamp(s.ty, targetLook.y, smooth * 1.2, dt, 4);
    }

    const settled =
      isSettled(s.px, targetPos.x, 0.002, 0.004) &&
      isSettled(s.pz, targetPos.z, 0.002, 0.004) &&
      isSettled(s.tx, targetLook.x, 0.002, 0.004) &&
      isSettled(s.ty, targetLook.y, 0.002, 0.004);

    if (settled && !s.arrived && !hold) {
      s.arrived = true;
      s.arrivedAt = s.clock;
      onArrive?.(stopIndex);
    }

    // Settling sway: a slow drift that dies out, so a resting camera costs nothing.
    const sinceArrival = s.arrived ? s.clock - s.arrivedAt : 0;
    const energy = reducedMotion || hold ? 0 : s.arrived ? MathUtils.clamp(1 - sinceArrival / 2.6, 0, 1) : 1;
    const sway = energy * energy;
    const swayX = Math.sin(s.clock * 0.9) * 0.05 * sway;
    const swayY = Math.sin(s.clock * 1.3 + 1) * 0.018 * sway;

    camera.position.set(s.px.value + swayX, s.py.value + swayY, s.pz.value);
    camera.lookAt(s.tx.value + swayX * 0.4, s.ty.value, 0);
    cameraX.current = s.px.value;
    telemetry?.({ x: s.px.value, z: s.pz.value, t: s.clock, target: targetPos.x, smooth });

    if (!settled || energy > 0 || !s.arrived) invalidate();
  });

  return null;
}
