// Pure helpers for artwork uploads (no DOM access, unit tested).

export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"] as const;
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // matches the bucket limit
export const MAX_IMAGE_SIDE = 2400;
export const OUTPUT_QUALITY = 0.85;

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
};

export function extensionFor(contentType: string): string | null {
  return EXTENSIONS[contentType] ?? null;
}

/** Returns a message code (see translateCode) for an unusable file, or null when it is acceptable. */
export function validateImageFile(file: { type: string; size: number; name?: string }): string | null {
  if (!(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return "img.type";
  }
  if (file.size > MAX_UPLOAD_BYTES) return "img.tooLarge";
  if (file.size === 0) return "img.empty";
  return null;
}

/** Scales (w, h) down so the long side is at most `max`. Never upscales. */
export function fitWithin(width: number, height: number, max = MAX_IMAGE_SIDE) {
  const longSide = Math.max(width, height);
  if (longSide <= max) return { width, height, scaled: false };
  const factor = max / longSide;
  return {
    width: Math.max(1, Math.round(width * factor)),
    height: Math.max(1, Math.round(height * factor)),
    scaled: true,
  };
}

/** width / height rounded to the 4 decimals stored in artworks.aspect_ratio. */
export function aspectRatioOf(width: number, height: number): number {
  return Math.round((width / height) * 10000) / 10000;
}

/** Default artwork title from a file name: "my-photo_01.JPG" -> "my photo 01". */
export function titleFromFileName(name: string, fallback = "Untitled"): string {
  const base = name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
  return (base || fallback).slice(0, 160);
}

export const THUMB_MAX_SIDE = 640;
export const THUMB_QUALITY = 0.8;
/** Artworks created before thumbnails existed skip the lookup and load the original directly. */
export const THUMBS_SINCE = "2026-10-16T00:00:00Z";

/**
 * Deterministic thumbnail location for an uploaded image: `{museum}/{id}.{ext}` becomes
 * `{museum}/thumbs/{id}.webp`. Returns null for any other path shape (no thumbnail convention).
 */
export function thumbPathFor(imagePath: string | null | undefined): string | null {
  if (!imagePath) return null;
  const parts = imagePath.split("/");
  if (parts.length !== 2 || !parts[0] || !parts[1] || parts[0] === "thumbs") return null;
  const base = parts[1].replace(/.[^.]+$/, "");
  return base ? `${parts[0]}/thumbs/${base}.webp` : null;
}

/** Whether an artwork created at `createdAt` can have a thumbnail (older ones never do). */
export function mayHaveThumb(createdAt: string | null | undefined): boolean {
  if (!createdAt) return false;
  const time = Date.parse(createdAt);
  return Number.isFinite(time) && time >= Date.parse(THUMBS_SINCE);
}
