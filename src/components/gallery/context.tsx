"use client";

import { createContext, useContext, type MutableRefObject } from "react";
import type { CanvasTexture } from "three";
import type { MuseumLayout } from "@/lib/gallery/layout";
import type { QualitySettings } from "@/lib/gallery/quality";
import type { SceneMood, ZoneLook } from "@/lib/gallery/scene-look";
import type { GalleryZone } from "@/lib/gallery/zones";
import type { CanvasFonts } from "@/lib/fonts-client";
import type { SurfaceCache } from "./surface-cache";

export type GalleryContextValue = {
  layout: MuseumLayout;
  zones: GalleryZone[];
  looks: ZoneLook[];
  mood: SceneMood;
  quality: QualitySettings;
  fonts: CanvasFonts;
  surfaces: SurfaceCache;
  /** Neutral stand-in used until a photo arrives, so the photo shader never has to be recompiled. */
  placeholderPhoto: CanvasTexture;
  softShadow: CanvasTexture;
  museumTitle: string;
  accent: string;
  /** Names for zones without a hall name (the "Other" zone). */
  otherLabel: string;
  /** Live camera x on the wall axis (written by the camera rail, read by lights). */
  cameraX: MutableRefObject<number>;
  /** Artwork nearest to the visitor; drives which photo textures stay loaded. */
  focusArtwork: number;
  /** Called when a visitor clicks an artwork in the scene. */
  onSelectArtwork?: (artworkIndex: number) => void;
  /** Reports when an artwork inside the loading window finished (or failed) loading its photo. */
  onPhotoSettled?: (artworkIndex: number, ok: boolean) => void;
  /** Photo exports render a single settled frame: no ramps, no sway. */
  snapshot: boolean;
};

const GalleryContext = createContext<GalleryContextValue | null>(null);

export const GalleryProvider = GalleryContext.Provider;

export function useGallery(): GalleryContextValue {
  const value = useContext(GalleryContext);
  if (!value) throw new Error("useGallery must be used inside <GalleryScene>.");
  return value;
}

export function zoneTitle(zone: GalleryZone, otherLabel: string): string {
  return zone.kind === "other" ? otherLabel : zone.name;
}
