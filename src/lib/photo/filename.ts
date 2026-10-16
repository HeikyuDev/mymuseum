import type { PhotoFormatId } from "./formats";

/** Lowercase ASCII slug; accents are folded, everything else becomes a hyphen. */
export function slugify(text: string, fallback = "artwork", maxLength = 40): string {
  const slug = text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength)
    .replace(/-+$/g, "");
  return slug || fallback;
}

export function buildFilename(input: {
  museumSlug: string;
  artworkTitle: string;
  format: PhotoFormatId;
  extension: "png" | "jpg";
}): string {
  const museum = slugify(input.museumSlug, "museum");
  const artwork = slugify(input.artworkTitle, "artwork");
  return `${museum}-${artwork}-${input.format}.${input.extension}`;
}
