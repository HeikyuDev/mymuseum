// Output formats and the safe zones that keep key content clear of the
// Instagram Story interface (profile bar on top, reply bar on the bottom).

export type StoryFormatId = "story" | "post" | "square";

export type StoryFormat = {
  id: StoryFormatId;
  label: string;
  ratio: string;
  width: number;
  height: number;
  /** Insets (design px) inside which all key content must stay. */
  safe: { top: number; bottom: number; side: number };
  /** Caption type scale (design px). */
  type: { titleMax: number; titleMin: number; detail: number; descMax: number; descMin: number };
};

export const STORY_FORMATS: Record<StoryFormatId, StoryFormat> = {
  story: {
    id: "story",
    label: "Story",
    ratio: "9:16",
    width: 1080,
    height: 1920,
    safe: { top: 250, bottom: 340, side: 72 },
    type: { titleMax: 84, titleMin: 40, detail: 30, descMax: 32, descMin: 24 },
  },
  post: {
    id: "post",
    label: "Post",
    ratio: "4:5",
    width: 1080,
    height: 1350,
    safe: { top: 80, bottom: 80, side: 72 },
    type: { titleMax: 76, titleMin: 38, detail: 28, descMax: 30, descMin: 22 },
  },
  square: {
    id: "square",
    label: "Square",
    ratio: "1:1",
    width: 1080,
    height: 1080,
    safe: { top: 64, bottom: 64, side: 72 },
    type: { titleMax: 68, titleMin: 34, detail: 26, descMax: 28, descMin: 20 },
  },
};

export const STORY_FORMAT_IDS = Object.keys(STORY_FORMATS) as StoryFormatId[];

export function isFormatId(value: unknown): value is StoryFormatId {
  return typeof value === "string" && value in STORY_FORMATS;
}

/** Fraction of the canvas height where the floor starts when it is visible. */
export const FLOOR_START = 0.84;

export type Rect = { x: number; y: number; w: number; h: number };

/** The area available to the composition: inside the safe zone and above the floor. */
export function contentRegion(format: StoryFormat, hasFloor: boolean): Rect & { floorY: number | null } {
  const { safe, width, height } = format;
  const floorY = hasFloor ? Math.round(height * FLOOR_START) : null;
  const bottomLimit = height - safe.bottom;
  const bottom = floorY === null ? bottomLimit : Math.min(bottomLimit, floorY - Math.round(height * 0.02));
  return { x: safe.side, y: safe.top, w: width - 2 * safe.side, h: bottom - safe.top, floorY };
}
