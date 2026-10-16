"use client";

import { BoxGeometry, CircleGeometry, CylinderGeometry, Object3D, type BufferGeometry } from "three";
import { WALL_HEIGHT } from "@/lib/gallery/layout";
import { useGallery } from "./context";
import { mergeAll } from "./resources";

const TRACK_Z = 2.5;

/**
 * The lighting track and one fixture head per artwork, merged into two meshes per zone
 * (metal body, glowing lens) instead of three meshes per artwork.
 */
export function CeilingTrack({ range, xs, lit }: { range: readonly [number, number]; xs: number[]; lit: boolean }) {
  const { resources } = useGallery();
  const length = range[1] - range[0];
  const key = `${length.toFixed(3)}:${xs.map((x) => x.toFixed(2)).join(",")}`;
  const body = resources.geometry(`track-body:${key}`, () => {
    const parts: BufferGeometry[] = [new BoxGeometry(length, 0.05, 0.06).translate((range[0] + range[1]) / 2, WALL_HEIGHT - 0.03, TRACK_Z)];
    const dummy = new Object3D();
    for (const x of xs) {
      const head = new CylinderGeometry(0.055, 0.07, 0.2, 14);
      dummy.position.set(x, WALL_HEIGHT - 0.2, TRACK_Z);
      dummy.rotation.set(-0.62, 0, 0);
      dummy.updateMatrix();
      head.applyMatrix4(dummy.matrix);
      parts.push(head);
    }
    return mergeAll(parts);
  });
  const lenses = resources.geometry(`track-lens:${key}`, () => {
    const dummy = new Object3D();
    const parts = xs.map((x) => {
      const lens = new CircleGeometry(0.052, 14).rotateX(Math.PI / 2).translate(0, -0.103, 0);
      dummy.position.set(x, WALL_HEIGHT - 0.2, TRACK_Z);
      dummy.rotation.set(-0.62, 0, 0);
      dummy.updateMatrix();
      lens.applyMatrix4(dummy.matrix);
      return lens;
    });
    return mergeAll(parts.length > 0 ? parts : [new CircleGeometry(0.001, 3)]);
  });
  const metal = resources.surface("track-metal", { color: "#2b2926", roughness: 0.55, metalness: 0.4, envMapIntensity: 0.5 });
  // Fixtures of a hall whose lighting is Off are dark: no glowing lenses.
  const lens = resources.basic(`track-lens:${lit ? "on" : "off"}`, { color: lit ? "#fff3d4" : "#3a3835" });
  return (
    <group>
      <mesh geometry={body} material={metal} />
      {xs.length > 0 ? <mesh geometry={lenses} material={lens} /> : null}
    </group>
  );
}
