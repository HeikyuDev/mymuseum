import { FLOOR_BASE, WALL_BASE } from "@/lib/scene-palette";
import type { ResolvedHallStyle } from "@/lib/hall-style";
import type { ThemePreset } from "@/types/database";

// Pure description of how a zone looks and is lit. The 3D components only turn
// these numbers into materials and lights.

export type ZoneLighting = {
  hemiSky: string;
  hemiGround: string;
  hemiIntensity: number;
  fill: string; // soft directional fill from the visitor side
  fillIntensity: number;
  spot: string;
  spotIntensity: number;
  spotAngle: number; // radians
  spotPenumbra: number;
  fog: string;
  exposure: number;
};

const LIGHTING: Record<ResolvedHallStyle["lighting"], ZoneLighting> = {
  soft: {
    hemiSky: "#ffffff",
    hemiGround: "#e6dfd3",
    hemiIntensity: 0.6,
    fill: "#fff8ee",
    fillIntensity: 0.3,
    spot: "#fff6e8",
    spotIntensity: 120,
    spotAngle: 0.62,
    spotPenumbra: 0.95,
    fog: "#f1ede6",
    exposure: 0.88,
  },
  warm: {
    hemiSky: "#fff0d8",
    hemiGround: "#d8bf99",
    hemiIntensity: 0.7,
    fill: "#ffd9a8",
    fillIntensity: 0.4,
    spot: "#ffd6a0",
    spotIntensity: 120,
    spotAngle: 0.56,
    spotPenumbra: 0.9,
    fog: "#e9d9bf",
    exposure: 1.0,
  },
  cold: {
    hemiSky: "#e8f1ff",
    hemiGround: "#c4d0e2",
    hemiIntensity: 0.75,
    fill: "#d6e6ff",
    fillIntensity: 0.4,
    spot: "#d2e4ff",
    spotIntensity: 100,
    spotAngle: 0.58,
    spotPenumbra: 0.9,
    fog: "#dfe6f0",
    exposure: 1.0,
  },
  dramatic: {
    hemiSky: "#ffeedd",
    hemiGround: "#3a3028",
    hemiIntensity: 0.36,
    fill: "#ffe8cc",
    fillIntensity: 0.12,
    spot: "#fff0d6",
    spotIntensity: 210,
    spotAngle: 0.42,
    spotPenumbra: 0.7,
    fog: "#1d1814",
    exposure: 0.95,
  },
};

export type SceneMood = {
  /** Multiplies the ambient light of every zone. */
  ambientScale: number;
  /** Multiplies wall and floor colors to tint the room toward the museum preset. */
  tint: string;
  /** Page / canvas background behind the gallery. */
  background: string;
};

const MOOD: Record<ThemePreset, SceneMood> = {
  light_modern: { ambientScale: 1, tint: "#ffffff", background: "#ebe7e0" },
  minimal_mono: { ambientScale: 1.02, tint: "#fdfdfd", background: "#e8e8e8" },
  warm_classic: { ambientScale: 0.82, tint: "#ffe3c4", background: "#2b1d14" },
  dark_elegant: { ambientScale: 0.62, tint: "#e6ddd0", background: "#14110f" },
  midnight_blue: { ambientScale: 0.6, tint: "#c3d1f0", background: "#0b1424" },
};

export function sceneMood(preset: ThemePreset): SceneMood {
  return MOOD[preset];
}

export type ZoneLook = {
  wallStyle: ResolvedHallStyle["wallStyle"];
  wallColor: string;
  floorStyle: ResolvedHallStyle["floorStyle"];
  floorColor: string;
  decoration: ResolvedHallStyle["floorDecoration"];
  decorationColor: string | null;
  accent: string | null;
  decor: ResolvedHallStyle["decor"];
  lighting: ZoneLighting;
};

export function zoneLook(style: ResolvedHallStyle): ZoneLook {
  return {
    wallStyle: style.wallStyle,
    wallColor: style.wallStyle === "custom_color" && style.wallColor ? style.wallColor : WALL_BASE[style.wallStyle],
    floorStyle: style.floorStyle,
    floorColor: FLOOR_BASE[style.floorStyle],
    decoration: style.floorDecoration,
    decorationColor: style.floorDecorationColor,
    accent: style.accent,
    decor: style.decor,
    lighting: LIGHTING[style.lighting],
  };
}

export const lightingPreset = (name: ResolvedHallStyle["lighting"]): ZoneLighting => LIGHTING[name];

/** Polished floors reflect their surroundings; carpet and concrete stay matte. */
export const FLOOR_FINISH: Record<ResolvedHallStyle["floorStyle"], { roughness: number; reflective: boolean; metalness: number }> = {
  parquet: { roughness: 0.42, reflective: true, metalness: 0 },
  marble: { roughness: 0.18, reflective: true, metalness: 0 },
  concrete: { roughness: 0.62, reflective: false, metalness: 0 },
  carpet: { roughness: 0.96, reflective: false, metalness: 0 },
  dark_wood: { roughness: 0.34, reflective: true, metalness: 0 },
};

export const WALL_FINISH: Record<ResolvedHallStyle["wallStyle"], { roughness: number; bump: number; sheen: number }> = {
  plaster: { roughness: 0.92, bump: 0.18, sheen: 0 },
  brick: { roughness: 0.88, bump: 1.4, sheen: 0 },
  concrete: { roughness: 0.84, bump: 0.7, sheen: 0 },
  wood_panel: { roughness: 0.55, bump: 0.5, sheen: 0 },
  marble: { roughness: 0.28, bump: 0.05, sheen: 0 },
  velvet: { roughness: 1, bump: 0.35, sheen: 1 },
  linen: { roughness: 0.95, bump: 0.5, sheen: 0.3 },
  custom_color: { roughness: 0.92, bump: 0.18, sheen: 0 },
};

/** Perceived darkness of a #rrggbb color (used to choose plaque and inscription tones). */
export function isDarkColor(hex: string): boolean {
  const n = Number.parseInt(hex.slice(1), 16);
  return 0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255) < 118;
}
