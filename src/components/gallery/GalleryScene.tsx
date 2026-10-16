"use client";

import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { buildLayout, type MuseumLayout } from "@/lib/gallery/layout";
import { zoneLook, sceneMood, isDarkColor, type ZoneLook } from "@/lib/gallery/scene-look";
import { toLayoutZones, galleryZones, type GalleryZone } from "@/lib/gallery/zones";
import type { QualitySettings } from "@/lib/gallery/quality";
import type { CanvasFonts } from "@/lib/fonts-client";
import type { ViewerMuseum } from "@/lib/viewer-model";
import type { ThemePreset } from "@/types/database";
import { Artwork } from "./Artwork";
import { CameraRail, type FixedCamera } from "./CameraRail";
import { CeilingTrack } from "./CeilingTrack";
import { Culler } from "./Culler";
import { GalleryProvider, zoneTitle, useGallery, type GalleryContextValue } from "./context";
import { Lighting } from "./Lighting";
import { Portal, PORTAL_SEGMENT_WIDTH } from "./Portal";
import { Resources } from "./resources";
import { SurfaceCache } from "./surface-cache";
import { makeEdgeShadeTexture, makeFloorSheenTexture, makeInscriptionTexture, makePlaceholderTexture, makeSoftShadowTexture, makeWallGlowTexture } from "./text-textures";
import { ShaderWarmup } from "./ShaderWarmup";
import { Zone } from "./Zone";

export type GalleryModel = {
  zones: GalleryZone[];
  layout: MuseumLayout;
  looks: ZoneLook[];
};

export type GallerySource = Pick<ViewerMuseum, "halls" | "otherArtworks">;

export function buildGalleryModel(source: GallerySource): GalleryModel {
  const zones = galleryZones(source);
  return { zones, layout: buildLayout(toLayoutZones(zones)), looks: zones.map((zone) => zoneLook(zone.style)) };
}

/** Index of the artwork closest to a stop (hall stops point at the first artwork of their zone). */
export function focusArtworkOf(layout: MuseumLayout, stopIndex: number): number {
  const stop = layout.stops[stopIndex];
  if (!stop) return 0;
  if (stop.kind === "artwork") return stop.artworkIndex;
  const first = layout.artworks.find((a) => a.zoneIndex === stop.zoneIndex);
  return first?.index ?? 0;
}

export type GallerySceneProps = {
  model: GalleryModel;
  museumTitle: string;
  preset: ThemePreset;
  accent: string;
  fonts: CanvasFonts;
  quality: QualitySettings;
  otherLabel: string;
  stopIndex: number;
  zoomed?: boolean;
  reducedMotion?: boolean;
  hold?: boolean;
  fixedCamera?: FixedCamera;
  snapshot?: boolean;
  introSeconds?: number;
  onSelectArtwork?: (artworkIndex: number) => void;
  onPhotoSettled?: (artworkIndex: number, ok: boolean) => void;
  /** Fires once every shader of the scene has been compiled (off the main thread when the browser allows). */
  onCompiled?: () => void;
  onArrive?: (stopIndex: number) => void;
  telemetry?: (sample: { x: number; z: number; t: number; target?: number; smooth?: number }) => void;
  /** Extra scene children (the performance governor and the diagnostics probe). */
  extras?: ReactNode;
};

/** Everything inside the canvas: lights, camera rail, zones, portals and artworks. */
export function GalleryScene({
  model,
  museumTitle,
  preset,
  accent,
  fonts,
  quality,
  otherLabel,
  stopIndex,
  zoomed = false,
  reducedMotion = false,
  hold = false,
  fixedCamera,
  snapshot = false,
  introSeconds,
  onSelectArtwork,
  onPhotoSettled,
  onCompiled,
  onArrive,
  telemetry,
  extras,
}: GallerySceneProps) {
  const cameraX = useRef(0);
  const mood = useMemo(() => sceneMood(preset), [preset]);
  const surfaces = useMemo(() => new SurfaceCache(quality.surfaceTextureSize, quality.anisotropy, quality.simpleMaterials), [quality.surfaceTextureSize, quality.anisotropy, quality.simpleMaterials]);
  useEffect(() => () => surfaces.dispose(), [surfaces]);
  const resources = useMemo(() => new Resources(quality.simpleMaterials), [quality.simpleMaterials]);
  useEffect(() => () => resources.dispose(), [resources]);
  const baked = useMemo(() => ({ glow: makeWallGlowTexture(), edgeShade: makeEdgeShadeTexture(0, 0.35), floorSheen: makeFloorSheenTexture() }), []);
  useEffect(
    () => () => {
      baked.glow.dispose();
      baked.edgeShade.dispose();
      baked.floorSheen.dispose();
    },
    [baked],
  );
  const softShadow = useMemo(() => makeSoftShadowTexture(), []);
  useEffect(() => () => softShadow.dispose(), [softShadow]);
  const placeholderPhoto = useMemo(() => makePlaceholderTexture(), []);
  useEffect(() => () => placeholderPhoto.dispose(), [placeholderPhoto]);

  const focusArtwork = focusArtworkOf(model.layout, stopIndex);
  const value = useMemo<GalleryContextValue>(
    () => ({
      layout: model.layout,
      zones: model.zones,
      looks: model.looks,
      mood,
      quality,
      fonts,
      surfaces,
      resources,
      baked,
      placeholderPhoto,
      softShadow,
      museumTitle,
      accent,
      otherLabel,
      cameraX,
      focusArtwork,
      onSelectArtwork,
      onPhotoSettled,
      snapshot,
    }),
    [model, mood, quality, fonts, surfaces, resources, baked, placeholderPhoto, softShadow, museumTitle, accent, otherLabel, focusArtwork, onSelectArtwork, onPhotoSettled, snapshot],
  );

  const { layout, zones, looks } = model;
  const last = zones.length - 1;

  return (
    <GalleryProvider value={value}>
      <color attach="background" args={[mood.background]} />
      <Lighting />
      <CameraRail
        stopIndex={stopIndex}
        zoomed={zoomed}
        reducedMotion={reducedMotion}
        hold={hold}
        fixed={fixedCamera}
        introSeconds={introSeconds}
        onArrive={onArrive}
        telemetry={telemetry}
      />
      {zones.map((zone, i) => {
        const span = layout.zones[i];
        const half = PORTAL_SEGMENT_WIDTH / 2;
        const end = i < last ? layout.zones[i + 1].portalX - half : layout.maxX;
        const floorStart = i === 0 ? layout.minX : span.portalX - half;
        const wallRanges: [number, number][] = [];
        if (i === 0) wallRanges.push([layout.minX, span.portalX - half]);
        wallRanges.push([span.portalX + half, end]);
        return (
          <group key={zone.id}>
            <Zone zoneIndex={i} floorRange={[floorStart, end]} wallRanges={wallRanges} layout={layout} isFirst={i === 0} isLast={i === last} look={looks[i]} />
            <Portal x={span.portalX} title={zoneTitle(zone, otherLabel)} look={looks[i]} fromLook={looks[i - 1] ?? looks[i]} />
            {quality.props ? <CeilingTrack range={[floorStart, end]} xs={layout.artworks.filter((a) => a.zoneIndex === i).map((a) => a.x)} lit={looks[i].lighting.spots} /> : null}
          </group>
        );
      })}
      {layout.artworks.map((placement) => (
        <Artwork
          key={placement.id}
          placement={placement}
          artwork={zones[placement.zoneIndex].artworks[placement.indexInZone]}
          wallIsDark={isDarkColor(looks[placement.zoneIndex].wallColor)}
        />
      ))}
      {zones.length > 0 ? <LobbyTitle /> : null}
      <Culler />
      {extras}
      {onCompiled ? <ShaderWarmup onDone={onCompiled} /> : null}
    </GalleryProvider>
  );
}

function LobbyTitle() {
  const { layout, museumTitle, fonts, looks, quality } = useGallery();
  const dark = isDarkColor(looks[0].wallColor);
  const texture = useMemo(
    () =>
      makeInscriptionTexture({
        text: museumTitle,
        aspect: 5,
        family: fonts.display,
        bodyFamily: fonts.body,
        color: dark ? "#e5c779" : "#2d2822",
        shadow: dark ? "rgba(0,0,0,0.65)" : "rgba(255,255,255,0.7)",
        pixelHeight: quality.tier === "low" ? 128 : 256,
      }),
    [museumTitle, fonts.display, fonts.body, dark, quality.tier],
  );
  useEffect(() => () => texture.dispose(), [texture]);
  const x = (layout.minX + layout.zones[0].portalX - PORTAL_SEGMENT_WIDTH / 2) / 2;
  return (
    <mesh position={[x, 2.45, 0.012]}>
      <planeGeometry args={[5.2, 1.04]} />
      <meshBasicMaterial map={texture} transparent depthWrite={false} toneMapped={false} />
    </mesh>
  );
}
