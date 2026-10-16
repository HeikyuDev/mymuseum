"use client";

import { useEffect, useMemo } from "react";
import { DoubleSide, type Texture } from "three";
import { DEFAULT_MAT_COLOR, FRAME_DEFAULT_COLOR } from "@/lib/scene-palette";
import { FRAME_SPECS } from "@/lib/gallery/frame-specs";
import type { ArtworkPlacement } from "@/lib/gallery/layout";
import type { ViewerArtwork } from "@/lib/viewer-model";
import type { FrameStyle } from "@/types/database";
import { useGallery } from "./context";
import { frameGeometry, matGeometry } from "./frame-geometry";
import { makePlaqueTexture } from "./text-textures";
import { usePhotoTexture } from "./use-photo-texture";

type Props = { placement: ArtworkPlacement; artwork: ViewerArtwork; wallIsDark: boolean };

type FrameMaterial = { color: string; metalness: number; roughness: number; envMapIntensity: number; wood: boolean };

function frameMaterial(style: FrameStyle, color: string): FrameMaterial {
  switch (style) {
    case "gold":
      return { color, metalness: 1, roughness: 0.3, envMapIntensity: 1.6, wood: false };
    case "vintage_ornate":
      return { color, metalness: 0.95, roughness: 0.42, envMapIntensity: 1.3, wood: false };
    case "metallic":
      return { color, metalness: 1, roughness: 0.32, envMapIntensity: 1.5, wood: false };
    case "wood":
      return { color: "#ffffff", metalness: 0, roughness: 0.55, envMapIntensity: 0.5, wood: true };
    case "black_gallery":
      return { color, metalness: 0.2, roughness: 0.42, envMapIntensity: 0.9, wood: false };
    default:
      return { color, metalness: 0, roughness: 0.6, envMapIntensity: 0.4, wood: false };
  }
}

export function Artwork({ placement, artwork, wallIsDark }: Props) {
  const { quality, fonts, softShadow, surfaces, placeholderPhoto, focusArtwork, onSelectArtwork, onPhotoSettled, snapshot } = useGallery();
  const active = Math.abs(placement.index - focusArtwork) <= quality.loadRadius;
  const { photo, status } = usePhotoTexture(artwork.imageUrl, active, quality.photoTextureMax, quality.anisotropy);
  useEffect(() => {
    if (status === "ready") onPhotoSettled?.(placement.index, true);
    else if (status === "error") onPhotoSettled?.(placement.index, false);
  }, [status, placement.index, onPhotoSettled]);

  const { imageW, imageH, openingW, openingH, outerW, outerH, matW, depth, frameStyle } = placement;
  const spec = FRAME_SPECS[frameStyle];
  const frameColor = artwork.frameColor ?? FRAME_DEFAULT_COLOR[frameStyle];
  const matColor = artwork.matColor ?? DEFAULT_MAT_COLOR;

  const frame = useMemo(() => (spec.kind === "profile" ? frameGeometry(frameStyle, openingW, openingH) : null), [spec.kind, frameStyle, openingW, openingH]);
  const mat = useMemo(() => (matW > 0 ? matGeometry(imageW, imageH, matW) : null), [matW, imageW, imageH]);
  useEffect(() => () => frame?.dispose(), [frame]);
  useEffect(() => () => mat?.dispose(), [mat]);

  const material = frameMaterial(frameStyle, frameColor);
  const woodMaps = material.wood ? surfaces.wood(frameColor) : null;

  const plaqueTone = wallIsDark ? "ink" : "ivory";
  const plaqueAspect = placement.plaque.w / placement.plaque.h;
  const plaqueTexture = useMemo(
    () => makePlaqueTexture({ title: artwork.title, aspect: plaqueAspect, family: fonts.display, tone: plaqueTone, pixelHeight: quality.tier === "low" ? 128 : 192 }),
    [artwork.title, plaqueAspect, fonts.display, plaqueTone, quality.tier],
  );
  useEffect(() => () => plaqueTexture.dispose(), [plaqueTexture]);

  const photoZ = spec.kind === "glass" ? 0.034 : spec.kind === "canvas" ? depth + 0.0008 : 0.004;
  const float = spec.kind === "glass" ? 0.034 : 0;
  const shadowSize = [outerW + 0.34, outerH + 0.34] as const;
  const shadowOffset = spec.kind === "glass" ? [0.04, -0.08] : [0.025, -0.055];

  const px = placement.plaque.x - placement.x;
  const py = placement.plaque.y - placement.y;
  const select = () => onSelectArtwork?.(placement.index);

  return (
    <group position={[placement.x, placement.y, 0]}>
      {/* soft contact shadow, always on, so frames never look pasted onto the wall */}
      <mesh position={[shadowOffset[0], shadowOffset[1], 0.0015]} renderOrder={1}>
        <planeGeometry args={shadowSize} />
        <meshBasicMaterial map={softShadow} color="#000000" transparent opacity={spec.kind === "glass" ? 0.5 : 0.62} depthWrite={false} toneMapped={false} />
      </mesh>

      {/* the photograph */}
      <mesh
        position={[0, 0, photoZ]}
        onClick={(event) => {
          event.stopPropagation();
          select();
        }}
        onPointerOver={(event) => {
          event.stopPropagation();
          if (!snapshot) document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          document.body.style.cursor = "";
        }}
        receiveShadow
      >
        <planeGeometry args={[imageW, imageH]} />
        <PhotoMaterial texture={photo?.texture ?? placeholderPhoto} />
      </mesh>

      {/* backing board behind mat and photo */}
      {spec.kind === "profile" ? (
        <mesh position={[0, 0, 0.002]}>
          <planeGeometry args={[openingW, openingH]} />
          <meshStandardMaterial color={matColor} roughness={0.9} />
        </mesh>
      ) : null}

      {mat ? (
        <mesh geometry={mat} position={[0, 0, 0]} castShadow receiveShadow>
          <meshStandardMaterial color={matColor} roughness={0.95} side={DoubleSide} />
        </mesh>
      ) : null}

      {frame ? (
        <mesh geometry={frame} castShadow receiveShadow>
          <meshStandardMaterial
            color={material.color}
            metalness={material.metalness}
            roughness={material.roughness}
            envMapIntensity={material.envMapIntensity}
            map={woodMaps?.color}
            bumpMap={woodMaps?.bump}
            bumpScale={0.6}
            roughnessMap={woodMaps?.rough}
            side={DoubleSide}
          />
        </mesh>
      ) : null}

      {spec.kind === "canvas" ? (
        <mesh position={[0, 0, depth / 2]} castShadow receiveShadow>
          <boxGeometry args={[imageW, imageH, depth]} />
          <meshStandardMaterial color={frameColor} roughness={0.85} />
        </mesh>
      ) : null}

      {spec.kind === "glass" ? <GlassPanel width={imageW} height={imageH} /> : null}

      {/* museum placard: title only */}
      <group position={[px, py, float]}>
        <mesh position={[0, 0, 0.008]} castShadow receiveShadow>
          <boxGeometry args={[placement.plaque.w, placement.plaque.h, 0.016]} />
          <meshStandardMaterial color={wallIsDark ? "#16140f" : "#ece7da"} roughness={0.5} metalness={wallIsDark ? 0.3 : 0} />
        </mesh>
        <mesh position={[0, 0, 0.0165]}>
          <planeGeometry args={[placement.plaque.w - 0.004, placement.plaque.h - 0.004]} />
          <meshStandardMaterial map={plaqueTexture} roughness={0.42} metalness={wallIsDark ? 0.4 : 0.05} envMapIntensity={0.6} />
        </mesh>
      </group>
    </group>
  );
}

function PhotoMaterial({ texture }: { texture: Texture }) {
  // A touch of emissive keeps photographs vivid under gallery light, like a lit print.
  return <meshStandardMaterial map={texture} emissiveMap={texture} emissive="#ffffff" emissiveIntensity={0.16} roughness={0.6} metalness={0} />;
}

function GlassPanel({ width, height }: { width: number; height: number }) {
  const standoff = useMemo(() => {
    const x = width / 2 - 0.035;
    const y = height / 2 - 0.035;
    return [
      [-x, y],
      [x, y],
      [-x, -y],
      [x, -y],
    ] as const;
  }, [width, height]);
  return (
    <group>
      {/* acrylic front panel */}
      <mesh position={[0, 0, 0.044]} castShadow>
        <boxGeometry args={[width + 0.012, height + 0.012, 0.01]} />
        <meshPhysicalMaterial color="#ffffff" transparent opacity={0.14} roughness={0.04} metalness={0} clearcoat={1} envMapIntensity={2.4} depthWrite={false} />
      </mesh>
      {/* brushed steel standoffs */}
      {standoff.map(([x, y]) => (
        <mesh key={`${x}:${y}`} position={[x, y, 0.025]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.011, 0.011, 0.05, 16]} />
          <meshStandardMaterial color="#c9ccd1" metalness={1} roughness={0.28} envMapIntensity={1.5} />
        </mesh>
      ))}
    </group>
  );
}
