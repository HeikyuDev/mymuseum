"use client";

import { memo, useEffect, useMemo, useRef, type ReactNode } from "react";
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
import { EntranceWall } from "./EntranceWall";
import { FocusStore, GalleryProvider, zoneTitle, useGallery, type GalleryContextValue, type MotionState, type SceneCallbacks } from "./context";
import { Lighting } from "./Lighting";
import { ContextGuard, MotionResolution, TextureUploader } from "./MotionDriver";
import { PhotoStore } from "./photo-store";
import { Portal, PORTAL_SEGMENT_WIDTH } from "./Portal";
import { Resources } from "./resources";
import { SurfaceCache } from "./surface-cache";
import { makeEdgeShadeTexture, makeFloorSheenTexture, makeLedWashTexture, makePlaceholderTexture, makeSoftShadowTexture, makeWallGlowTexture } from "./text-textures";
import { ScreenVignette } from "./ScreenVignette";
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
  onContextState?: (lost: boolean) => void;
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
  onContextState,
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
  const baked = useMemo(() => ({ glow: makeWallGlowTexture(), edgeShade: makeEdgeShadeTexture(0, 0.35), floorSheen: makeFloorSheenTexture(), ledWash: makeLedWashTexture() }), []);
  useEffect(
    () => () => {
      baked.glow.dispose();
      baked.edgeShade.dispose();
      baked.floorSheen.dispose();
      baked.ledWash.dispose();
    },
    [baked],
  );
  const softShadow = useMemo(() => makeSoftShadowTexture(), []);
  useEffect(() => () => softShadow.dispose(), [softShadow]);
  const placeholderPhoto = useMemo(() => makePlaceholderTexture(), []);
  useEffect(() => () => placeholderPhoto.dispose(), [placeholderPhoto]);

  // The photo store, the focus and the callbacks live outside React's render cycle: moving the camera to
  // another stop must not re-render the zones, portals and artworks (that is a burst of main-thread work
  // exactly when the glide starts).
  const photos = useMemo(() => new PhotoStore(!snapshot), [snapshot]);
  useEffect(() => () => photos.dispose(), [photos]);
  const focusIndex = focusArtworkOf(model.layout, stopIndex);
  const focus = useMemo(() => new FocusStore(focusIndex), []); // eslint-disable-line react-hooks/exhaustive-deps -- the initial value only
  useEffect(() => focus.set(focusIndex), [focus, focusIndex]);
  const callbacks = useRef<SceneCallbacks>({});
  useEffect(() => {
    callbacks.current = { onSelectArtwork, onPhotoSettled, onContextState };
  }, [onSelectArtwork, onPhotoSettled, onContextState]);
  const motion = useMemo<MotionState>(() => ({ moving: false, restSince: 0, targetX: 0 }), []);

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
      focus,
      photos,
      motion,
      callbacks,
      snapshot,
    }),
    [model, mood, quality, fonts, surfaces, resources, baked, placeholderPhoto, softShadow, museumTitle, accent, otherLabel, focus, photos, motion, snapshot],
  );

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
      <StaticScene />
      <Culler />
      {snapshot ? null : <TextureUploader />}
      {snapshot ? null : <ContextGuard />}
      <MotionResolution />
      {quality.baked && !snapshot ? <ScreenVignette /> : null}
      {extras}
      {onCompiled ? <ShaderWarmup onDone={onCompiled} /> : null}
    </GalleryProvider>
  );
}

/** Everything that does not depend on where the camera is: it re-renders only when the model or the quality changes. */
const StaticScene = memo(function StaticScene() {
  const { layout, zones, looks, quality, otherLabel } = useGallery();
  const last = zones.length - 1;
  return (
    <>
      {zones.map((zone, i) => {
        const span = layout.zones[i];
        const half = PORTAL_SEGMENT_WIDTH / 2;
        const end = i < last ? layout.zones[i + 1].portalX - half : layout.maxX;
        const floorStart = i === 0 ? layout.minX : span.portalX - half;
        // The first hall has no doorway: a lettered entrance wall, then the wall of the hall.
        const wallRanges: [number, number][] = i === 0 ? [[layout.minX, layout.entrance.end], [layout.entrance.end, end]] : [[span.portalX + half, end]];
        return (
          <group key={zone.id}>
            <Zone zoneIndex={i} floorRange={[floorStart, end]} wallRanges={wallRanges} layout={layout} isFirst={i === 0} isLast={i === last} look={looks[i]} />
            {i > 0 ? <Portal x={span.portalX} title={zoneTitle(zone, otherLabel)} look={looks[i]} fromLook={looks[i - 1]} /> : null}
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
      {zones.length > 0 ? <EntranceWall /> : null}
    </>
  );
});
