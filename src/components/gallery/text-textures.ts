import { CanvasTexture, SRGBColorSpace } from "three";

// Engraved lettering drawn on canvases: museum placards and portal inscriptions.

export type TextToneName = "ivory" | "ink" | "stone";

type Ink = { face: string; border: string; text: string; shadow: string; highlight: string };

const TONES: Record<TextToneName, Ink> = {
  // light plaque, engraved dark lettering (for bright walls)
  ivory: { face: "#f3efe6", border: "rgba(120,98,52,0.55)", text: "#2a2620", shadow: "rgba(255,255,255,0.9)", highlight: "rgba(0,0,0,0.25)" },
  // black plaque, gold lettering (for dark walls)
  ink: { face: "#16140f", border: "rgba(201,162,39,0.7)", text: "#d9bd6a", shadow: "rgba(0,0,0,0.8)", highlight: "rgba(255,230,160,0.25)" },
  // transparent stone inscription (portals)
  stone: { face: "rgba(0,0,0,0)", border: "rgba(0,0,0,0)", text: "#4a4338", shadow: "rgba(255,255,255,0.65)", highlight: "rgba(0,0,0,0.3)" },
};

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] | null {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width <= maxWidth || !line) {
      line = next;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines || lines.some((l) => ctx.measureText(l).width > maxWidth)) return null;
  return lines;
}

/** Draws centered text that shrinks (then wraps, then ellipsizes) to fit the box. */
function fitText(ctx: CanvasRenderingContext2D, text: string, family: string, weight: number, width: number, height: number, maxLines: number, startSize: number, minSize: number) {
  for (let size = startSize; size >= minSize; size -= 2) {
    ctx.font = `${weight} ${size}px ${family}`;
    const lines = wrap(ctx, text, width, maxLines);
    if (lines && lines.length * size * 1.18 <= height) return { lines, size };
  }
  ctx.font = `${weight} ${minSize}px ${family}`;
  let clipped = text;
  while (clipped.length > 1 && ctx.measureText(`${clipped}...`).width > width) clipped = clipped.slice(0, -1);
  return { lines: [`${clipped.trimEnd()}...`], size: minSize };
}

export type PlaqueOptions = {
  title: string;
  /** Plaque proportions: width / height. */
  aspect: number;
  family: string;
  tone: TextToneName;
  pixelHeight?: number;
};

export function makePlaqueTexture({ title, aspect, family, tone, pixelHeight = 192 }: PlaqueOptions): CanvasTexture {
  const h = pixelHeight;
  const w = Math.round(h * aspect);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const ink = TONES[tone];
  ctx.fillStyle = ink.face;
  ctx.fillRect(0, 0, w, h);
  // engraved border
  ctx.strokeStyle = ink.border;
  ctx.lineWidth = Math.max(2, h * 0.014);
  const inset = h * 0.09;
  ctx.strokeRect(inset, inset, w - inset * 2, h - inset * 2);

  const padX = h * 0.22;
  const { lines, size } = fitText(ctx, title, family, 600, w - padX * 2, h - inset * 3, 2, h * 0.44, h * 0.2);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const lineHeight = size * 1.2;
  const startY = h / 2 - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((line, i) => {
    const y = startY + i * lineHeight;
    // engraving: light edge below, dark inside
    ctx.fillStyle = ink.shadow;
    ctx.fillText(line, w / 2, y + Math.max(1, size * 0.03));
    ctx.fillStyle = ink.text;
    ctx.fillText(line, w / 2, y);
  });
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

export type InscriptionOptions = {
  text: string;
  /** Optional small line above the main text. */
  eyebrow?: string;
  aspect: number;
  family: string;
  bodyFamily: string;
  color: string;
  shadow: string;
  pixelHeight?: number;
};

/** Large engraved lettering on a transparent canvas (portal heads, museum title). */
export function makeInscriptionTexture({ text, eyebrow, aspect, family, bodyFamily, color, shadow, pixelHeight = 256 }: InscriptionOptions): CanvasTexture {
  const h = pixelHeight;
  const w = Math.round(h * aspect);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, w, h);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const hasEyebrow = Boolean(eyebrow);
  const mainHeight = hasEyebrow ? h * 0.66 : h;
  const { lines, size } = fitText(ctx, text, family, 600, w * 0.92, mainHeight, 2, h * (hasEyebrow ? 0.4 : 0.5), h * 0.14);
  const lineHeight = size * 1.15;
  const mainCenter = hasEyebrow ? h * 0.62 : h / 2;
  const startY = mainCenter - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((line, i) => {
    const y = startY + i * lineHeight;
    ctx.fillStyle = shadow;
    ctx.fillText(line, w / 2, y + size * 0.035);
    ctx.fillStyle = color;
    ctx.fillText(line, w / 2, y);
  });
  if (eyebrow) {
    const eyebrowSize = h * 0.11;
    ctx.font = `500 ${eyebrowSize}px ${bodyFamily}`;
    const spaced = eyebrow.toUpperCase().split("").join(String.fromCharCode(8202));
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.8;
    ctx.fillText(spaced, w / 2, h * 0.14);
    ctx.globalAlpha = 1;
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

/** A 2x2 neutral sheet shown until the real photograph has loaded. */
export function makePlaceholderTexture(): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 2;
  canvas.height = 2;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#d9d5cd";
  ctx.fillRect(0, 0, 2, 2);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

/** Soft rectangular shadow (blurred), used as a cheap drop shadow behind frames. */
export function makeSoftShadowTexture(): CanvasTexture {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#000";
  ctx.filter = "blur(18px)";
  ctx.fillRect(56, 56, size - 112, size - 112);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

/** Radial light pool for the "spotlight pool" floor decoration. */
export function makeLightPoolTexture(color: string): CanvasTexture {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, color);
  gradient.addColorStop(0.55, `${color}88`);
  gradient.addColorStop(1, `${color}00`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

/** Soft white radial wash used as a baked stand-in for a spotlight's pool on the wall (additive). */
export function makeWallGlowTexture(size = 128): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, "rgba(255,246,226,0.95)");
  gradient.addColorStop(0.45, "rgba(255,246,226,0.35)");
  gradient.addColorStop(1, "rgba(255,246,226,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

/** Vertical black gradient (alpha from `top` to `bottom`): baked ambient occlusion along junctions. */
export function makeEdgeShadeTexture(top: number, bottom: number): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 4;
  canvas.height = 64;
  const ctx = canvas.getContext("2d")!;
  const gradient = ctx.createLinearGradient(0, 0, 0, 64);
  gradient.addColorStop(0, `rgba(0,0,0,${top})`);
  gradient.addColorStop(1, `rgba(0,0,0,${bottom})`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 4, 64);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

/** Soft vertical sheen used as a fake floor reflection on glossy floors (additive). */
export function makeFloorSheenTexture(): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 4;
  canvas.height = 64;
  const ctx = canvas.getContext("2d")!;
  const gradient = ctx.createLinearGradient(0, 0, 0, 64);
  gradient.addColorStop(0, "rgba(255,250,240,0.0)");
  gradient.addColorStop(0.35, "rgba(255,250,240,0.22)");
  gradient.addColorStop(1, "rgba(255,250,240,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 4, 64);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

export type WallLetteringOptions = {
  /** The museum name: set in capitals with wide tracking. */
  title: string;
  /** A small line under a hairline (the first hall's name). */
  subtitle?: string;
  /** Width / height of the canvas. */
  aspect: number;
  family: string;
  color: string;
  /** Soft relief: a light edge on the upper left and a dark edge on the lower right. */
  light: string;
  dark: string;
  pixelHeight?: number;
};

function trackedWidth(ctx: CanvasRenderingContext2D, text: string, tracking: number): number {
  let width = 0;
  for (const char of text) width += ctx.measureText(char).width + tracking;
  return width - tracking;
}

function drawTracked(ctx: CanvasRenderingContext2D, text: string, centerX: number, y: number, tracking: number) {
  let x = centerX - trackedWidth(ctx, text, tracking) / 2;
  ctx.textAlign = "left";
  for (const char of text) {
    ctx.fillText(char, x, y);
    x += ctx.measureText(char).width + tracking;
  }
}

/** Large, minimal sans-serif lettering for the feature wall: generous tracking and a subtle relief. */
export function makeWallLetteringTexture({ title, subtitle, aspect, family, color, light, dark, pixelHeight = 256 }: WallLetteringOptions): CanvasTexture {
  const h = pixelHeight;
  const w = Math.round(h * aspect);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, w, h);
  ctx.textBaseline = "middle";

  const text = title.trim().toUpperCase();
  const hasSubtitle = Boolean(subtitle);
  const maxWidth = w * 0.94;
  // Shrink until the whole name fits on one line, then fall back to the smallest readable size.
  let size = h * (hasSubtitle ? 0.42 : 0.5);
  const minSize = h * 0.16;
  let tracking = size * 0.34;
  for (; size > minSize; size -= 2) {
    tracking = size * 0.34;
    ctx.font = `500 ${size}px ${family}`;
    if (trackedWidth(ctx, text, tracking) <= maxWidth) break;
  }
  ctx.font = `500 ${size}px ${family}`;
  const baseline = hasSubtitle ? h * 0.36 : h * 0.5;
  const relief = Math.max(1, size * 0.028);
  const passes: [string, number, number][] = [
    [dark, relief * 1.4, relief * 1.6],
    [light, -relief * 0.8, -relief * 0.9],
    [color, 0, 0],
  ];
  for (const [fill, dx, dy] of passes) {
    ctx.fillStyle = fill;
    drawTracked(ctx, text, w / 2 + dx, baseline + dy, tracking);
  }

  if (subtitle) {
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.45;
    ctx.lineWidth = Math.max(1, h * 0.008);
    ctx.beginPath();
    ctx.moveTo(w * 0.36, h * 0.66);
    ctx.lineTo(w * 0.64, h * 0.66);
    ctx.stroke();
    const subSize = h * 0.115;
    ctx.font = `500 ${subSize}px ${family}`;
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.78;
    drawTracked(ctx, subtitle.toUpperCase(), w / 2, h * 0.8, subSize * 0.5);
    ctx.globalAlpha = 1;
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

/** Vertical wash for the LED cove: bright at the ceiling line, gone a meter below (additive). */
export function makeLedWashTexture(): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 4;
  canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  const gradient = ctx.createLinearGradient(0, 0, 0, 128);
  gradient.addColorStop(0, "rgba(255,244,222,0.95)");
  gradient.addColorStop(0.18, "rgba(255,244,222,0.42)");
  gradient.addColorStop(0.55, "rgba(255,244,222,0.12)");
  gradient.addColorStop(1, "rgba(255,244,222,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 4, 128);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}
