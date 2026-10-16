import type { CSSProperties } from "react";
import { DEFAULT_LOCALE, resolveLocale, type Locale } from "@/lib/i18n";
import type { FontPairing, MuseumRow, ThemePreset } from "@/types/database";

export const DEFAULT_THEME_PRESET: ThemePreset = "light_modern";
export const DEFAULT_FONT_PAIRING: FontPairing = "classic";
export const DEFAULT_ACCENT = "#c9a227";

type Palette = {
  scheme: "dark" | "light";
  canvas: string; // page background
  raised: string; // bars and panels
  surface: string; // cards and inputs
  fg: string; // primary text
  muted: string; // secondary text
  line: string; // borders and dividers
};

// Every fg/muted pair meets WCAG AA (4.5:1) against canvas, raised and surface.
export const THEME_PRESETS: Record<ThemePreset, Palette> = {
  dark_elegant: {
    scheme: "dark",
    canvas: "#14110f",
    raised: "#1d1915",
    surface: "#272119",
    fg: "#f3ece1",
    muted: "#bdb1a1",
    line: "rgba(243, 236, 225, 0.16)",
  },
  light_modern: {
    scheme: "light",
    canvas: "#faf8f5",
    raised: "#ffffff",
    surface: "#f1ede6",
    fg: "#1c1a17",
    muted: "#5b564e",
    line: "rgba(28, 26, 23, 0.12)",
  },
  warm_classic: {
    scheme: "dark",
    canvas: "#2b1d14",
    raised: "#36251a",
    surface: "#443020",
    fg: "#f8ead3",
    muted: "#d6c1a2",
    line: "rgba(248, 234, 211, 0.18)",
  },
  midnight_blue: {
    scheme: "dark",
    canvas: "#0b1424",
    raised: "#111d33",
    surface: "#192945",
    fg: "#e8eefc",
    muted: "#aebcda",
    line: "rgba(232, 238, 252, 0.16)",
  },
  minimal_mono: {
    scheme: "light",
    canvas: "#ffffff",
    raised: "#fafafa",
    surface: "#f0f0f0",
    fg: "#0a0a0a",
    muted: "#525252",
    line: "rgba(10, 10, 10, 0.16)",
  },
};

export const FONT_PAIRING_STACKS: Record<FontPairing, { display: string; body: string }> = {
  classic: {
    display: "var(--font-playfair), Georgia, serif",
    body: "var(--font-inter), system-ui, sans-serif",
  },
  modern: {
    display: "var(--font-space), system-ui, sans-serif",
    body: "var(--font-inter), system-ui, sans-serif",
  },
  editorial: {
    display: "var(--font-fraunces), Georgia, serif",
    body: "var(--font-inter), system-ui, sans-serif",
  },
  handwritten: {
    display: "var(--font-caveat), cursive",
    body: "var(--font-inter), system-ui, sans-serif",
  },
};

export function resolvePreset(value: unknown): ThemePreset {
  return typeof value === "string" && value in THEME_PRESETS
    ? (value as ThemePreset)
    : DEFAULT_THEME_PRESET;
}

export function resolveFontPairing(value: unknown): FontPairing {
  return typeof value === "string" && value in FONT_PAIRING_STACKS
    ? (value as FontPairing)
    : DEFAULT_FONT_PAIRING;
}

export function resolveAccent(value: unknown): string {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value) ? value : DEFAULT_ACCENT;
}

// ---- color helpers -------------------------------------------------------

function parseHex(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex([r, g, b]: [number, number, number]): string {
  return `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;
}

function luminance(hex: string): number {
  const [r, g, b] = parseHex(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

function mix(a: string, b: string, amount: number): string {
  const [ar, ag, ab] = parseHex(a);
  const [br, bg, bb] = parseHex(b);
  return toHex([ar + (br - ar) * amount, ag + (bg - ag) * amount, ab + (bb - ab) * amount]);
}

/** Moves the accent toward the foreground until it is readable as text on `bg`. */
function readableAccent(accent: string, bg: string, fg: string): string {
  let color = accent;
  for (let step = 1; step <= 10 && contrastRatio(color, bg) < 4.5; step += 1) {
    color = mix(accent, fg, step / 10);
  }
  return color;
}

/** Text color that stays readable on top of the accent color. */
function onAccent(accent: string): string {
  return contrastRatio(accent, "#0a0a0a") >= contrastRatio(accent, "#ffffff") ? "#0a0a0a" : "#ffffff";
}

// ---- theme overrides -----------------------------------------------------

const RADIUS = { sharp: "4px", soft: "12px", round: "24px" } as const;
const DENSITY = { compact: 0.85, comfortable: 1, spacious: 1.25 } as const;
const MOTION = {
  calm: { stiffness: 60, damping: 18 },
  normal: { stiffness: 90, damping: 20 },
  lively: { stiffness: 140, damping: 18 },
} as const;

export type ThemeOverrides = {
  radius: keyof typeof RADIUS;
  density: keyof typeof DENSITY;
  motion: keyof typeof MOTION;
  /** Whether public visitors may download the museum-styled image of an artwork. */
  allowVisitorExport: boolean;
  /** Language shown to visitors who have not picked one yet. */
  defaultLocale: Locale;
};

export const DEFAULT_OVERRIDES: ThemeOverrides = {
  radius: "soft",
  density: "comfortable",
  motion: "normal",
  allowVisitorExport: true,
  defaultLocale: DEFAULT_LOCALE,
};

function pick<K extends string>(table: Record<K, unknown>, raw: unknown, fallback: K): K {
  return typeof raw === "string" && raw in table ? (raw as K) : fallback;
}

export const THEME_OVERRIDE_OPTIONS = {
  radius: Object.keys(RADIUS) as (keyof typeof RADIUS)[],
  density: Object.keys(DENSITY) as (keyof typeof DENSITY)[],
  motion: Object.keys(MOTION) as (keyof typeof MOTION)[],
};

export function resolveOverrides(raw: unknown): ThemeOverrides {
  const bag = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  return {
    radius: pick(RADIUS, bag.radius, DEFAULT_OVERRIDES.radius),
    density: pick(DENSITY, bag.density, DEFAULT_OVERRIDES.density),
    motion: pick(MOTION, bag.motion, DEFAULT_OVERRIDES.motion),
    allowVisitorExport:
      typeof bag.allowVisitorExport === "boolean" ? bag.allowVisitorExport : DEFAULT_OVERRIDES.allowVisitorExport,
    defaultLocale: resolveLocale(bag.defaultLocale),
  };
}

// ---- resolver ------------------------------------------------------------

export type ResolvedMuseumTheme = {
  preset: ThemePreset;
  accent: string;
  fontPairing: FontPairing;
  overrides: ThemeOverrides;
  spring: { stiffness: number; damping: number };
  /** CSS custom properties consumed by the Tailwind tokens (bg-canvas, text-fg, ...). */
  cssVars: CSSProperties;
};

/** Museum DB row (any column may be missing) -> fully resolved theme with defaults. */
export function resolveMuseumTheme(
  row: Partial<Pick<MuseumRow, "theme_preset" | "accent_color" | "font_pairing" | "theme_overrides">> = {},
): ResolvedMuseumTheme {
  const preset = resolvePreset(row.theme_preset);
  const palette = THEME_PRESETS[preset];
  const accent = resolveAccent(row.accent_color);
  const fontPairing = resolveFontPairing(row.font_pairing);
  const fonts = FONT_PAIRING_STACKS[fontPairing];
  const overrides = resolveOverrides(row.theme_overrides);

  const vars: Record<string, string> = {
    "--v-canvas": palette.canvas,
    "--v-raised": palette.raised,
    "--v-surface": palette.surface,
    "--v-fg": palette.fg,
    "--v-muted": palette.muted,
    "--v-line": palette.line,
    "--v-accent": accent,
    "--v-accent-text": readableAccent(accent, palette.canvas, palette.fg),
    "--v-on-accent": onAccent(accent),
    "--v-font-display": fonts.display,
    "--v-font-body": fonts.body,
    "--v-radius": RADIUS[overrides.radius],
    "--v-density": String(DENSITY[overrides.density]),
    colorScheme: palette.scheme,
  };
  return { preset, accent, fontPairing, overrides, spring: MOTION[overrides.motion], cssVars: vars as CSSProperties };
}
