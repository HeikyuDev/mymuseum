"use client";

import { useThree } from "@react-three/fiber";
import { useEffect, useState } from "react";
import { DefaultLoadingManager, type Texture } from "three";
import { loadPhotoTexture } from "./photo-loader";

export type PhotoTexture = { texture: Texture; width: number; height: number };
export type PhotoStatus = "idle" | "loading" | "ready" | "error";

type Options = {
  url: string;
  /** Small copy of the photo; tried first and silently skipped when it does not exist. */
  thumbUrl?: string | null;
  /** The artwork is near the camera: load something. */
  enabled: boolean;
  /** The camera rests on this artwork: load the full image. */
  upgrade: boolean;
  /** Longest side of the full image on the GPU. */
  maxSize: number;
  /** Longest side when only a neighbour needs the original (no thumbnail available). */
  neighbourSize: number;
  anisotropy: number;
  maxLoads: number;
  /** Counts toward the loading screen. */
  blocking: boolean;
};

type Loaded = { key: string; photo: PhotoTexture };

/**
 * Loads a photo as a GPU texture in two stages: the thumbnail first (and for neighbours),
 * then the full image only for the artwork the camera rests on. Textures are disposed when the
 * artwork leaves the loading window; decoding happens off the main thread.
 */
export function usePhotoTexture({ url, thumbUrl, enabled, upgrade, maxSize, neighbourSize, anisotropy, maxLoads, blocking }: Options): { photo: PhotoTexture | null; status: PhotoStatus } {
  const invalidate = useThree((state) => state.invalidate);
  const maxAnisotropy = useThree((state) => state.gl.capabilities.getMaxAnisotropy());
  const aniso = Math.min(anisotropy, maxAnisotropy);
  const [small, setSmall] = useState<Loaded | null>(null);
  const [full, setFull] = useState<Loaded | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  // Stage 1: the thumbnail, or the capped original when there is none (or it 404s).
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    let created: Texture | null = null;
    const hasThumb = Boolean(thumbUrl);
    if (blocking) DefaultLoadingManager.itemStart(url);
    const first = hasThumb ? loadPhotoTexture(thumbUrl as string, neighbourSize, aniso, maxLoads, controller.signal) : Promise.reject(new Error("no thumbnail"));
    first
      .catch(() => loadPhotoTexture(url, neighbourSize, aniso, maxLoads, controller.signal))
      .then((loaded) => {
        if (controller.signal.aborted) {
          loaded.texture.dispose();
          return;
        }
        created = loaded.texture;
        setSmall({ key: url, photo: loaded });
        invalidate();
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(url);
      })
      .finally(() => {
        if (blocking) DefaultLoadingManager.itemEnd(url);
      });
    return () => {
      controller.abort();
      created?.dispose();
      setSmall(null);
    };
  }, [url, thumbUrl, enabled, neighbourSize, aniso, maxLoads, blocking, invalidate]);

  // Stage 2: the full image, only while the camera rests here. Artworks without a thumbnail
  // upgrade from their capped original the same way.
  const wantFull = enabled && upgrade;
  useEffect(() => {
    if (!wantFull) return;
    const controller = new AbortController();
    let created: Texture | null = null;
    loadPhotoTexture(url, maxSize, aniso, maxLoads, controller.signal)
      .then((loaded) => {
        if (controller.signal.aborted) {
          loaded.texture.dispose();
          return;
        }
        created = loaded.texture;
        setFull({ key: url, photo: loaded });
        invalidate();
      })
      .catch(() => undefined);
    return () => {
      controller.abort();
      created?.dispose();
      setFull(null);
      invalidate();
    };
  }, [wantFull, url, maxSize, aniso, maxLoads, invalidate]);

  const photo = enabled ? ((wantFull && full?.key === url ? full.photo : null) ?? (small?.key === url ? small.photo : null)) : null;
  const status: PhotoStatus = !enabled ? "idle" : photo ? "ready" : failed === url ? "error" : "loading";
  return { photo, status };
}
