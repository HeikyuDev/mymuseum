/* eslint-disable react-hooks/immutability -- diagnostics hook into the renderer imperatively by design */
"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import type { Material, Mesh, Texture } from "three";
import { perfStore } from "./perf-store";

/** Diagnostics only (?debug=perf): samples renderer.info and CPU render time. Loaded lazily. */
export default function PerfProbe({ tier, level }: { tier: string; level: number }) {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const timing = useRef({ cpu: 0, frames: 0, last: 0, windowStart: 0, lastMem: 0 });

  useEffect(() => {
    perfStore.tier = tier;
    perfStore.level = level;
    (window as unknown as { __galleryPerf?: typeof perfStore }).__galleryPerf = perfStore;
    const original = gl.render.bind(gl);
    gl.render = (target, camera) => {
      const start = performance.now();
      original(target, camera);
      timing.current.cpu += performance.now() - start;
    };
    return () => {
      gl.render = original;
    };
  }, [gl, tier, level]);

  useFrame(() => {
    const t = timing.current;
    const now = performance.now();
    if (perfStore.firstFrameMs === 0) perfStore.firstFrameMs = now;
    if (t.last) perfStore.frameMs += (now - t.last - perfStore.frameMs) * 0.1;
    t.last = now;
    t.frames += 1;
    if (now - t.windowStart > 500) {
      perfStore.fps = (t.frames * 1000) / (now - t.windowStart);
      perfStore.renderCpuMs = t.cpu / Math.max(1, t.frames);
      t.frames = 0;
      t.cpu = 0;
      t.windowStart = now;
      perfStore.pixelRatio = gl.getPixelRatio();
      perfStore.calls = gl.info.render.calls;
      perfStore.triangles = gl.info.render.triangles;
      perfStore.textures = gl.info.memory.textures;
      perfStore.geometries = gl.info.memory.geometries;
      perfStore.programs = gl.info.programs?.length ?? 0;
      if (now - t.lastMem > 2000) {
        t.lastMem = now;
        perfStore.textureMB = estimateTextureMB(scene);
      }
    }
  });
  return null;
}

function estimateTextureMB(scene: { traverse(fn: (object: unknown) => void): void }): number {
  const seen = new Set<Texture>();
  let bytes = 0;
  scene.traverse((object) => {
    const material = (object as Mesh).material as Material | Material[] | undefined;
    for (const m of Array.isArray(material) ? material : material ? [material] : []) {
      for (const value of Object.values(m)) {
        const tex = value as Texture | null;
        if (tex && tex.isTexture && !seen.has(tex)) {
          seen.add(tex);
          const image = tex.image as { width?: number; height?: number } | null;
          if (image?.width && image.height) bytes += image.width * image.height * 4 * 1.33;
        }
      }
    }
  });
  return bytes / (1024 * 1024);
}
