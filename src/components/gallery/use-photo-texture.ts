"use client";

import { useThree } from "@react-three/fiber";
import { useEffect, useState } from "react";
import { CanvasTexture, DefaultLoadingManager, LinearMipmapLinearFilter, SRGBColorSpace, type Texture } from "three";

export type PhotoTexture = { texture: Texture; width: number; height: number };
export type PhotoStatus = "idle" | "loading" | "ready" | "error";

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous"; // keeps WebGL and exported canvases untainted
    image.decoding = "async";
    // decode() makes sure vector images are rasterizable before they are drawn to a canvas.
    image.onload = () => void image.decode().catch(() => undefined).then(() => resolve(image));
    image.onerror = () => reject(new Error("image failed to load"));
    image.src = url;
  });
}

/**
 * Loads a photo as a GPU texture: sRGB, mipmapped, anisotropic and limited to
 * `maxSize` on its longest side (so a 6000px upload never costs 140 MB of VRAM).
 * When `enabled` turns false the texture is disposed.
 */
export function usePhotoTexture(url: string, enabled: boolean, maxSize: number, anisotropy: number): { photo: PhotoTexture | null; status: PhotoStatus } {
  const [result, setResult] = useState<PhotoTexture | null>(null);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const invalidate = useThree((state) => state.invalidate);
  const maxAnisotropy = useThree((state) => state.gl.capabilities.getMaxAnisotropy());

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let created: Texture | null = null;
    DefaultLoadingManager.itemStart(url);
    loadImage(url)
      .then((image) => {
        if (cancelled) return;
        const width = image.naturalWidth || image.width;
        const height = image.naturalHeight || image.height;
        const longest = Math.max(width, height);
        // Always rasterize through a canvas: it caps the size and also makes SVG sources upload reliably.
        const scale = Math.min(1, maxSize / longest);
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(width * scale));
        canvas.height = Math.max(1, Math.round(height * scale));
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("canvas unavailable");
        ctx.fillStyle = "#ffffff"; // transparent images (PNG, SVG) read as a white sheet, not black
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        const texture = new CanvasTexture(canvas);
        texture.colorSpace = SRGBColorSpace;
        texture.anisotropy = Math.min(anisotropy, maxAnisotropy);
        texture.generateMipmaps = true;
        texture.minFilter = LinearMipmapLinearFilter;
        texture.needsUpdate = true;
        created = texture;
        setResult({ texture, width, height });
        invalidate();
      })
      .catch(() => {
        // A missing photo simply stays a blank canvas on the wall.
        if (!cancelled) setFailedUrl(url);
      })
      .finally(() => DefaultLoadingManager.itemEnd(url));
    return () => {
      cancelled = true;
      created?.dispose();
      setResult(null);
    };
  }, [url, enabled, maxSize, anisotropy, maxAnisotropy, invalidate]);

  const photo = enabled ? result : null;
  const status: PhotoStatus = !enabled ? "idle" : photo ? "ready" : failedUrl === url ? "error" : "loading";
  return { photo, status };
}
