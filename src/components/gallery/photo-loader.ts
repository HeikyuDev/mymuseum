import { CanvasTexture, LinearMipmapLinearFilter, SRGBColorSpace, Texture } from "three";
import { readImageSize } from "./image-size";
import { Limiter } from "./limiter";

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

// ---- concurrency and failures -----------------------------------------------------------------

const limiter = new Limiter();

/** A photo that could not be loaded. `permanent` failures (the file does not exist) are not worth retrying. */
export class PhotoLoadError extends Error {
  constructor(
    message: string,
    readonly permanent: boolean,
    readonly status?: number,
  ) {
    super(message);
    this.name = "PhotoLoadError";
  }
}

export const isAbort = (error: unknown) => error instanceof DOMException && error.name === "AbortError";
export const isPermanentPhotoError = (error: unknown) => error instanceof PhotoLoadError && error.permanent;

/** An abort signal that also fires after `ms`; `timedOut()` tells which one it was. */
function withDeadline(parent: AbortSignal, ms: number) {
  const controller = new AbortController();
  let expired = false;
  const onAbort = () => controller.abort();
  if (parent.aborted) controller.abort();
  else parent.addEventListener("abort", onAbort, { once: true });
  const timer = setTimeout(() => {
    expired = true;
    controller.abort();
  }, ms);
  return {
    signal: controller.signal,
    timedOut: () => expired && !parent.aborted,
    clear: () => {
      clearTimeout(timer);
      parent.removeEventListener("abort", onAbort);
    },
  };
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

function loadImageElement(url: string, signal: AbortSignal): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const stop = () => {
      image.onload = null;
      image.onerror = null;
      image.src = "";
      reject(new DOMException("aborted", "AbortError"));
    };
    if (signal.aborted) return stop();
    signal.addEventListener("abort", stop, { once: true });
    image.crossOrigin = "anonymous"; // keeps WebGL and exported canvases untainted
    image.decoding = "async";
    image.onload = () => void image.decode().catch(() => undefined).then(() => resolve(image));
    image.onerror = () => reject(new PhotoLoadError("image failed to load", false));
    image.src = url;
  });
}

/** Canvas path: SVG sources and images with transparency (drawn on a white sheet). */
async function viaCanvas(url: string, maxSize: number, anisotropy: number, signal: AbortSignal): Promise<LoadedPhoto> {
  const image = await loadImageElement(url, signal);
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
export async function loadPhotoTexture(url: string, maxSize: number, anisotropy: number, maxLoads: number, signal: AbortSignal, priority = 2, timeoutMs = 20000): Promise<LoadedPhoto> {
  await limiter.acquire(maxLoads, priority);
  // The deadline starts when the download does, not while waiting for a slot, and frees the slot when it fires.
  const deadline = withDeadline(signal, timeoutMs);
  try {
    if (signal.aborted) throw new DOMException("aborted", "AbortError");
    return await decode(url, maxSize, anisotropy, deadline.signal);
  } catch (error) {
    if (deadline.timedOut()) throw new PhotoLoadError("photo timed out", false);
    throw error;
  } finally {
    deadline.clear();
    limiter.release(maxLoads);
  }
}

async function decode(url: string, maxSize: number, anisotropy: number, signal: AbortSignal): Promise<LoadedPhoto> {
  {
    if (!supportsBitmap) return await viaCanvas(url, maxSize, anisotropy, signal);
    let response: Response;
    try {
      response = await fetch(url, { mode: "cors", signal });
    } catch (error) {
      if (isAbort(error)) throw error;
      throw new PhotoLoadError("network error", false);
    }
    if (!response.ok) throw new PhotoLoadError(`photo ${response.status}`, response.status === 404 || response.status === 410 || response.status === 403, response.status);
    const blob = await response.blob();
    // Vector sources cannot be decoded to a bitmap, and PNG may carry transparency: use the canvas path.
    if (/svg|png/.test(blob.type)) {
      const objectUrl = URL.createObjectURL(blob);
      try {
        return await viaCanvas(objectUrl, maxSize, anisotropy, signal);
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
  }
}
