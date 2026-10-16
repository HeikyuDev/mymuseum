"use client";

import { useEffect, useMemo } from "react";
import { CanvasTexture, ExtrudeGeometry, Path, Shape, ShapeGeometry, SRGBColorSpace } from "three";
import { PORTAL_HEIGHT, PORTAL_WIDTH, ROOM_DEPTH, WALL_HEIGHT } from "@/lib/gallery/layout";
import { WALL_FINISH, isDarkColor, type ZoneLook } from "@/lib/gallery/scene-look";
import { useGallery } from "./context";
import { metersToTiles } from "./geometry";
import { makeInscriptionTexture } from "./text-textures";

export const PORTAL_FRAME = 0.5; // wall left of the opening on each side
const SURROUND = 0.34; // width of the stone band around the arch
const ARCH_Y = PORTAL_HEIGHT - PORTAL_WIDTH / 2;

export const PORTAL_SEGMENT_WIDTH = PORTAL_WIDTH + 2 * PORTAL_FRAME;

function archPath(path: Path | Shape, radius: number, reverse: boolean) {
  const half = radius;
  if (!reverse) {
    path.moveTo(-half, 0);
    path.lineTo(-half, ARCH_Y);
    path.absarc(0, ARCH_Y, half, Math.PI, 0, true);
    path.lineTo(half, 0);
    path.lineTo(-half, 0);
  } else {
    path.moveTo(-half, 0);
    path.lineTo(half, 0);
    path.lineTo(half, ARCH_Y);
    path.absarc(0, ARCH_Y, half, 0, Math.PI, false);
    path.lineTo(-half, 0);
  }
}

function glowTexture(center: string, edge: string): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 192;
  const ctx = canvas.getContext("2d")!;
  const gradient = ctx.createRadialGradient(64, 110, 6, 64, 96, 120);
  gradient.addColorStop(0, center);
  gradient.addColorStop(1, edge);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 192);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

function gradientTexture(top: string, bottom: string): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 4;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  const gradient = ctx.createLinearGradient(0, 0, 0, 256);
  gradient.addColorStop(0, top);
  gradient.addColorStop(1, bottom);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 4, 256);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

type Props = {
  x: number;
  /** Hall name engraved above the arch. */
  title: string;
  /** Look of the hall the portal opens into. */
  look: ZoneLook;
};

/** A stone archway with the hall name; the opening shows a lit passage into the next hall. */
export function Portal({ x, title, look }: Props) {
  const { surfaces, mood, fonts, museumTitle, quality, accent } = useGallery();
  const wallMaps = surfaces.wall(look.wallStyle, look.wallColor);
  const finish = WALL_FINISH[look.wallStyle];
  const dark = isDarkColor(look.wallColor);

  const geometries = useMemo(() => {
    const wall = new Shape();
    wall.moveTo(-PORTAL_SEGMENT_WIDTH / 2, 0);
    wall.lineTo(PORTAL_SEGMENT_WIDTH / 2, 0);
    wall.lineTo(PORTAL_SEGMENT_WIDTH / 2, WALL_HEIGHT);
    wall.lineTo(-PORTAL_SEGMENT_WIDTH / 2, WALL_HEIGHT);
    wall.lineTo(-PORTAL_SEGMENT_WIDTH / 2, 0);
    const hole = new Path();
    archPath(hole, PORTAL_WIDTH / 2, true);
    wall.holes.push(hole);
    const wallGeometry = new ShapeGeometry(wall, 24);
    // Offset UVs so the texture lines up with the neighbouring plain wall.
    const uv = wallGeometry.getAttribute("uv");
    for (let i = 0; i < uv.count; i += 1) uv.setX(i, uv.getX(i) + PORTAL_SEGMENT_WIDTH / 2);
    metersToTiles(wallGeometry, wallMaps.tileMeters);

    const band = (outer: number, inner: number) => {
      const shape = new Shape();
      archPath(shape, outer, false);
      const cut = new Path();
      archPath(cut, inner, true);
      shape.holes.push(cut);
      return shape;
    };
    const stone = new ExtrudeGeometry(band(PORTAL_WIDTH / 2 + SURROUND, PORTAL_WIDTH / 2), {
      depth: 0.2,
      bevelEnabled: true,
      bevelThickness: 0.018,
      bevelSize: 0.018,
      bevelSegments: 2,
      curveSegments: 28,
    });
    const line = new ExtrudeGeometry(band(PORTAL_WIDTH / 2 + 0.05, PORTAL_WIDTH / 2 - 0.0), {
      depth: 0.235,
      bevelEnabled: false,
      curveSegments: 28,
    });
    return { wall: wallGeometry, stone, line };
  }, [wallMaps.tileMeters]);
  useEffect(
    () => () => {
      geometries.wall.dispose();
      geometries.stone.dispose();
      geometries.line.dispose();
    },
    [geometries],
  );

  const glow = useMemo(() => glowTexture(dark ? "#ffe9b8" : "#fff8e8", dark ? "#3c2e1c" : "#9c8560"), [dark]);
  const shade = useMemo(() => gradientTexture(dark ? "#8f7448" : "#c9b690", "#3a2f22"), [dark]);
  useEffect(
    () => () => {
      glow.dispose();
      shade.dispose();
    },
    [glow, shade],
  );

  const inscriptionColor = dark ? "#e5c779" : "#3a342b";
  const inscription = useMemo(
    () =>
      makeInscriptionTexture({
        text: title,
        eyebrow: museumTitle,
        aspect: 6.2,
        family: fonts.display,
        bodyFamily: fonts.body,
        color: inscriptionColor,
        shadow: dark ? "rgba(0,0,0,0.65)" : "rgba(255,255,255,0.75)",
        pixelHeight: quality.tier === "low" ? 128 : 256,
      }),
    [title, museumTitle, fonts.display, fonts.body, inscriptionColor, dark, quality.tier],
  );
  useEffect(() => () => inscription.dispose(), [inscription]);

  const bandHeight = WALL_HEIGHT - (PORTAL_HEIGHT + SURROUND);
  const textY = PORTAL_HEIGHT + SURROUND + bandHeight / 2 - 0.12;
  const stoneColor = dark ? "#cfc6b6" : "#efebe2";
  const accentColor = look.accent ?? accent;
  const passageHeight = PORTAL_HEIGHT;

  return (
    <group position={[x, 0, 0]}>
      {/* wall around the opening */}
      <mesh geometry={geometries.wall} receiveShadow>
        <meshStandardMaterial
          map={wallMaps.color}
          bumpMap={wallMaps.bump}
          bumpScale={finish.bump}
          roughnessMap={wallMaps.rough}
          roughness={finish.roughness}
          color={mood.tint}
          envMapIntensity={0.25}
        />
      </mesh>

      {/* stone surround and a thin accent reveal */}
      <mesh geometry={geometries.stone} position={[0, 0, 0]} castShadow receiveShadow>
        <meshStandardMaterial color={stoneColor} roughness={0.62} envMapIntensity={0.5} />
      </mesh>
      <mesh geometry={geometries.line} position={[0, 0, 0]}>
        <meshStandardMaterial color={accentColor} metalness={0.8} roughness={0.35} envMapIntensity={1.2} />
      </mesh>

      {/* the passage behind the arch: a warm lit corridor into the next hall */}
      <group>
        <mesh position={[0, passageHeight / 2 + 0.2, -2.2]}>
          <planeGeometry args={[PORTAL_WIDTH + 0.4, passageHeight + 0.9]} />
          <meshBasicMaterial map={glow} toneMapped={false} />
        </mesh>
        {[-1, 1].map((side) => (
          <mesh key={side} position={[side * (PORTAL_WIDTH / 2 + 0.01), passageHeight / 2 + 0.2, -1.1]} rotation={[0, (-side * Math.PI) / 2, 0]}>
            <planeGeometry args={[2.2, passageHeight + 0.9]} />
            <meshBasicMaterial map={shade} toneMapped={false} />
          </mesh>
        ))}
        <mesh position={[0, 0.005, -1.1]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[PORTAL_WIDTH, 2.2]} />
          <meshBasicMaterial color={dark ? "#4a3b28" : "#cdbf9f"} toneMapped={false} />
        </mesh>
        <mesh position={[0, passageHeight + 0.1, -1.1]} rotation={[Math.PI / 2, 0, 0]}>
          <planeGeometry args={[PORTAL_WIDTH + 0.4, 2.2]} />
          <meshBasicMaterial color={dark ? "#6a5638" : "#e7dcc3"} toneMapped={false} />
        </mesh>
      </group>

      {/* engraved hall name */}
      <mesh position={[0, textY, 0.014]}>
        <planeGeometry args={[3.7, 3.7 / 6.2]} />
        <meshBasicMaterial map={inscription} transparent depthWrite={false} toneMapped={false} />
      </mesh>

      {/* a ceiling beam gives the opening presence from oblique angles */}
      <mesh position={[0, WALL_HEIGHT - 0.14, ROOM_DEPTH / 2]} receiveShadow>
        <boxGeometry args={[0.28, 0.28, ROOM_DEPTH]} />
        <meshStandardMaterial color={stoneColor} roughness={0.7} />
      </mesh>
    </group>
  );
}
