"use client";

import { useThree } from "@react-three/fiber";
import { useEffect } from "react";
import { HalfFloatType, WebGLRenderTarget, type Camera, type Object3D, type Scene, type WebGLRenderer } from "three";
import { useGallery } from "./context";
import { perfStore } from "./perf-store";

/** Zones and artworks drawn per warm-up frame. */
const CHUNK = 6;

/** Waits for a frame, but never longer than 100 ms (a background tab pauses animation frames). */
const nextFrame = () => new Promise<void>((resolve) => {
  requestAnimationFrame(() => resolve());
  setTimeout(resolve, 100);
});

/**
 * Draws every cullable part of the scene once, a few at a time, so their geometry and procedural textures
 * reach the GPU while the loading screen is up. Without it the first sight of a new hall (the culler turns
 * it on as the camera approaches) uploads all of that in the middle of a glide.
 */
async function warmUpload(gl: WebGLRenderer, scene: Scene, camera: Camera, cancelled: () => boolean) {
  const tagged: Object3D[] = [];
  scene.traverse((object) => {
    if (object.userData.cull) tagged.push(object);
  });
  const visibility = tagged.map((object) => object.visible);
  tagged.forEach((object) => (object.visible = false));
  try {
    for (let i = 0; i < tagged.length && !cancelled(); i += CHUNK) {
      const chunk = tagged.slice(i, i + CHUNK);
      const culled: Object3D[] = [];
      for (const object of chunk) {
        object.visible = true;
        object.traverse((child) => {
          if (child.frustumCulled) {
            child.frustumCulled = false;
            culled.push(child);
          }
        });
      }
      gl.render(scene, camera);
      culled.forEach((child) => (child.frustumCulled = true));
      chunk.forEach((object) => (object.visible = false));
      await nextFrame();
    }
  } finally {
    tagged.forEach((object, i) => (object.visible = visibility[i]));
  }
}

/**
 * A planar reflection draws the whole scene again into a render target, and a render target has its own
 * shader variants (linear output, no tone mapping). Compiling against a throwaway target covers them, instead
 * of compiling each material the first time it shows up in a mirror during a glide.
 */
async function compileForReflections(gl: WebGLRenderer, scene: Scene, camera: Camera) {
  const target = new WebGLRenderTarget(8, 8, { type: HalfFloatType });
  try {
    gl.setRenderTarget(target);
    await gl.compileAsync(scene, camera);
  } finally {
    gl.setRenderTarget(null);
    target.dispose();
  }
}

/**
 * Prepares the scene before the first frame, behind the loading screen: compiles every material (the
 * browser's parallel shader compilation keeps the curtain animating instead of freezing) and uploads the
 * geometry and textures of every hall.
 */
export function ShaderWarmup({ onDone }: { onDone: () => void }) {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const camera = useThree((state) => state.camera);
  const { quality, snapshot } = useGallery();
  const needsReflector = quality.reflector;

  useEffect(() => {
    let cancelled = false;
    const started = performance.now();
    const done = () => {
      perfStore.compileMs = performance.now() - started;
      if (!cancelled) onDone();
    };
    // The polished-floor material is a lazy chunk: wait for it (and for React to mount it) so its shader is
    // compiled here too, instead of during the first glide.
    const reflector = needsReflector ? import("./ReflectorFloor").then(() => new Promise<void>((resolve) => setTimeout(resolve, 120))) : Promise.resolve();
    reflector
      .catch(() => undefined)
      .then(() => (cancelled ? undefined : gl.compileAsync(scene, camera)))
      .then(() => (cancelled || !needsReflector ? undefined : compileForReflections(gl, scene, camera)))
      .then(() => (cancelled || snapshot ? undefined : warmUpload(gl, scene, camera, () => cancelled)))
      .then(done, done);
    return () => {
      cancelled = true;
    };
  }, [gl, scene, camera, onDone, needsReflector, snapshot]);

  return null;
}
