import { CanvasTexture, LinearMipmapLinearFilter, SRGBColorSpace, Texture } from "three";
import { readImageSize } from "./image-size";

// Photo decoding for the 3D scene. Photos are fetched, decoded off the main thread with
// createImageBitmap (resized on the way when they exceed the tier cap), limited to a few
// concurrent downloads and uploaded as sRGB, mipmapped textures.
//
// Photo textures use flipY = false (an ImageBitmap cannot be flipped at upload time), so the
// photo plane flips its own UVs. See `flipPlaneUv`.

export type LoadedPhoto = { texture: Texture; width: number; height: number };

/** Flips the V axis of a plane geometry so un-flipped photo textures appear upright. */
export function flipPlaneUv(uv: { count: number; getY(i: number): number; setY(i: number, y: number): void; needsUpdate: boolean }): void {
  for (let i = 0; i < uv.count; i += 1) uv.setY(i, 1 - uv.getY(i));
  uv.needsUpdate = true;
}

// ---- concurrency ----------------------------------------------------------------------------

let active = 0;
const waiting: Array<{ priority: number; wake: () => void }> = [];

/** Lower priority numbers go first (the artwork in front of the camera beats a far neighbour). */
async function acquire(limit: number, priority: number): Promise<void> {
  if (active < limit) {
    active += 1;
    return;
  }
  await new Promise<void>((resolve) => {
    const at = waiting.findIndex((item) => item.priority > priority);
    waiting.splice(at < 0 ? waiting.length : at, 0, { priority, wake: resolve });
  });
  active += 1;
}

function release(limit: number) {
  active -= 1;
  // Wake as many waiters as the limit allows.
  while (waiting.length > 0 && active < limit) waiting.shift()?.wake();
}

// ---- decoding -------------------------------------------------------------------------------

function applyTextureSettings(texture: Texture, anisotropy: number) {
  texture.colorSpace = SRGBColorSpace;
  texture.flipY = false;
  texture.anisotropy = anisotropy;
  texture.generateMipmaps = true;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.needsUpdate = true;
}

function loadImageElement(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous"; // keeps WebGL and exported canvases untainted
    image.decoding = "async";
    image.onload = () => void image.decode().catch(() => undefined).then(() => resolve(image));
    image.onerror = () => reject(new Error("image failed to load"));
    image.src = url;
  });
}

/** Canvas path: SVG sources and images with transparency (drawn on a white sheet). */
async function viaCanvas(url: string, maxSize: number, anisotropy: number): Promise<LoadedPhoto> {
  const image = await loadImageElement(url);
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  const scale = Math.min(1, maxSize / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas unavailable");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  const texture = new CanvasTexture(canvas);
  applyTextureSettings(texture, anisotropy);
  return { texture, width, height };
}

const supportsBitmap = typeof createImageBitmap === "function" && typeof fetch === "function";

/**
 * Loads one photo as a GPU texture no larger than `maxSize` on its longest side.
 * Rejects when the image is missing (callers fall back or leave the canvas blank).
 */
export async function loadPhotoTexture(url: string, maxSize: number, anisotropy: number, maxLoads: number, signal: AbortSignal, priority = 2): Promise<LoadedPhoto> {
  await acquire(maxLoads, priority);
  try {
    if (signal.aborted) throw new DOMException("aborted", "AbortError");
    if (!supportsBitmap) return await viaCanvas(url, maxSize, anisotropy);
    const response = await fetch(url, { mode: "cors", signal });
    if (!response.ok) throw new Error(`photo ${response.status}`);
    const blob = await response.blob();
    // Vector sources cannot be decoded to a bitmap, and PNG may carry transparency: use the canvas path.
    if (/svg|png/.test(blob.type)) {
      const objectUrl = URL.createObjectURL(blob);
      try {
        return await viaCanvas(objectUrl, maxSize, anisotropy);
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    }
    // Decode and downscale in one background step when the size is known from the header. Resizing an
    // existing bitmap would run synchronously on the main thread.
    const size = readImageSize(await blob.slice(0, 262144).arrayBuffer());
    let bitmap: ImageBitmap;
    let width: number;
    let height: number;
    if (size) {
      width = size.width;
      height = size.height;
      const scale = Math.min(1, maxSize / Math.max(width, height));
      const resize = scale >= 1 ? {} : width >= height ? { resizeWidth: Math.max(1, Math.round(width * scale)) } : { resizeHeight: Math.max(1, Math.round(height * scale)) };
      bitmap = await createImageBitmap(blob, { imageOrientation: "from-image", resizeQuality: "medium", ...resize });
    } else {
      bitmap = await createImageBitmap(blob, { imageOrientation: "from-image" });
      width = bitmap.width;
      height = bitmap.height;
      const scale = Math.min(1, maxSize / Math.max(width, height));
      if (scale < 1) {
        const resized = await createImageBitmap(bitmap, { resizeWidth: Math.max(1, Math.round(width * scale)), resizeHeight: Math.max(1, Math.round(height * scale)), resizeQuality: "medium" });
        bitmap.close();
        bitmap = resized;
      }
    }
    if (signal.aborted) {
      bitmap.close();
      throw new DOMException("aborted", "AbortError");
    }
    const texture = new Texture(bitmap);
    applyTextureSettings(texture, anisotropy);
    texture.onUpdate = () => {
      // The bitmap lives on the GPU now; release the CPU copy.
      (texture.image as ImageBitmap).close?.();
      texture.onUpdate = null;
    };
    return { texture, width, height };
  } finally {
    release(maxLoads);
  }
}
