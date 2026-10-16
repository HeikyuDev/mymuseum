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

/** Returns a user facing problem for an unusable file, or null when it is acceptable. */
export function validateImageFile(file: { type: string; size: number; name?: string }): string | null {
  if (!(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return "Only JPEG, PNG, WebP and AVIF images are supported.";
  }
  if (file.size > MAX_UPLOAD_BYTES) return "This image is larger than 10 MB.";
  if (file.size === 0) return "This file is empty.";
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
export function titleFromFileName(name: string): string {
  const base = name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
  return (base || "Untitled").slice(0, 160);
}
