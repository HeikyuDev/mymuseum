// Pure color maths and photo heuristics. Everything here works on plain
// numbers so it can be unit tested without a canvas.

export type Rgb = readonly [number, number, number];

const clamp = (v: number, lo = 0, hi = 255) => Math.min(hi, Math.max(lo, v));

export function hexToRgb(hex: string): Rgb {
  const n = Number.parseInt(hex.replace("#", "").slice(0, 6), 16);
  if (Number.isNaN(n)) return [128, 128, 128];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex([r, g, b]: Rgb): string {
  return `#${[r, g, b].map((v) => Math.round(clamp(v)).toString(16).padStart(2, "0")).join("")}`;
}

export const rgba = ([r, g, b]: Rgb, alpha: number) =>
  `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${alpha})`;

/** Linear blend: amount 0 returns `a`, 1 returns `b`. */
export function mix(a: Rgb, b: Rgb, amount: number): Rgb {
  return [a[0] + (b[0] - a[0]) * amount, a[1] + (b[1] - a[1]) * amount, a[2] + (b[2] - a[2]) * amount];
}

export const mixHex = (a: string, b: string, amount: number) => rgbToHex(mix(hexToRgb(a), hexToRgb(b), amount));
export const darken = (hex: string, amount: number) => mixHex(hex, "#000000", amount);
export const lighten = (hex: string, amount: number) => mixHex(hex, "#ffffff", amount);

/** WCAG relative luminance (0-1). */
export function relativeLuminance([r, g, b]: Rgb): number {
  const [lr, lg, lb] = [r, g, b].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
}

export function contrast(a: Rgb, b: Rgb): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Perceived brightness in gamma space (0-1); better than luminance for "is it dark" decisions. */
export const brightness = ([r, g, b]: Rgb) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

export const TEXT_LIGHT = "#f7f3ea";
export const TEXT_DARK = "#1c1a17";

export type TextTone = "light" | "dark";

/** Chooses the text tone with the higher contrast against the (average) background. */
export function pickTextTone(background: Rgb): TextTone {
  return contrast(background, hexToRgb(TEXT_LIGHT)) >= contrast(background, hexToRgb(TEXT_DARK)) ? "light" : "dark";
}

export const toneColor = (tone: TextTone) => (tone === "light" ? TEXT_LIGHT : TEXT_DARK);

/** Mean color of an RGBA buffer, ignoring transparent pixels. */
export function averageColor(data: ArrayLike<number>): Rgb {
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  for (let i = 0; i + 3 < data.length; i += 4) {
    if (data[i + 3] < 16) continue;
    r += data[i];
    g += data[i + 1];
    b += data[i + 2];
    n += 1;
  }
  return n === 0 ? [128, 128, 128] : [r / n, g / n, b / n];
}

export type PhotoStats = {
  average: Rgb;
  dominant: Rgb;
  /** Mean perceived brightness 0-1. */
  brightness: number;
  /** Standard deviation of brightness 0-1 (flat images are low). */
  spread: number;
  /** Mean saturation 0-1. */
  saturation: number;
  dark: boolean;
  bright: boolean;
};

/**
 * Summarises a downscaled RGBA sample of the photo. The dominant color is the
 * heaviest 4-bit-per-channel bucket, weighted toward saturated pixels so a
 * grey sky does not beat a colorful subject.
 */
export function analyzePhoto(data: ArrayLike<number>): PhotoStats {
  const buckets = new Map<number, { weight: number; r: number; g: number; b: number; n: number }>();
  let sum = 0;
  let sumSq = 0;
  let sat = 0;
  let count = 0;
  let r = 0;
  let g = 0;
  let b = 0;

  for (let i = 0; i + 3 < data.length; i += 4) {
    if (data[i + 3] < 16) continue;
    const pr = data[i];
    const pg = data[i + 1];
    const pb = data[i + 2];
    const max = Math.max(pr, pg, pb);
    const min = Math.min(pr, pg, pb);
    const s = max === 0 ? 0 : (max - min) / max;
    const y = brightness([pr, pg, pb]);
    sum += y;
    sumSq += y * y;
    sat += s;
    r += pr;
    g += pg;
    b += pb;
    count += 1;
    const key = ((pr >> 4) << 8) | ((pg >> 4) << 4) | (pb >> 4);
    const bucket = buckets.get(key) ?? { weight: 0, r: 0, g: 0, b: 0, n: 0 };
    bucket.weight += 1 + 2 * s;
    bucket.r += pr;
    bucket.g += pg;
    bucket.b += pb;
    bucket.n += 1;
    buckets.set(key, bucket);
  }

  if (count === 0) {
    return { average: [128, 128, 128], dominant: [128, 128, 128], brightness: 0.5, spread: 0, saturation: 0, dark: false, bright: false };
  }

  let best: { weight: number; r: number; g: number; b: number; n: number } | null = null;
  for (const bucket of buckets.values()) if (!best || bucket.weight > best.weight) best = bucket;
  const mean = sum / count;
  const average: Rgb = [r / count, g / count, b / count];
  return {
    average,
    dominant: best ? [best.r / best.n, best.g / best.n, best.b / best.n] : average,
    brightness: mean,
    spread: Math.sqrt(Math.max(0, sumSq / count - mean * mean)),
    saturation: sat / count,
    dark: mean < 0.3,
    bright: mean > 0.65,
  };
}

export type PhotoSuggestion = {
  matColor: string;
  /** Darkening (0-0.2) applied to a bright wall so a bright photo does not dissolve into it. */
  wallDim: number;
  /** Frame color to use when the style has no explicit one (only for the thin "minimal" style). */
  minimalFrameColor: string;
};

const MAT_BASE = "#f4f0e6";

/** Mat, wall and frame tone suggestions that keep photo and room harmonious. */
export function suggestForPhoto(stats: PhotoStats | null, wallColor: string): PhotoSuggestion {
  const wallBright = brightness(hexToRgb(wallColor)) > 0.62;
  let mat = MAT_BASE;
  let wallDim = 0;
  if (stats) {
    // Bright photos get a slightly greyer mat so whites do not glare; dark ones a clean warm white.
    if (stats.bright) mat = mixHex(MAT_BASE, "#d9d2c4", 0.55);
    else if (stats.dark) mat = "#f8f5ee";
    // A hint of the photo's dominant color keeps mat and picture related.
    mat = mixHex(mat, rgbToHex(stats.dominant), stats.saturation > 0.12 ? 0.05 : 0);
    if (stats.bright && wallBright) wallDim = 0.09;
  }
  return { matColor: mat, wallDim, minimalFrameColor: wallBright ? "#1b1b1b" : "#f6f3ec" };
}
