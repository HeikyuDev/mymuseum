"use client";

import { useEffect, useMemo } from "react";
import { BoxGeometry, Color, ExtrudeGeometry, Float32BufferAttribute, Path, PlaneGeometry, Shape, ShapeGeometry, type BufferGeometry } from "three";
import { PORTAL_HEIGHT, PORTAL_WIDTH, ROOM_DEPTH, WALL_HEIGHT } from "@/lib/gallery/layout";
import { isDarkColor, type ZoneLook } from "@/lib/gallery/scene-look";
import { useGallery } from "./context";
import { metersToTiles } from "./geometry";
import { makeInscriptionTexture } from "./text-textures";
import { wallMaterialFor } from "./Zone";

export const PORTAL_FRAME = 0.5; // wall left of the opening on each side
const SURROUND = 0.34; // width of the stone band around the arch
const ARCH_Y = PORTAL_HEIGHT - PORTAL_WIDTH / 2;
/** How deep the vestibule behind the arch reads (the wall is this thick). */
const VESTIBULE_DEPTH = 2.6;

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

function band(outer: number, inner: number): Shape {
  const shape = new Shape();
  archPath(shape, outer, false);
  const cut = new Path();
  archPath(cut, inner, true);
  shape.holes.push(cut);
  return shape;
}

/**
 * The vestibule: a real tube with thick walls, an arched ceiling and returns, extruded behind
 * the opening. Vertex colors blend from the hall you leave to the hall you enter and fall off
 * with depth, so the passage reads as a soft light gradient between the two palettes.
 */
function vestibuleGeometry(from: string, to: string): BufferGeometry {
  const tube = new ExtrudeGeometry(band(PORTAL_WIDTH / 2 + 0.5, PORTAL_WIDTH / 2), { depth: VESTIBULE_DEPTH, bevelEnabled: false, curveSegments: 24 });
  tube.translate(0, 0, -VESTIBULE_DEPTH - 0.01);
  const position = tube.getAttribute("position");
  const colors = new Float32Array(position.count * 3);
  const a = new Color(from);
  const b = new Color(to);
  const c = new Color();
  for (let i = 0; i < position.count; i += 1) {
    const t = Math.min(1, Math.max(0, -position.getZ(i) / VESTIBULE_DEPTH));
    c.copy(a).lerp(b, t).multiplyScalar(0.78 + 0.22 * t);
    c.toArray(colors, i * 3);
  }
  tube.setAttribute("color", new Float32BufferAttribute(colors, 3));
  return tube;
}

type Props = {
  x: number;
  /** Hall name engraved above the arch. */
  title: string;
  /** Look of the hall the portal opens into. */
  look: ZoneLook;
  /** Look of the hall the visitor walks out of (the lobby for the first portal). */
  fromLook: ZoneLook;
};

/** A stone archway with the hall name; the opening shows a lit vestibule into the next hall. */
export function Portal({ x, title, look, fromLook }: Props) {
  const { surfaces, resources, mood, fonts, museumTitle, quality, accent, baked } = useGallery();
  const wallMaps = surfaces.wall(look.wallStyle, look.wallColor);
  const dark = isDarkColor(look.wallColor);
  const shadows = quality.shadows;

  const geometries = useMemo(
    () => ({
      wall: resources.geometry(`portal-wall:${wallMaps.tileMeters}`, () => {
        const wall = new Shape();
        wall.moveTo(-PORTAL_SEGMENT_WIDTH / 2, 0);
        wall.lineTo(PORTAL_SEGMENT_WIDTH / 2, 0);
        wall.lineTo(PORTAL_SEGMENT_WIDTH / 2, WALL_HEIGHT);
        wall.lineTo(-PORTAL_SEGMENT_WIDTH / 2, WALL_HEIGHT);
        wall.lineTo(-PORTAL_SEGMENT_WIDTH / 2, 0);
        const hole = new Path();
        archPath(hole, PORTAL_WIDTH / 2, true);
        wall.holes.push(hole);
        const geometry = new ShapeGeometry(wall, 24);
        // Offset UVs so the texture lines up with the neighbouring plain wall.
        const uv = geometry.getAttribute("uv");
        for (let i = 0; i < uv.count; i += 1) uv.setX(i, uv.getX(i) + PORTAL_SEGMENT_WIDTH / 2);
        metersToTiles(geometry, wallMaps.tileMeters);
        return geometry;
      }),
      stone: resources.geometry("portal-stone", () => new ExtrudeGeometry(band(PORTAL_WIDTH / 2 + SURROUND, PORTAL_WIDTH / 2), { depth: 0.2, bevelEnabled: true, bevelThickness: 0.018, bevelSize: 0.018, bevelSegments: 2, curveSegments: 28 })),
      line: resources.geometry("portal-line", () => new ExtrudeGeometry(band(PORTAL_WIDTH / 2 + 0.05, PORTAL_WIDTH / 2), { depth: 0.235, bevelEnabled: false, curveSegments: 28 })),
      vestibule: resources.geometry(`vestibule:${fromLook.wallColor}:${look.wallColor}`, () => vestibuleGeometry(fromLook.wallColor, look.wallColor)),
      floor: resources.geometry("vestibule-floor", () => new PlaneGeometry(PORTAL_WIDTH, VESTIBULE_DEPTH).rotateX(-Math.PI / 2).translate(0, 0.004, -VESTIBULE_DEPTH / 2)),
      back: resources.geometry("vestibule-back", () => new PlaneGeometry(PORTAL_WIDTH + 1, PORTAL_HEIGHT + 1.2).translate(0, (PORTAL_HEIGHT + 1.2) / 2 - 0.1, -VESTIBULE_DEPTH + 0.02)),
      signGlow: resources.geometry("portal-sign-glow", () => new PlaneGeometry(5.6, 1.5)),
      signRule: resources.geometry("portal-sign-rule", () => new BoxGeometry(3.4, 0.014, 0.02)),
      beam: resources.geometry("portal-beam", () => new BoxGeometry(0.28, 0.28, ROOM_DEPTH)),
    }),
    [resources, wallMaps.tileMeters, fromLook.wallColor, look.wallColor],
  );

  const stoneColor = dark ? "#c4bcae" : "#e4e0d6";
  const accentColor = look.accent ?? accent;
  const wallMaterial = wallMaterialFor(resources, look, wallMaps, mood.tint);
  const stoneMaterial = resources.surface(`stone:${stoneColor}`, { color: stoneColor, roughness: 0.75, envMapIntensity: 0.3 });
  const lineMaterial = resources.surface(`accent-line:${accentColor}`, { color: accentColor, metalness: 0.6, roughness: 0.5, envMapIntensity: 0.6 });
  const vestibuleMaterial = resources.surface("vestibule", { color: "#ffffff", roughness: 0.95, vertexColors: true });
  const floorColor = new Color(fromLook.floorColor).lerp(new Color(look.floorColor), 0.5).multiplyScalar(0.8);
  const floorMaterial = resources.surface(`vestibule-floor:${floorColor.getHexString()}`, { color: `#${floorColor.getHexString()}`, roughness: 0.8 });
  const glowTexture = baked.glow;
  const backMaterial = resources.basic(`vestibule-back:${dark ? "d" : "l"}`, { color: dark ? "#6b5842" : "#b9ad98" });
  const backGlowMaterial = resources.basic(`vestibule-glow:${dark ? "d" : "l"}`, { color: dark ? "#ffd9a0" : "#fff4dc", map: glowTexture, opacity: 0.85, additive: true });
  const signGlowMaterial = resources.basic(`sign-glow:${dark ? "d" : "l"}`, { color: dark ? "#ffd89a" : "#fff1d2", map: glowTexture, opacity: 0.42 * look.lighting.glow + (look.lighting.spots ? 0 : 0.0), additive: true });
  const ruleMaterial = resources.surface(`sign-rule:${accentColor}`, { color: accentColor, metalness: 0.5, roughness: 0.5 });
  const beamMaterial = resources.surface(`stone:${stoneColor}`, { color: stoneColor, roughness: 0.75, envMapIntensity: 0.3 });

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
  const textY = PORTAL_HEIGHT + SURROUND + bandHeight / 2 - 0.1;
  const cullRange = useMemo(() => [x - 3, x + 3], [x]);

  return (
    <group position={[x, 0, 0]} userData={{ cull: cullRange }}>
      {/* wall around the opening */}
      <mesh geometry={geometries.wall} material={wallMaterial} receiveShadow={shadows} />

      {/* stone surround and a thin accent reveal */}
      <mesh geometry={geometries.stone} material={stoneMaterial} castShadow={shadows} receiveShadow={shadows} />
      <mesh geometry={geometries.line} material={lineMaterial} />

      {/* the vestibule: thick walls and an arched ceiling, a continuing floor, and a lit far wall */}
      <mesh geometry={geometries.vestibule} material={vestibuleMaterial} />
      <mesh geometry={geometries.floor} material={floorMaterial} />
      <mesh geometry={geometries.back} material={backMaterial} />
      <mesh geometry={geometries.back} material={backGlowMaterial} position={[0, 0, 0.01]} renderOrder={1} />

      {/* lit signage: a soft glow behind the engraved hall name and a fine brass rule under it */}
      <mesh geometry={geometries.signGlow} material={signGlowMaterial} position={[0, textY, 0.006]} renderOrder={1} />
      <mesh position={[0, textY, 0.014]}>
        <planeGeometry args={[3.7, 3.7 / 6.2]} />
        <meshBasicMaterial map={inscription} transparent depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh geometry={geometries.signRule} material={ruleMaterial} position={[0, textY - 0.43, 0.012]} />

      {/* a ceiling beam gives the opening presence from oblique angles */}
      <mesh geometry={geometries.beam} material={beamMaterial} position={[0, WALL_HEIGHT - 0.14, ROOM_DEPTH / 2]} receiveShadow={shadows} />
    </group>
  );
}
