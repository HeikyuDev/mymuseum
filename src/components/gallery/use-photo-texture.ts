"use client";

import { useThree } from "@react-three/fiber";
import { useCallback, useEffect, useSyncExternalStore } from "react";
import type { Texture } from "three";
import { useGallery } from "./context";
import { bandOf, type PhotoBand } from "./photo-store";

export type PhotoTexture = { texture: Texture; width: number; height: number };
export type PhotoStatus = "idle" | "loading" | "ready" | "error";

type Options = {
  /** Artwork index: identifies the photo inside the scene's store. */
  id: string;
  url: string;
  /** Small copy of the photo; tried first and silently skipped when it does not exist. */
  thumbUrl?: string | null;
  /** Longest side of the first texture (the thumbnail, or the capped original when there is none). */
  smallSize: number;
  /** Longest side of the full image on the GPU. */
  fullSize: number;
  /** The camera resting on this artwork upgrades it to the full image. */
  upgrade: boolean;
  anisotropy: number;
  maxLoads: number;
  /** Artwork position in walking order. */
  index: number;
  loadRadius: number;
};

/**
 * The photo texture of one artwork. What to load follows the artwork's distance band to the camera;
 * the hook re-renders its artwork only when the band changes or a texture becomes available, never on
 * every move of the camera.
 */
export function usePhotoTexture({ id, url, thumbUrl, smallSize, fullSize, upgrade, anisotropy, maxLoads, index, loadRadius }: Options): { photo: PhotoTexture | null; status: PhotoStatus; band: PhotoBand } {
  const { photos, focus } = useGallery();
  const maxAnisotropy = useThree((state) => state.gl.capabilities.getMaxAnisotropy());
  const aniso = Math.min(anisotropy, maxAnisotropy);

  const band = useSyncExternalStore(
    focus.subscribe,
    () => bandOf(Math.abs(index - focus.get()), loadRadius),
    () => 4 as PhotoBand,
  );

  useEffect(() => {
    photos.setBand(id, { url, thumbUrl: thumbUrl ?? null, smallSize, fullSize, upgrade, anisotropy: aniso, maxLoads }, band);
  }, [photos, id, url, thumbUrl, smallSize, fullSize, upgrade, aniso, maxLoads, band]);

  const subscribe = useCallback((listener: () => void) => photos.subscribe(id, listener), [photos, id]);
  const view = useSyncExternalStore(
    subscribe,
    () => photos.snapshot(id),
    () => photos.snapshot(id),
  );

  const photo = band <= 3 ? (view.full ?? view.small) : null;
  const status: PhotoStatus = band > 2 && !photo ? "idle" : photo ? "ready" : view.failed ? "error" : "loading";
  return { photo, status, band };
}
