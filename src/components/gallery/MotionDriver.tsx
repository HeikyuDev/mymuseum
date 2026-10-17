"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect } from "react";
import { useGallery } from "./context";

/** Full-size textures wait this long after the camera arrives before they go to the GPU. */
const REST_DELAY_MS = 90;
/** Decoding large photos (a short main-thread step when they finish) starts only after the camera has rested this long. */
const DECODE_DELAY_MS = 280;
/** The lowered resolution comes back in two steps once the camera rests. */
const RESTORE_STEP_MS = 110;

/**
 * Sends decoded photos to the GPU: one texture per frame, full-size ones only while the camera rests,
 * so a glide never pays for an upload (or for the mipmaps) of the artwork it is about to show.
 */
export function TextureUploader() {
  const { photos, motion } = useGallery();
  const gl = useThree((state) => state.gl);
  const frameloop = useThree((state) => state.frameloop);
  const invalidate = useThree((state) => state.invalidate);

  useEffect(() => {
    photos.attach(gl, () => invalidate(), () => !motion.moving && performance.now() - motion.restSince > DECODE_DELAY_MS);
    return () => photos.detach();
  }, [photos, gl, invalidate, motion]);

  // Photos decoded behind the loading screen are waiting; draw as soon as frames are allowed.
  useEffect(() => {
    if (frameloop !== "never") invalidate();
  }, [frameloop, invalidate]);

  useFrame(() => {
    // Keep frames coming while work waits for the camera to rest (it runs in the frame loop).
    if (photos.waiting > 0) {
      if (!motion.moving && performance.now() - motion.restSince > DECODE_DELAY_MS) photos.startDeferred();
      else invalidate();
    }
    if (photos.pending === 0) return;
    const resting = !motion.moving && performance.now() - motion.restSince > REST_DELAY_MS;
    photos.uploadOne(!resting);
    if (photos.pending > 0) invalidate();
  });
  return null;
}

/**
 * Dynamic resolution: the drawing buffer shrinks while the camera glides (fill rate is the first thing a
 * phone runs out of) and comes back in two short steps once it rests. The change is made inside the frame
 * callback so the new size is drawn in the same frame, never a blank canvas.
 */
export function MotionResolution() {
  const { quality, motion } = useGallery();
  const scale = quality.moveScale;

  useFrame((state) => {
    if (scale >= 1) return;
    const gl = state.gl;
    const base = state.viewport.dpr;
    let factor = 1;
    if (motion.moving) {
      factor = scale;
    } else {
      const sinceRest = performance.now() - motion.restSince;
      if (sinceRest < RESTORE_STEP_MS) factor = scale;
      else if (sinceRest < RESTORE_STEP_MS * 2) factor = (scale + 1) / 2;
      else factor = 1;
      if (factor < 1) state.invalidate();
    }
    const wanted = base * factor;
    if (Math.abs(gl.getPixelRatio() - wanted) > 0.01) gl.setPixelRatio(wanted);
  });
  return null;
}
