import type {
  FloorDecoration,
  FloorStyle,
  FrameStyle,
  HallRow,
  LightingPreset,
  WallStyle,
} from "@/types/database";

// Pipeline: DB row (any column may be missing) -> resolveHallStyle() -> typed
// style object -> scenery renderers. To add an option, add it here and render it.

export const WALL_STYLES: readonly WallStyle[] = [
  "plaster", "brick", "concrete", "wood_panel", "marble", "velvet", "linen", "custom_color",
];
export const FLOOR_STYLES: readonly FloorStyle[] = ["parquet", "marble", "concrete", "carpet", "dark_wood"];
export const LIGHTING_PRESETS: readonly LightingPreset[] = ["warm", "cold", "dramatic", "soft"];
export const FRAME_STYLES: readonly FrameStyle[] = [
  "minimal", "wood", "gold", "metallic", "canvas_wrap", "black_gallery", "vintage_ornate", "floating_glass",
];
export const FLOOR_DECORATIONS: readonly FloorDecoration[] = [
  "none", "red_carpet", "runner_gold_trim", "rug_persian", "rug_geometric", "spotlight_pool",
];

/** Typed registry of optional decor items stored in `halls.decor` (jsonb). */
export const DECOR_IDS = ["rope_barriers", "benches", "plants"] as const;
export type DecorId = (typeof DECOR_IDS)[number];

/**
 * Per-hall light control, stored in the same `halls.decor` jsonb bag (keys `lightMode` and
 * `brightness`), so it needs no migration. Missing or invalid values fall back to the defaults.
 */
export const LIGHT_MODES = ["default", "soft", "dim", "off"] as const;
export type LightMode = (typeof LIGHT_MODES)[number];
export const BRIGHTNESS_MIN = 40;
export const BRIGHTNESS_MAX = 120;
export const BRIGHTNESS_DEFAULT = 100;

export function clampBrightness(value: unknown): number {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(n)) return BRIGHTNESS_DEFAULT;
  return Math.min(BRIGHTNESS_MAX, Math.max(BRIGHTNESS_MIN, Math.round(n)));
}

export function resolveLightMode(value: unknown): LightMode {
  return typeof value === "string" && (LIGHT_MODES as readonly string[]).includes(value) ? (value as LightMode) : "default";
}

/** White-gallery defaults used when a hall has no explicit style. */
export const HALL_DEFAULTS = {
  wallStyle: "plaster",
  floorStyle: "parquet",
  lighting: "soft",
  frameStyle: "minimal",
  floorDecoration: "none",
} as const satisfies {
  wallStyle: WallStyle;
  floorStyle: FloorStyle;
  lighting: LightingPreset;
  frameStyle: FrameStyle;
  floorDecoration: FloorDecoration;
};

export type ResolvedHallStyle = {
  wallStyle: WallStyle;
  wallColor: string | null;
  floorStyle: FloorStyle;
  floorDecoration: FloorDecoration;
  floorDecorationColor: string | null;
  lighting: LightingPreset;
  defaultFrameStyle: FrameStyle;
  accent: string | null;
  decor: readonly DecorId[];
  lightMode: LightMode;
  /** Exposure scale for the hall in percent (40-120). */
  brightness: number;
};

type HallStyleInput = Partial<
  Pick<
    HallRow,
    | "wall_style" | "wall_color" | "floor_style" | "floor_decoration" | "floor_decoration_color"
    | "lighting_preset" | "default_frame_style" | "accent_color" | "decor"
  >
>;

export const isHex = (value: unknown): value is string =>
  typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value);

function oneOf<T extends string>(allowed: readonly T[], value: unknown, fallback: T): T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

function resolveDecor(raw: unknown): DecorId[] {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
  const bag = raw as Record<string, unknown>;
  return DECOR_IDS.filter((id) => bag[id] === true);
}

export function resolveHallStyle(row: HallStyleInput = {}): ResolvedHallStyle {
  const wallStyle = oneOf(WALL_STYLES, row.wall_style, HALL_DEFAULTS.wallStyle);
  const wallColor = isHex(row.wall_color) ? row.wall_color : null;
  return {
    // custom_color without a valid colour degrades to the default wall.
    wallStyle: wallStyle === "custom_color" && !wallColor ? HALL_DEFAULTS.wallStyle : wallStyle,
    wallColor,
    floorStyle: oneOf(FLOOR_STYLES, row.floor_style, HALL_DEFAULTS.floorStyle),
    floorDecoration: oneOf(FLOOR_DECORATIONS, row.floor_decoration, HALL_DEFAULTS.floorDecoration),
    floorDecorationColor: isHex(row.floor_decoration_color) ? row.floor_decoration_color : null,
    lighting: oneOf(LIGHTING_PRESETS, row.lighting_preset, HALL_DEFAULTS.lighting),
    defaultFrameStyle: oneOf(FRAME_STYLES, row.default_frame_style, HALL_DEFAULTS.frameStyle),
    accent: isHex(row.accent_color) ? row.accent_color : null,
    decor: resolveDecor(row.decor),
    ...resolveHallLight(row.decor),
  };
}

export function resolveHallLight(raw: unknown): { lightMode: LightMode; brightness: number } {
  const bag = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  return { lightMode: resolveLightMode(bag.lightMode), brightness: clampBrightness(bag.brightness) };
}
