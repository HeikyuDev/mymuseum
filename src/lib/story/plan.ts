import { z } from "zod";
import {
  FLOOR_DECORATION_SPECS,
  FRAME_DEFAULT_COLOR,
  LIGHTING,
  WALL_BASE,
  type Lighting,
} from "@/lib/scene-palette";
import {
  FRAME_STYLES,
  LIGHTING_PRESETS,
  WALL_STYLES,
  isHex,
  resolveHallStyle,
  type DecorId,
  type ResolvedHallStyle,
} from "@/lib/hall-style";
import type { FloorDecoration, FloorStyle, FontPairing, FrameStyle, LightingPreset, WallStyle } from "@/types/database";
import { brightness, hexToRgb, mixHex, rgbToHex, suggestForPhoto, type PhotoStats } from "./color";
import { isFormatId, type StoryFormatId } from "./formats";
import type { CaptionStyleId, CaptionTexts } from "./layout";

// Data model of an export. `StoryStyleOptions` is what the user can change
// (everything defaults to "auto"); `resolveStoryPlan` turns it, together with
// the artwork, hall and photo statistics, into a fully resolved `StoryPlan`
// that the canvas renderer draws without making any further decisions.

export const CAPTION_STYLES: readonly CaptionStyleId[] = ["elegant", "plaque", "handwritten"];
/** Wall presets offered besides the museum's own halls. */
export const WALL_PRESETS: readonly WallStyle[] = WALL_STYLES.filter((style) => style !== "custom_color");
const BUSY_WALLS: readonly WallStyle[] = ["brick", "wood_panel", "marble"];

export type StoryStyleOptions = {
  format: StoryFormatId;
  /** "auto" (the artwork's hall), `hall:<id>` or `wall:<style>`. */
  scene: string;
  showFloor: boolean;
  wallTint: "auto" | "none" | "photo" | "custom";
  wallTintColor: string;
  lighting: "auto" | LightingPreset;
  spotlight: boolean;
  vignette: boolean;
  grain: boolean;
  frame: "auto" | FrameStyle;
  frameColor: string | null;
  mat: "auto" | "on" | "off";
  matColor: string | null;
  captionStyle: "auto" | CaptionStyleId;
  textTone: "auto" | "light" | "dark";
  watermark: boolean;
  jpeg: boolean;
};

export const DEFAULT_STYLE_OPTIONS: StoryStyleOptions = {
  format: "story",
  scene: "auto",
  showFloor: false,
  wallTint: "auto",
  wallTintColor: "#c9a227",
  lighting: "auto",
  spotlight: true,
  vignette: true,
  grain: true,
  frame: "auto",
  frameColor: null,
  mat: "auto",
  matColor: null,
  captionStyle: "auto",
  textTone: "auto",
  watermark: true,
  jpeg: false,
};

const hexOrNull = z.string().refine(isHex).nullable();

/** Validates options read from localStorage; anything invalid falls back to defaults field by field. */
export const styleOptionsSchema = z.object({
  format: z.string().refine(isFormatId),
  scene: z.string().max(80),
  showFloor: z.boolean(),
  wallTint: z.enum(["auto", "none", "photo", "custom"]),
  wallTintColor: z.string().refine(isHex),
  lighting: z.enum(["auto", ...LIGHTING_PRESETS] as [string, ...string[]]),
  spotlight: z.boolean(),
  vignette: z.boolean(),
  grain: z.boolean(),
  frame: z.enum(["auto", ...FRAME_STYLES] as [string, ...string[]]),
  frameColor: hexOrNull,
  mat: z.enum(["auto", "on", "off"]),
  matColor: hexOrNull,
  captionStyle: z.enum(["auto", ...CAPTION_STYLES] as [string, ...string[]]),
  textTone: z.enum(["auto", "light", "dark"]),
  watermark: z.boolean(),
  jpeg: z.boolean(),
});

export function parseStoredOptions(raw: unknown): StoryStyleOptions {
  const out: Record<string, unknown> = { ...DEFAULT_STYLE_OPTIONS };
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ...DEFAULT_STYLE_OPTIONS };
  const bag = raw as Record<string, unknown>;
  for (const key of Object.keys(DEFAULT_STYLE_OPTIONS) as (keyof StoryStyleOptions)[]) {
    if (styleOptionsSchema.shape[key].safeParse(bag[key]).success) out[key] = bag[key];
  }
  return out as StoryStyleOptions;
}

// ---- inputs -----------------------------------------------------------------

export type StoryArtworkInfo = {
  title: string;
  year: number | null;
  imageUrl: string;
  aspect: number | null;
  frameStyle: FrameStyle;
  frameColor: string | null;
  mat: boolean;
  matColor: string | null;
};

export type StoryHallInfo = { id: string; name: string; style: ResolvedHallStyle };

export type StoryMuseumInfo = { title: string; slug: string; accent: string; fontPairing: FontPairing };

/** Default caption: the artwork title and, only as a discreet detail, its year. Never the author. */
export function defaultCaptionTexts(artwork: Pick<StoryArtworkInfo, "title" | "year">): CaptionTexts {
  return { title: artwork.title.trim(), detail: artwork.year ? String(artwork.year) : "", description: "" };
}

// ---- resolved plan ------------------------------------------------------------

export type StoryPlan = {
  format: StoryFormatId;
  wall: {
    style: WallStyle;
    color: string | null;
    /** 0-0.2 darkening */
    dim: number;
    tint: { color: string; alpha: number } | null;
  };
  floor: {
    style: FloorStyle;
    decoration: FloorDecoration;
    decorationColor: string;
    decor: readonly DecorId[];
  } | null;
  lighting: Lighting & { spotlight: boolean; vignetteOn: boolean };
  grain: boolean;
  frame: { style: FrameStyle; color: string };
  mat: { color: string } | null;
  caption: { style: CaptionStyleId; tone: "auto" | "light" | "dark"; texts: CaptionTexts; accent: string };
  fontPairing: FontPairing;
  watermark: string | null;
};

export function parseScene(scene: string, halls: readonly StoryHallInfo[], fallbackHallId: string | null): ResolvedHallStyle {
  if (scene.startsWith("wall:")) {
    const wall = scene.slice(5);
    if ((WALL_PRESETS as readonly string[]).includes(wall)) return resolveHallStyle({ wall_style: wall as WallStyle });
  }
  const hallId = scene.startsWith("hall:") ? scene.slice(5) : fallbackHallId;
  const hall = halls.find((item) => item.id === hallId) ?? halls.find((item) => item.id === fallbackHallId) ?? halls[0];
  return hall?.style ?? resolveHallStyle({});
}

export function wallBaseColor(style: WallStyle, color: string | null): string {
  return style === "custom_color" && color ? color : WALL_BASE[style];
}

export function resolveStoryPlan(input: {
  options: StoryStyleOptions;
  texts: CaptionTexts;
  artwork: StoryArtworkInfo;
  halls: readonly StoryHallInfo[];
  hallId: string | null;
  museum: StoryMuseumInfo;
  stats: PhotoStats | null;
}): StoryPlan {
  const { options, artwork, museum, stats } = input;
  const hall = parseScene(options.scene, input.halls, input.hallId);
  const wallColor = wallBaseColor(hall.wallStyle, hall.wallColor);
  const suggestion = suggestForPhoto(stats, wallColor);

  // Wall: tint only when asked for; "auto" just dims a bright wall behind a bright photo.
  let tint: StoryPlan["wall"]["tint"] = null;
  if (options.wallTint === "custom") tint = { color: options.wallTintColor, alpha: 0.32 };
  else if (options.wallTint === "photo" && stats) {
    tint = { color: mixHex(rgbToHex(stats.dominant), "#808080", 0.35), alpha: 0.3 };
  }
  const dim = options.wallTint === "auto" ? suggestion.wallDim : 0;

  const light = LIGHTING[options.lighting === "auto" ? hall.lighting : options.lighting];
  const lighting = {
    ...light,
    cone: options.spotlight ? light.cone : 0,
    vignette: options.vignette ? light.vignette : 0,
    spotlight: options.spotlight,
    vignetteOn: options.vignette,
  };

  // Frame: the artwork's own frame; a minimal frame without explicit color gets a tone that contrasts with the wall.
  const frameStyle = options.frame === "auto" ? artwork.frameStyle : options.frame;
  let frameColor = options.frameColor ?? (options.frame === "auto" ? artwork.frameColor : null);
  if (!frameColor) frameColor = frameStyle === "minimal" ? suggestion.minimalFrameColor : FRAME_DEFAULT_COLOR[frameStyle];

  // Mat: photos look best with a wide passe-partout, so "auto" turns it on.
  const matOn = options.mat === "on" || (options.mat === "auto" && frameStyle !== "canvas_wrap");
  const matColor = options.matColor ?? (options.mat === "auto" ? artwork.matColor : null) ?? suggestion.matColor;

  const decoration = hall.floorDecoration;
  const decorationColor =
    hall.floorDecorationColor ?? (decoration === "none" ? "#000000" : FLOOR_DECORATION_SPECS[decoration].color);

  // Busy textures (brick, wood, marble) get a plaque so the title never fights the wall.
  const captionStyle: CaptionStyleId =
    options.captionStyle !== "auto"
      ? options.captionStyle
      : museum.fontPairing === "handwritten"
        ? "handwritten"
        : BUSY_WALLS.includes(hall.wallStyle)
          ? "plaque"
          : "elegant";

  return {
    format: options.format,
    wall: { style: hall.wallStyle, color: hall.wallColor, dim, tint },
    floor: options.showFloor
      ? { style: hall.floorStyle, decoration, decorationColor, decor: hall.decor }
      : null,
    lighting,
    grain: options.grain,
    frame: { style: frameStyle, color: frameColor },
    mat: matOn ? { color: matColor } : null,
    caption: { style: captionStyle, tone: options.textTone, texts: input.texts, accent: museum.accent },
    fontPairing: museum.fontPairing,
    watermark: options.watermark ? museum.title : null,
  };
}

/** Brightness 0-1 of the resolved wall, handy for UI hints and tests. */
export const wallBrightness = (plan: StoryPlan) =>
  brightness(hexToRgb(wallBaseColor(plan.wall.style, plan.wall.color))) * (1 - plan.wall.dim);
