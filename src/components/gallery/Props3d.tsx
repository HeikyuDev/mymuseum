"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import {
  BoxGeometry,
  CatmullRomCurve3,
  CircleGeometry,
  CylinderGeometry,
  InstancedMesh,
  Matrix4,
  Object3D,
  SphereGeometry,
  TubeGeometry,
  Vector3,
  type BufferGeometry,
} from "three";
import { ENTRANCE_LETTERING_WIDTH, DIVIDER_WIDTH, type MuseumLayout } from "@/lib/gallery/layout";
import type { ZoneLook } from "@/lib/gallery/scene-look";
import { useGallery } from "./context";
import { colored, mergeAll } from "./resources";

// Simple, tasteful gallery furniture: benches, plants, rope barriers. Every prop is built from
// merged geometry with vertex colors and shared materials, so a plant or a bench is one or two
// draw calls and posts are instanced.

type Props = { zoneIndex: number; look: ZoneLook; layout: MuseumLayout };

export function Props3d({ zoneIndex, look, layout }: Props) {
  const { quality } = useGallery();
  if (!quality.props || look.decor.length === 0) return null;
  const artworks = layout.artworks.filter((a) => a.zoneIndex === zoneIndex);
  const zone = layout.zones[zoneIndex];
  // Plants flank the divider wall of a category and the lettered entrance wall.
  const plantXs =
    zoneIndex === 0
      ? [layout.entrance.centerX - ENTRANCE_LETTERING_WIDTH / 2 - 1.3, layout.entrance.centerX + ENTRANCE_LETTERING_WIDTH / 2 + 1.3]
      : [zone.dividerX - DIVIDER_WIDTH / 2 - 0.7, zone.dividerX + DIVIDER_WIDTH / 2 + 0.7];
  return (
    <group>
      {look.decor.includes("rope_barriers") ? <RopeLine artworks={artworks} /> : null}
      {look.decor.includes("benches")
        ? artworks
            .filter((_, i) => i % 3 === 1)
            .map((a) => <Bench key={a.id} x={a.x} width={Math.min(1.8, Math.max(1.1, a.outerW * 0.8))} dark={look.wallStyle === "wood_panel"} />)
        : null}
      {look.decor.includes("plants") ? (
        <>
          <Plant x={plantXs[0]} scale={0.95} variant={0} />
          <Plant x={plantXs[1]} scale={0.85} variant={1} />
        </>
      ) : null}
    </group>
  );
}

function Bench({ x, width, dark }: { x: number; width: number; dark: boolean }) {
  const { resources, quality } = useGallery();
  const shadows = quality.shadows;
  const geometry = resources.geometry(`bench:${width.toFixed(2)}:${dark ? "d" : "l"}`, () =>
    mergeAll([
      colored(new BoxGeometry(width, 0.08, 0.42).translate(0, 0.43, 0), "#4a3d33"),
      colored(new BoxGeometry(width - 0.04, 0.035, 0.38).translate(0, 0.4675, 0), dark ? "#33271d" : "#3a322c"),
      colored(new BoxGeometry(0.05, 0.4, 0.36).translate(width / 2 - 0.12, 0.2, 0), "#2a2725"),
      colored(new BoxGeometry(0.05, 0.4, 0.36).translate(-(width / 2 - 0.12), 0.2, 0), "#2a2725"),
    ]),
  );
  const material = resources.surface("prop:bench", { color: "#ffffff", roughness: 0.62, vertexColors: true });
  return <mesh geometry={geometry} material={material} position={[x, 0, 1.45]} castShadow={shadows} receiveShadow={shadows} />;
}

const LEAVES = [14, 18] as const;

function plantGeometries(variant: 0 | 1): { pot: BufferGeometry; leaves: BufferGeometry } {
  const pot = mergeAll([
    colored(new CylinderGeometry(0.25, 0.19, 0.56, 28).translate(0, 0.28, 0), "#d8d0c2"),
    colored(new CylinderGeometry(0.265, 0.265, 0.03, 28).translate(0, 0.575, 0), "#cfc6b6"),
    colored(new CircleGeometry(0.235, 24).rotateX(-Math.PI / 2).translate(0, 0.57, 0), "#2b2118"),
  ]);
  const count = LEAVES[variant];
  const dummy = new Object3D();
  const blades: BufferGeometry[] = [];
  for (let i = 0; i < count; i += 1) {
    const theta = (i / count) * Math.PI * 2 + (i % 3) * 0.3;
    const phi = 0.1 + (i % 5) * 0.09 + variant * 0.05;
    const length = (variant === 0 ? 0.85 : 0.65) + ((i * 7) % 6) * 0.09;
    // A slender blade: a flattened ellipsoid leaning out from the pot's center.
    dummy.position.set(0, 0.58, 0);
    dummy.rotation.set(0, theta, 0);
    dummy.updateMatrix();
    const lean = new Matrix4().makeRotationZ(-phi);
    const place = new Matrix4().makeTranslation(0, length * 0.5, 0);
    const scale = new Matrix4().makeScale(0.045 + (i % 2) * 0.012, length * 0.5, 0.012);
    const blade = new SphereGeometry(1, 8, 6);
    blade.applyMatrix4(scale);
    blade.applyMatrix4(place);
    blade.applyMatrix4(lean);
    blade.applyMatrix4(dummy.matrix);
    blades.push(colored(blade, i % 2 === 0 ? "#496748" : "#5e7d58"));
  }
  return { pot, leaves: mergeAll(blades) };
}

function Plant({ x, scale = 1, variant }: { x: number; scale?: number; variant: 0 | 1 }) {
  const { resources, quality } = useGallery();
  const shadows = quality.shadows;
  const parts = useMemo(
    () => ({ pot: resources.geometry(`plant-pot:${variant}`, () => plantGeometries(variant).pot), leaves: resources.geometry(`plant-leaves:${variant}`, () => plantGeometries(variant).leaves) }),
    [resources, variant],
  );
  const potMaterial = resources.surface("prop:pot", { color: "#ffffff", roughness: 0.8, vertexColors: true });
  const leafMaterial = resources.surface("prop:leaf", { color: "#ffffff", roughness: 0.75, vertexColors: true });
  return (
    <group position={[x, 0, 0.75]} scale={scale}>
      <mesh geometry={parts.pot} material={potMaterial} castShadow={shadows} receiveShadow={shadows} />
      <mesh geometry={parts.leaves} material={leafMaterial} castShadow={shadows} />
    </group>
  );
}

const ROPE_Z = 1.55;

function RopeLine({ artworks }: { artworks: MuseumLayout["artworks"] }) {
  const { snapshot, resources } = useGallery();
  const posts = useMemo(() => {
    // Posts stand in the gaps between artworks so they never hide a placard.
    const xs: number[] = [];
    artworks.forEach((a, i) => {
      const left = a.x - a.outerW / 2;
      const right = a.x + a.outerW / 2;
      if (i === 0) xs.push(left - 0.7);
      const next = artworks[i + 1];
      xs.push(next ? (right + (next.x - next.outerW / 2)) / 2 : right + 0.7);
    });
    return xs;
  }, [artworks]);

  const postGeometry = resources.geometry("stanchion", () =>
    mergeAll([
      new CylinderGeometry(0.16, 0.18, 0.035, 24).translate(0, 0.0175, 0),
      new CylinderGeometry(0.026, 0.026, 0.9, 12).translate(0, 0.485, 0),
      new SphereGeometry(0.048, 14, 10).translate(0, 0.95, 0),
    ]),
  );
  // Brushed brass: warm and matte enough not to glare under the lights.
  const brass = resources.surface("prop:brass", { color: "#a98a4c", metalness: 0.85, roughness: 0.5, envMapIntensity: 0.9 });
  const ropeMaterial = resources.surface("prop:rope", { color: "#6c2c38", roughness: 0.9 });

  // A photographer unhooks the ropes so they never cross the placards in a photo.
  const ropeGeometry = snapshot || posts.length < 2 ? null : resources.geometry(`ropes:${posts.map((p) => p.toFixed(2)).join(",")}`, () => {
    const tubes = posts.slice(0, -1).map((from, i) => {
      const to = posts[i + 1];
      const sag = Math.min(0.2, (to - from) * 0.045);
      const points = [0, 0.25, 0.5, 0.75, 1].map((t) => new Vector3(from + (to - from) * t, 0.88 - Math.sin(t * Math.PI) * sag, ROPE_Z));
      return new TubeGeometry(new CatmullRomCurve3(points), 28, 0.016, 8, false);
    });
    return mergeAll(tubes);
  });

  return (
    <group>
      <Instances geometry={postGeometry} material={brass} positions={posts} z={ROPE_Z} />
      {ropeGeometry ? <mesh geometry={ropeGeometry} material={ropeMaterial} /> : null}
    </group>
  );
}

/** One instanced mesh for a row of identical props along x. */
function Instances({ geometry, material, positions, z }: { geometry: BufferGeometry; material: React.ComponentProps<"mesh">["material"]; positions: number[]; z: number }) {
  const ref = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const matrix = new Matrix4();
    positions.forEach((x, i) => mesh.setMatrixAt(i, matrix.makeTranslation(x, 0, z)));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [positions, z]);
  return <instancedMesh ref={ref} args={[geometry, material as never, positions.length]} key={positions.length} />;
}
