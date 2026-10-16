"use client";

import { BoxGeometry, DoubleSide, PlaneGeometry } from "three";
import { FLOOR_DECORATION_SPECS } from "@/lib/scene-palette";
import type { MuseumLayout } from "@/lib/gallery/layout";
import type { ZoneLook } from "@/lib/gallery/scene-look";
import { useGallery } from "./context";
import { metricPlane } from "./geometry";
import { mergeAll } from "./resources";
import { makeLightPoolTexture } from "./text-textures";

type Props = { zoneIndex: number; look: ZoneLook; layout: MuseumLayout; range: readonly [number, number] };

const RUNNER_Z = 1.25; // runners hug the art wall, where the floor is seen
const RUNNER_WIDTH = 1.7;
const TRIM_COLOR = "#b49a62";

export function FloorDecoration({ zoneIndex, look, layout, range }: Props) {
  const { quality } = useGallery();
  if (look.decoration === "none") return null;
  const spec = FLOOR_DECORATION_SPECS[look.decoration];
  const color = look.decorationColor ?? spec.color;
  const artworks = layout.artworks.filter((a) => a.zoneIndex === zoneIndex);
  if (spec.kind === "runner") {
    return <Runner range={range} color={color} trimmed={look.decoration === "red_carpet" || look.decoration === "runner_gold_trim"} />;
  }
  if (spec.kind === "rug") {
    return (
      <>
        {artworks.map((a) => (
          <Rug key={a.id} x={a.x} width={Math.min(2.4, Math.max(1.7, a.outerW + 0.4))} color={color} persian={look.decoration === "rug_persian"} />
        ))}
      </>
    );
  }
  // Light pools are a baked effect already; they stay on every tier (one cheap additive quad each).
  void quality;
  return (
    <>
      {artworks.map((a) => (
        <LightPool key={a.id} x={a.x} radius={Math.max(1.4, a.outerW * 0.95)} color={color} />
      ))}
    </>
  );
}

/**
 * A woven runner: a pile top with a tight soft weave, a slightly darker flat border and a thin
 * muted trim line inset from the edge. The thickness is a low box so the edge catches light.
 */
function Runner({ range, color, trimmed }: { range: readonly [number, number]; color: string; trimmed: boolean }) {
  const { surfaces, resources } = useGallery();
  const [r0, r1] = range;
  const length = r1 - r0 - 0.5;
  const center = (r0 + r1) / 2;
  const maps = surfaces.pile(color);
  const key = length.toFixed(3);
  const top = resources.geometry(`runner-top:${key}`, () => metricPlane(length, RUNNER_WIDTH, 1.1));
  const body = resources.geometry(`runner-body:${key}`, () => new BoxGeometry(length, 0.018, RUNNER_WIDTH));
  const trimGeometry = resources.geometry(`runner-trim:${key}`, () => {
    const inset = 0.1;
    const line = 0.022;
    const flat = (w: number, d: number, x: number, z: number) => new PlaneGeometry(w, d).rotateX(-Math.PI / 2).translate(x, 0, z);
    return mergeAll([
      flat(length - 2 * inset, line, 0, RUNNER_WIDTH / 2 - inset),
      flat(length - 2 * inset, line, 0, -(RUNNER_WIDTH / 2 - inset)),
      flat(line, RUNNER_WIDTH - 2 * inset + line, length / 2 - inset, 0),
      flat(line, RUNNER_WIDTH - 2 * inset + line, -(length / 2 - inset), 0),
    ]);
  });
  const pile = resources.surface(`runner-pile:${color}`, { map: maps.color, bumpMap: maps.bump, bumpScale: 0.45, roughnessMap: maps.rough, color: "#ffffff", roughness: 1 });
  const edge = resources.surface(`runner-edge:${color}`, { color, roughness: 1 });
  const trim = resources.surface(`runner-trim:${TRIM_COLOR}`, { color: TRIM_COLOR, roughness: 0.6, metalness: 0.25, envMapIntensity: 0.4 });
  return (
    <group position={[center, 0, RUNNER_Z]}>
      <mesh geometry={top} material={pile} position={[0, 0.0185, 0]} rotation={[-Math.PI / 2, 0, 0]} />
      <mesh geometry={body} material={edge} position={[0, 0.009, 0]} />
      {trimmed ? <mesh geometry={trimGeometry} material={trim} position={[0, 0.0195, 0]} /> : null}
    </group>
  );
}

function Rug({ x, width, color, persian }: { x: number; width: number; color: string; persian: boolean }) {
  const { surfaces, resources } = useGallery();
  const texture = surfaces.rug(color, persian);
  const depth = width / 1.6;
  const geometry = resources.geometry(`rug:${width.toFixed(3)}`, () => new PlaneGeometry(width, depth));
  const material = resources.surface(`rug:${persian ? "p" : "g"}:${color}`, { map: texture, roughness: 1 });
  return <mesh geometry={geometry} material={material} position={[x, 0.012, 1.15]} rotation={[-Math.PI / 2, 0, 0]} />;
}

function LightPool({ x, radius, color }: { x: number; radius: number; color: string }) {
  const { resources } = useGallery();
  const texture = resources.texture(`pool:${color}`, () => makeLightPoolTexture(color));
  const material = resources.basic(`pool:${color}`, { map: texture, opacity: 0.5, depthWrite: false, side: DoubleSide });
  const geometry = resources.geometry(`pool:${radius.toFixed(3)}`, () => new PlaneGeometry(radius * 2.2, radius * 1.5));
  return <mesh geometry={geometry} material={material} position={[x, 0.008, 1.0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={2} />;
}
