"use client";

import { useThree } from "@react-three/fiber";
import { useEffect } from "react";
import { perfStore } from "./perf-store";

/**
 * Compiles every material before the first frame. `compileAsync` uses the
 * browser's parallel shader compilation, so the page stays responsive (the
 * loading curtain keeps animating) instead of freezing on the first render.
 */
export function ShaderWarmup({ onDone }: { onDone: () => void }) {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const camera = useThree((state) => state.camera);

  useEffect(() => {
    let cancelled = false;
    const finish = () => {
      if (!cancelled) onDone();
    };
    // Falls back to a synchronous compile when parallel compilation is unavailable.
    const started = performance.now();
    const done = () => {
      perfStore.compileMs = performance.now() - started;
      finish();
    };
    gl.compileAsync(scene, camera).then(done, done);
    return () => {
      cancelled = true;
    };
  }, [gl, scene, camera, onDone]);

  return null;
}
