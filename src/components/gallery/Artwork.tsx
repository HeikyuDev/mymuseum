"use client";

import { useEffect, useMemo } from "react";
import { BoxGeometry, DoubleSide, PlaneGeometry } from "three";
import { DEFAULT_MAT_COLOR, FRAME_DEFAULT_COLOR } from "@/lib/scene-palette";
import { FRAME_SPECS } from "@/lib/gallery/frame-specs";
import type { ArtworkPlacement } from "@/lib/gallery/layout";
import { photoLevel } from "@/lib/gallery/scene-look";
import type { ViewerArtwork } from "@/lib/viewer-model";
import type { FrameStyle } from "@/types/database";
import { useGallery } from "./context";
import { frameGeometry, matGeometry } from "./frame-geometry";
import { flipPlaneUv } from "./photo-loader";
import { makePlaqueTexture } from "./text-textures";
import { usePhotoTexture } from "./use-photo-texture";

type Props = { placement: ArtworkPlacement; artwork: ViewerArtwork; wallIsDark: boolean };

type FrameMaterial = { color: string; metalness: number; roughness: number; envMapIntensity: number; wood: boolean };

function frameMaterial(style: FrameStyle, color: string): FrameMaterial {
  switch (style) {
    case "gold":
      return { color, metalness: 1, roughness: 0.34, envMapIntensity: 1.3, wood: false };
    case "vintage_ornate":
      return { color, metalness: 0.95, roughness: 0.45, envMapIntensity: 1.1, wood: false };
    case "metallic":
      return { color, metalness: 1, roughness: 0.36, envMapIntensity: 1.2, wood: false };
    case "wood":
      return { color: "#ffffff", metalness: 0, roughness: 0.65, envMapIntensity: 0.35, wood: true };
    case "black_gallery":
      return { color, metalness: 0.2, roughness: 0.5, envMapIntensity: 0.7, wood: false };
    default:
      return { color, metalness: 0, roughness: 0.7, envMapIntensity: 0.3, wood: false };
  }
}

const mm = (value: number) => value.toFixed(3);

export function Artwork({ placement, artwork, wallIsDark }: Props) {
  const { quality, fonts, softShadow, surfaces, resources, looks, placeholderPhoto, callbacks, snapshot } = useGallery();
  const look = looks[placement.zoneIndex];
  const { photo, status } = usePhotoTexture({
    id: placement.id,
    index: placement.index,
    loadRadius: quality.loadRadius,
    url: artwork.imageUrl,
    // Photo exports always render the original: a thumbnail would blur the picture.
    thumbUrl: snapshot ? null : artwork.thumbUrl,
    upgrade: !snapshot && quality.upgradeFocus,
    fullSize: quality.photoTextureMax,
    smallSize: snapshot ? quality.photoTextureMax : Math.min(1024, quality.photoTextureMax),
    anisotropy: quality.anisotropy,
    maxLoads: quality.maxLoads,
  });
  useEffect(() => {
    if (status === "ready") callbacks.current.onPhotoSettled?.(placement.index, true);
    else if (status === "error") callbacks.current.onPhotoSettled?.(placement.index, false);
  }, [status, placement.index, callbacks]);

  const { imageW, imageH, openingW, openingH, outerW, outerH, matW, depth, frameStyle } = placement;
  const spec = FRAME_SPECS[frameStyle];
  const frameColor = artwork.frameColor ?? FRAME_DEFAULT_COLOR[frameStyle];
  const matColor = artwork.matColor ?? DEFAULT_MAT_COLOR;
  const shine = look.lighting.shine;
  const shadows = quality.shadows;

  const frame = useMemo(
    () =>
      spec.kind === "profile"
        ? resources.geometry(`frame:${quality.simpleFrames ? "s" : "f"}:${frameStyle}:${mm(openingW)}x${mm(openingH)}`, () => frameGeometry(frameStyle, openingW, openingH, quality.simpleFrames)!)
        : null,
    [spec.kind, frameStyle, openingW, openingH, quality.simpleFrames, resources],
  );
  const mat = useMemo(() => (matW > 0 ? resources.geometry(`mat:${mm(imageW)}x${mm(imageH)}:${mm(matW)}`, () => matGeometry(imageW, imageH, matW)) : null), [matW, imageW, imageH, resources]);
  const photoPlane = useMemo(
    () =>
      resources.geometry(`photo:${mm(imageW)}x${mm(imageH)}`, () => {
        const geometry = new PlaneGeometry(imageW, imageH);
        flipPlaneUv(geometry.getAttribute("uv"));
        return geometry;
      }),
    [imageW, imageH, resources],
  );

  const material = frameMaterial(frameStyle, frameColor);
  const woodMaps = material.wood ? surfaces.wood(frameColor) : null;
  const frameMat = resources.surface(`frame:${frameStyle}:${frameColor}:${shine}`, {
    color: material.color,
    metalness: material.metalness,
    roughness: material.roughness,
    envMapIntensity: material.envMapIntensity,
    shine,
    map: woodMaps?.color,
    bumpMap: woodMaps?.bump,
    bumpScale: 0.6,
    roughnessMap: woodMaps?.rough,
    side: DoubleSide,
  });
  const matMaterial = resources.surface(`mat:${matColor}`, { color: matColor, roughness: 0.95, side: DoubleSide });
  const backing = resources.surface(`backing:${matColor}`, { color: matColor, roughness: 0.9 });

  const plaqueTone = wallIsDark ? "ink" : "ivory";
  const plaqueAspect = placement.plaque.w / placement.plaque.h;
  const plaqueTexture = useMemo(
    () => makePlaqueTexture({ title: artwork.title, aspect: plaqueAspect, family: fonts.display, tone: plaqueTone, pixelHeight: quality.tier === "low" ? 128 : 192 }),
    [artwork.title, plaqueAspect, fonts.display, plaqueTone, quality.tier],
  );
  useEffect(() => () => plaqueTexture.dispose(), [plaqueTexture]);

  const photoZ = spec.kind === "glass" ? 0.034 : spec.kind === "canvas" ? depth + 0.0008 : 0.004;
  const float = spec.kind === "glass" ? 0.034 : 0;
  const shadowW = outerW + 0.34;
  const shadowH = outerH + 0.34;
  const shadowOffset = spec.kind === "glass" ? [0.04, -0.08] : [0.025, -0.055];
  const shadowGeometry = resources.geometry(`shadow:${mm(shadowW)}x${mm(shadowH)}`, () => new PlaneGeometry(shadowW, shadowH));
  const shadowOpacity = spec.kind === "glass" ? 0.5 : 0.55;
  const shadowMaterial = resources.basic(`shadow:${shadowOpacity}`, { color: "#000000", map: softShadow, opacity: shadowOpacity, depthWrite: false });

  const px = placement.plaque.x - placement.x;
  const py = placement.plaque.y - placement.y;
  const select = () => callbacks.current.onSelectArtwork?.(placement.index);
  const gray = Math.round(photoLevel(look.lighting) * 255).toString(16).padStart(2, "0");
  const photoTint = `#${gray}${gray}${gray}`;

  const plaqueBase = quality.simpleMaterials ? null : resources.geometry(`plaque:${mm(placement.plaque.w)}x${mm(placement.plaque.h)}`, () => new BoxGeometry(placement.plaque.w, placement.plaque.h, 0.016));
  const plaqueBaseMaterial = resources.surface(`plaque:${wallIsDark ? "d" : "l"}`, { color: wallIsDark ? "#16140f" : "#ece7da", roughness: 0.6, metalness: wallIsDark ? 0.3 : 0 });
  const plaquePlane = useMemo(() => new PlaneGeometry(placement.plaque.w - 0.004, placement.plaque.h - 0.004), [placement.plaque.w, placement.plaque.h]);
  useEffect(() => () => plaquePlane.dispose(), [plaquePlane]);

  const canvasBox = useMemo(
    () => (spec.kind === "canvas" ? resources.geometry(`canvas:${mm(imageW)}x${mm(imageH)}:${mm(depth)}`, () => new BoxGeometry(imageW, imageH, depth)) : null),
    [spec.kind, imageW, imageH, depth, resources],
  );
  const canvasMaterial = resources.surface(`canvas:${frameColor}`, { color: frameColor, roughness: 0.9 });

  const cullRange = useMemo(() => [placement.x - outerW / 2, placement.x + outerW / 2], [placement.x, outerW]);

  return (
    <group position={[placement.x, placement.y, 0]} userData={{ cull: cullRange }}>
      {/* soft contact shadow, always on, so frames never look pasted onto the wall */}
      <mesh geometry={shadowGeometry} material={shadowMaterial} position={[shadowOffset[0], shadowOffset[1], 0.0015]} renderOrder={1} />

      {/* the photograph: unlit and untonemapped, so its colors stay true to the original */}
      <mesh
        geometry={photoPlane}
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
      >
        <meshBasicMaterial map={photo?.texture ?? placeholderPhoto} color={photoTint} toneMapped={false} />
      </mesh>

      {/* backing board behind the mat */}
      {spec.kind === "profile" && matW > 0 ? (
        <mesh position={[0, 0, 0.002]} material={backing}>
          <planeGeometry args={[openingW, openingH]} />
        </mesh>
      ) : null}

      {mat ? <mesh geometry={mat} material={matMaterial} castShadow={shadows} receiveShadow={shadows} /> : null}
      {frame ? <mesh geometry={frame} material={frameMat} castShadow={shadows} receiveShadow={shadows} /> : null}

      {canvasBox ? <mesh geometry={canvasBox} material={canvasMaterial} position={[0, 0, depth / 2]} castShadow={shadows} receiveShadow={shadows} /> : null}

      {spec.kind === "glass" && !quality.simpleMaterials ? <GlassPanel width={imageW} height={imageH} shine={shine} /> : null}

      {/* museum placard: title only */}
      <group position={[px, py, float]}>
        {plaqueBase ? <mesh geometry={plaqueBase} material={plaqueBaseMaterial} position={[0, 0, 0.008]} castShadow={shadows} receiveShadow={shadows} /> : null}
        <mesh geometry={plaquePlane} position={[0, 0, plaqueBase ? 0.0165 : 0.004]}>
          {quality.simpleMaterials ? (
            <meshBasicMaterial map={plaqueTexture} toneMapped={false} />
          ) : (
            <meshStandardMaterial map={plaqueTexture} roughness={0.6} metalness={wallIsDark ? 0.3 : 0} envMapIntensity={0.4 * shine} />
          )}
        </mesh>
      </group>
    </group>
  );
}

function GlassPanel({ width, height, shine }: { width: number; height: number; shine: number }) {
  const { resources } = useGallery();
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
  const panel = resources.geometry(`glass:${width.toFixed(3)}x${height.toFixed(3)}`, () => new BoxGeometry(width + 0.012, height + 0.012, 0.01));
  const pin = resources.geometry("standoff", () => new BoxGeometry(0.022, 0.05, 0.022));
  const glass = resources.glass(shine);
  const steel = resources.surface("standoff", { color: "#c9ccd1", metalness: 1, roughness: 0.4, envMapIntensity: 1.1 });
  return (
    <group>
      {/* acrylic front panel: the only place a sheen is allowed */}
      <mesh geometry={panel} material={glass} position={[0, 0, 0.044]} />
      {standoff.map(([x, y]) => (
        <mesh key={`${x}:${y}`} geometry={pin} material={steel} position={[x, y, 0.025]} rotation={[Math.PI / 2, 0, 0]} />
      ))}
    </group>
  );
}
