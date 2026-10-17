"use client";

import { createContext, useContext, type MutableRefObject } from "react";
import type { CanvasTexture } from "three";
import type { MuseumLayout } from "@/lib/gallery/layout";
import type { QualitySettings } from "@/lib/gallery/quality";
import type { SceneMood, ZoneLook } from "@/lib/gallery/scene-look";
import type { GalleryZone } from "@/lib/gallery/zones";
import type { CanvasFonts } from "@/lib/fonts-client";
import type { PhotoStore } from "./photo-store";
import type { Resources } from "./resources";
import type { SurfaceCache } from "./surface-cache";

/** Shared, mutable motion flags: written by the camera rail every frame, read by the uploader and the resolution governor. No React state involved. */
export type MotionState = {
  /** True from the start of a glide until the camera has arrived. */
  moving: boolean;
  /** performance.now() of the last arrival (0 while nothing has arrived yet). */
  restSince: number;
  /** Wall position the camera is heading for (equals the camera x at rest). Spotlights are assigned to it. */
  targetX: number;
};

/** The artwork nearest to the visitor, observable without re-rendering the whole scene when it changes. */
export class FocusStore {
  constructor(private value = 0) {}
  private readonly listeners = new Set<() => void>();
  get = () => this.value;
  set(index: number) {
    if (index === this.value) return;
    this.value = index;
    this.listeners.forEach((listener) => listener());
  }
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
}

export type SceneCallbacks = {
  /** Called when a visitor clicks an artwork in the scene. */
  onSelectArtwork?: (artworkIndex: number) => void;
  /** Reports when an artwork inside the loading window finished (or failed) loading its photo. */
  onPhotoSettled?: (artworkIndex: number, ok: boolean) => void;
};

export type GalleryContextValue = {
  layout: MuseumLayout;
  zones: GalleryZone[];
  looks: ZoneLook[];
  mood: SceneMood;
  quality: QualitySettings;
  fonts: CanvasFonts;
  surfaces: SurfaceCache;
  /** Shared geometries and materials (disposed with the scene). */
  resources: Resources;
  /** Baked light and shade textures shared by every artwork and wall. */
  baked: { glow: CanvasTexture; edgeShade: CanvasTexture; floorSheen: CanvasTexture; ledWash: CanvasTexture };
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
  focus: FocusStore;
  /** Photo textures of this scene (decode, upload scheduling, disposal). */
  photos: PhotoStore;
  motion: MotionState;
  /** Stable holder of the latest scene callbacks, so changing them never re-renders the scene. */
  callbacks: { current: SceneCallbacks };
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
