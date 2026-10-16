import type { FloorDecoration, FloorStyle, FrameStyle, LightingPreset, WallStyle } from "@/types/database";

// Pure scene constants shared by the 3D gallery (components/gallery) and the
// CSS wall and frame previews in the admin pickers. No DOM, no CSS: just palettes and numbers.

export const WALL_BASE: Record<WallStyle, string> = {
  plaster: "#e7e2d8",
  brick: "#8f4333",
  concrete: "#a3a5a7",
  wood_panel: "#8a5a36",
  marble: "#e3dfd8",
  velvet: "#5b1a2c",
  linen: "#d8ccb5",
  custom_color: "#e8e4dc",
};

export const FLOOR_BASE: Record<FloorStyle, string> = {
  parquet: "#c4b49c",
  marble: "#d8d4cc",
  concrete: "#9fa1a3",
  carpet: "#6b3a43",
  dark_wood: "#4a301e",
};

export type Lighting = {
  tint: string; // "r, g, b"
  cone: number; // strength of the spotlight cone
  vignette: number; // edge darkening 0-1
  ambient: string; // overlay color over the whole room
};

export const LIGHTING: Record<LightingPreset, Lighting> = {
  warm: { tint: "255, 214, 150", cone: 0.34, vignette: 0.42, ambient: "rgba(255, 190, 110, 0.08)" },
  cold: { tint: "176, 208, 255", cone: 0.28, vignette: 0.42, ambient: "rgba(120, 160, 255, 0.08)" },
  dramatic: { tint: "255, 240, 215", cone: 0.5, vignette: 0.75, ambient: "rgba(0, 0, 0, 0.2)" },
  soft: { tint: "255, 255, 255", cone: 0.2, vignette: 0.16, ambient: "rgba(255, 255, 255, 0.04)" },
};

export type DecorationSpec = {
  /** "runner" spans the whole strip, "rug" repeats per slot, "pool" is a light spot per slot. */
  kind: "runner" | "rug" | "pool";
  color: string;
};

export const FLOOR_DECORATION_SPECS: Record<Exclude<FloorDecoration, "none">, DecorationSpec> = {
  red_carpet: { kind: "runner", color: "#86303a" },
  runner_gold_trim: { kind: "runner", color: "#2f4b41" },
  rug_persian: { kind: "rug", color: "#6d343b" },
  rug_geometric: { kind: "rug", color: "#3b4552" },
  spotlight_pool: { kind: "pool", color: "#fff6dc" },
};

/** Frame thickness as a multiple of the base unit `t`. */
export const FRAME_PAD_MULT: Record<FrameStyle, number> = {
  minimal: 0.6,
  wood: 1.7,
  gold: 1.6,
  metallic: 1.2,
  canvas_wrap: 0,
  black_gallery: 0.9,
  vintage_ornate: 2.6,
  floating_glass: 0,
};

export const FRAME_DEFAULT_COLOR: Record<FrameStyle, string> = {
  minimal: "#f6f3ec",
  wood: "#6b4423",
  gold: "#c9a227",
  metallic: "#b8bcc2",
  canvas_wrap: "#e6e0d2",
  black_gallery: "#111111",
  vintage_ornate: "#b08d3c",
  floating_glass: "#ffffff",
};

export const DEFAULT_MAT_COLOR = "#f4f0e6";
