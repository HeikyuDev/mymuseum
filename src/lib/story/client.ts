import { FONT_PAIRING_STACKS } from "@/lib/theme";
import type { FontPairing } from "@/types/database";
import { analyzePhoto, type PhotoStats } from "./color";
import type { PhotoSource, StoryFonts } from "./render";
import { createCanvas } from "./draw/util";

// Browser-only helpers around the pure renderer: fonts, photo loading, blobs, sharing.

const MAX_SOURCE_SIDE = 2400; // keeps iOS Safari inside its canvas memory budget

/** Replaces `var(--x)` references with the family names next/font generated at runtime. */
export function resolveFontStack(stack: string): string {
  const root = getComputedStyle(document.documentElement);
  return stack.replace(/var\((--[\w-]+)\)/g, (_, name: string) => root.getPropertyValue(name).trim() || "serif");
}

export function resolveStoryFonts(pairing: FontPairing): StoryFonts {
  const stacks = FONT_PAIRING_STACKS[pairing];
  return {
    display: resolveFontStack(stacks.display),
    body: resolveFontStack(stacks.body),
    script: resolveFontStack(FONT_PAIRING_STACKS.handwritten.display),
  };
}

/** Makes sure every face (and glyph subset) used by the caption is loaded before drawing. */
export async function loadStoryFonts(fonts: StoryFonts, sample: string): Promise<void> {
  if (typeof document === "undefined" || !document.fonts) return;
  const text = `${sample} ABCDEFGHIJKLMNOPQRSTUVWXYZ abcdefghijklmnopqrstuvwxyz 0123456789`;
  const faces = [`600 48px ${fonts.display}`, `500 24px ${fonts.body}`, `400 24px ${fonts.body}`, `600 48px ${fonts.script}`];
  const loading = Promise.all(faces.map((face) => document.fonts.load(face, text).catch(() => [])));
  // Never hang the export on a slow font: fall back after a few seconds.
  await Promise.race([loading, new Promise((resolve) => setTimeout(resolve, 4000))]);
}

export class PhotoLoadError extends Error {
  constructor() {
    super("The image could not be loaded for export. It may be unavailable or blocked from cross-origin use.");
    this.name = "PhotoLoadError";
  }
}

function loadImageElement(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous"; // required to keep the canvas untainted
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new PhotoLoadError());
    img.src = url;
  });
}

/** Decodes the photo honoring EXIF orientation, with an <img> fallback for older browsers. */
async function decode(url: string): Promise<CanvasImageSource & { width: number; height: number }> {
  try {
    const response = await fetch(url, { mode: "cors", credentials: "omit" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const blob = await response.blob();
    return await createImageBitmap(blob, { imageOrientation: "from-image" });
  } catch {
    // Browsers apply EXIF orientation to <img> by default, so this path is orientation-safe too.
    return loadImageElement(url);
  }
}

export type LoadedPhoto = { photo: PhotoSource; stats: PhotoStats | null };

export async function loadPhoto(url: string): Promise<LoadedPhoto> {
  const decoded = await decode(url);
  const width = "naturalWidth" in decoded ? (decoded as HTMLImageElement).naturalWidth : decoded.width;
  const height = "naturalHeight" in decoded ? (decoded as HTMLImageElement).naturalHeight : decoded.height;
  if (!width || !height) throw new PhotoLoadError();

  let image: CanvasImageSource = decoded;
  let w = width;
  let h = height;
  const longest = Math.max(width, height);
  if (longest > MAX_SOURCE_SIDE) {
    const factor = MAX_SOURCE_SIDE / longest;
    w = Math.round(width * factor);
    h = Math.round(height * factor);
    const reduced = createCanvas(w, h);
    const rctx = reduced.getContext("2d");
    if (rctx) {
      rctx.imageSmoothingQuality = "high";
      rctx.drawImage(decoded, 0, 0, w, h);
      image = reduced;
    }
  }

  // The heuristics only need a thumbnail.
  let stats: PhotoStats | null = null;
  try {
    const sample = 48;
    const f = sample / Math.max(w, h);
    const sc = createCanvas(Math.max(1, Math.round(w * f)), Math.max(1, Math.round(h * f)));
    const sctx = sc.getContext("2d", { willReadFrequently: true });
    if (sctx) {
      sctx.drawImage(image, 0, 0, sc.width, sc.height);
      stats = analyzePhoto(sctx.getImageData(0, 0, sc.width, sc.height).data);
    }
  } catch {
    stats = null; // tainted canvas: the export will report it clearly
  }
  return { photo: { image, width: w, height: h }, stats };
}

export function canvasToBlob(canvas: HTMLCanvasElement, jpeg: boolean): Promise<Blob> {
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error("The browser could not create the image. Try again or pick a smaller format."));
        },
        jpeg ? "image/jpeg" : "image/png",
        jpeg ? 0.92 : undefined,
      );
    } catch {
      reject(new Error("The image could not be exported because its source blocks cross-origin access."));
    }
  });
}

export function canShareFile(file: File): boolean {
  try {
    return typeof navigator !== "undefined" && typeof navigator.canShare === "function" && navigator.canShare({ files: [file] });
  } catch {
    return false;
  }
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
