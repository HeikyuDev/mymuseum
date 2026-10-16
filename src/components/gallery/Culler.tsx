"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import type { Object3D } from "three";
import { isFarFrom } from "@/lib/gallery/spot-pool";
import { useGallery } from "./context";

/**
 * Hides zones and artworks far from the camera. Tagged objects carry `userData.cull = [start, end]`
 * (their extent along the wall). Frustum culling would skip them too, but still pays for the
 * traversal; with `visible = false` the renderer never looks at them. No per-frame allocations.
 */
export function Culler() {
  const { cameraX, quality, layout } = useGallery();
  const scene = useThree((state) => state.scene);
  const invalidate = useThree((state) => state.invalidate);
  const tagged = useRef<Object3D[]>([]);

  useEffect(() => {
    const list: Object3D[] = [];
    scene.traverse((object) => {
      if (object.userData.cull) list.push(object);
    });
    tagged.current = list;
    invalidate();
  }, [scene, layout, invalidate]);

  useFrame(() => {
    const list = tagged.current;
    const cx = cameraX.current;
    for (let i = 0; i < list.length; i += 1) {
      const object = list[i];
      const range = object.userData.cull as number[];
      object.visible = !isFarFrom(cx, range[0], range[1], quality.cullDistance);
    }
  });
  return null;
}
