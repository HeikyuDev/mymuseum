import { FLOOR_BASE, WALL_BASE } from "@/lib/scene-palette";
import type { LightMode, ResolvedHallStyle } from "@/lib/hall-style";
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
  /** False when the hall has no artificial spotlights (light mode Off). */
  spots: boolean;
  /** Strength (0-1) of the baked light glow on the wall behind each artwork. */
  glow: number;
  /** Scales reflections on walls, floors and frames (0 = matte). */
  shine: number;
};

type BaseLighting = Omit<ZoneLighting, "spots" | "glow" | "shine">;

const LIGHTING: Record<ResolvedHallStyle["lighting"], BaseLighting> = {
  soft: {
    hemiSky: "#ffffff",
    hemiGround: "#e6dfd3",
    hemiIntensity: 0.5,
    fill: "#fff8ee",
    fillIntensity: 0.2,
    spot: "#fff6e8",
    spotIntensity: 70,
    spotAngle: 0.62,
    spotPenumbra: 0.95,
    fog: "#f1ede6",
    exposure: 0.78,
  },
  warm: {
    hemiSky: "#fff0d8",
    hemiGround: "#d8bf99",
    hemiIntensity: 0.55,
    fill: "#ffd9a8",
    fillIntensity: 0.25,
    spot: "#ffd6a0",
    spotIntensity: 75,
    spotAngle: 0.56,
    spotPenumbra: 0.9,
    fog: "#e9d9bf",
    exposure: 0.84,
  },
  cold: {
    hemiSky: "#e8f1ff",
    hemiGround: "#c4d0e2",
    hemiIntensity: 0.6,
    fill: "#d6e6ff",
    fillIntensity: 0.25,
    spot: "#d2e4ff",
    spotIntensity: 65,
    spotAngle: 0.58,
    spotPenumbra: 0.9,
    fog: "#dfe6f0",
    exposure: 0.84,
  },
  dramatic: {
    hemiSky: "#ffeedd",
    hemiGround: "#3a3028",
    hemiIntensity: 0.3,
    fill: "#ffe8cc",
    fillIntensity: 0.08,
    spot: "#fff0d6",
    spotIntensity: 140,
    spotAngle: 0.42,
    spotPenumbra: 0.7,
    fog: "#1d1814",
    exposure: 0.84,
  },
};

/** Turns a preset plus the hall light mode and brightness into render-ready light values. */
export function zoneLighting(preset: ResolvedHallStyle["lighting"], mode: LightMode = "default", brightness = 100): ZoneLighting {
  const base = LIGHTING[preset];
  const scale = brightness / 100;
  let out: ZoneLighting;
  switch (mode) {
    case "soft":
      out = { ...base, hemiIntensity: base.hemiIntensity * 1.1, spotIntensity: base.spotIntensity * 0.5, spotPenumbra: 1, spots: true, glow: 0.55, shine: 0.55 };
      break;
    case "dim":
      out = { ...base, hemiIntensity: base.hemiIntensity * 0.7, fillIntensity: base.fillIntensity * 0.6, spotIntensity: base.spotIntensity * 0.8, exposure: base.exposure * 0.85, spots: true, glow: 0.8, shine: 0.7 };
      break;
    case "off":
      // Flat natural light: no spotlights, no glare, so photos stay matte and true to color.
      out = { ...base, hemiIntensity: Math.max(base.hemiIntensity, 0.55) * 1.35, fillIntensity: base.fillIntensity * 0.5, spotIntensity: 0, spots: false, glow: 0, shine: 0.15 };
      break;
    default:
      out = { ...base, spots: true, glow: 1, shine: 1 };
  }
  return { ...out, exposure: out.exposure * scale };
}

/**
 * Brightness multiplier (0-1) of the unlit photo surface. Photos are never lit by the room, so
 * they keep their true colors; only a very dim room lowers them slightly, so they do not glow.
 */
export function photoLevel(lighting: ZoneLighting): number {
  return Math.min(1, 0.74 + 0.26 * (lighting.exposure / 0.78));
}

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
  lightMode: LightMode;
  brightness: number;
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
    lighting: zoneLighting(style.lighting, style.lightMode, style.brightness),
    lightMode: style.lightMode,
    brightness: style.brightness,
  };
}

export const lightingPreset = (name: ResolvedHallStyle["lighting"], mode: LightMode = "default", brightness = 100): ZoneLighting => zoneLighting(name, mode, brightness);

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
