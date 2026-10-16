// Output formats of the exported museum photograph and the safe zones that keep
// the subject clear of the Instagram Story interface (profile bar on top, reply
// bar at the bottom).

export type PhotoFormatId = "story" | "post" | "square";

export type PhotoFormat = {
  id: PhotoFormatId;
  ratio: string;
  width: number;
  height: number;
  /** Insets (px at 1x) inside which the subject must stay. */
  safe: { top: number; bottom: number; side: number };
};

export const PHOTO_FORMATS: Record<PhotoFormatId, PhotoFormat> = {
  story: { id: "story", ratio: "9:16", width: 1080, height: 1920, safe: { top: 250, bottom: 340, side: 90 } },
  post: { id: "post", ratio: "4:5", width: 1080, height: 1350, safe: { top: 90, bottom: 90, side: 90 } },
  square: { id: "square", ratio: "1:1", width: 1080, height: 1080, safe: { top: 80, bottom: 80, side: 90 } },
};

export const PHOTO_FORMAT_IDS = Object.keys(PHOTO_FORMATS) as PhotoFormatId[];

export function isFormatId(value: unknown): value is PhotoFormatId {
  return typeof value === "string" && value in PHOTO_FORMATS;
}
