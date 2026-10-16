"use client";

import { useEffect, useMemo } from "react";
import { DoubleSide } from "three";
import { FLOOR_DECORATION_SPECS } from "@/lib/scene-palette";
import type { MuseumLayout } from "@/lib/gallery/layout";
import type { ZoneLook } from "@/lib/gallery/scene-look";
import { useGallery } from "./context";
import { metricPlane } from "./geometry";
import { makeLightPoolTexture } from "./text-textures";

type Props = { zoneIndex: number; look: ZoneLook; layout: MuseumLayout; range: readonly [number, number] };

const RUNNER_Z = 1.25; // runners hug the art wall, where the floor is seen
const RUNNER_WIDTH = 1.9;

export function FloorDecoration({ zoneIndex, look, layout, range }: Props) {
  if (look.decoration === "none") return null;
  const spec = FLOOR_DECORATION_SPECS[look.decoration];
  const color = look.decorationColor ?? spec.color;
  const artworks = layout.artworks.filter((a) => a.zoneIndex === zoneIndex);
  if (spec.kind === "runner") {
    return <Runner range={range} color={color} gold={look.decoration === "red_carpet" || look.decoration === "runner_gold_trim"} />;
  }
  if (spec.kind === "rug") {
    return (
      <>
        {artworks.map((a) => (
          <Rug key={a.id} x={a.x} width={Math.min(2.6, Math.max(1.8, a.outerW + 0.5))} color={color} persian={look.decoration === "rug_persian"} />
        ))}
      </>
    );
  }
  return (
    <>
      {artworks.map((a) => (
        <LightPool key={a.id} x={a.x} radius={Math.max(1.4, a.outerW * 0.95)} color={color} />
      ))}
    </>
  );
}

function Runner({ range, color, gold }: { range: readonly [number, number]; color: string; gold: boolean }) {
  const { surfaces } = useGallery();
  const [r0, r1] = range;
  const length = r1 - r0 - 0.4;
  const center = (r0 + r1) / 2;
  const maps = surfaces.pile(color);
  const top = useMemo(() => metricPlane(length, RUNNER_WIDTH, 1.1), [length]);
  useEffect(() => () => top.dispose(), [top]);

  const trimInset = 0.11;
  const trim = "#d4af37";
  return (
    <group position={[center, 0, RUNNER_Z]}>
      {/* pile */}
      <mesh geometry={top} position={[0, 0.021, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <meshStandardMaterial map={maps.color} bumpMap={maps.bump} bumpScale={0.6} roughnessMap={maps.rough} color="#ffffff" roughness={1} />
      </mesh>
      {/* edges give the runner real thickness */}
      <mesh position={[0, 0.0105, 0]} castShadow receiveShadow>
        <boxGeometry args={[length, 0.021, RUNNER_WIDTH]} />
        <meshStandardMaterial color={color} roughness={1} />
      </mesh>
      {gold ? (
        <>
          {[-1, 1].map((side) => (
            <mesh key={`long-${side}`} position={[0, 0.0225, side * (RUNNER_WIDTH / 2 - trimInset)]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[length - 2 * trimInset, 0.035]} />
              <meshStandardMaterial color={trim} metalness={0.85} roughness={0.35} />
            </mesh>
          ))}
          {[-1, 1].map((side) => (
            <mesh key={`end-${side}`} position={[side * (length / 2 - trimInset), 0.0225, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[0.035, RUNNER_WIDTH - 2 * trimInset + 0.035]} />
              <meshStandardMaterial color={trim} metalness={0.85} roughness={0.35} />
            </mesh>
          ))}
        </>
      ) : null}
    </group>
  );
}

function Rug({ x, width, color, persian }: { x: number; width: number; color: string; persian: boolean }) {
  const { surfaces } = useGallery();
  const texture = surfaces.rug(color, persian);
  const depth = width / 1.6;
  return (
    <mesh position={[x, 0.012, 1.15]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[width, depth]} />
      <meshStandardMaterial map={texture} roughness={1} />
    </mesh>
  );
}

function LightPool({ x, radius, color }: { x: number; radius: number; color: string }) {
  const texture = useMemo(() => makeLightPoolTexture(color), [color]);
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <mesh position={[x, 0.008, 1.0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={2}>
      <planeGeometry args={[radius * 2.2, radius * 1.5]} />
      <meshBasicMaterial map={texture} transparent opacity={0.5} depthWrite={false} side={DoubleSide} toneMapped={false} />
    </mesh>
  );
}
