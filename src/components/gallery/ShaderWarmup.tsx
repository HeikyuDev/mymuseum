"use client";

import { useThree } from "@react-three/fiber";
import { useEffect } from "react";

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
    gl.compileAsync(scene, camera).then(finish, finish);
    return () => {
      cancelled = true;
    };
  }, [gl, scene, camera, onDone]);

  return null;
}
