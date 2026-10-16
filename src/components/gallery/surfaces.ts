import {
  CanvasTexture,
  LinearMipmapLinearFilter,
  LinearFilter,
  NoColorSpace,
  RepeatWrapping,
  SRGBColorSpace,
  type Texture,
} from "three";
import type { FloorStyle, WallStyle } from "@/types/database";

// Procedural wall and floor materials drawn on canvases: albedo, bump and
// roughness maps, tileable, seeded (so the same style always looks the same).
// UVs are built in meters by the consumer, so one texture serves any surface.

export type SurfaceMaps = {
  color: Texture;
  bump: Texture;
  rough: Texture;
  /** Edge of one tile in meters. */
  tileMeters: number;
};

type Rgb = [number, number, number];
type Sample = { c: Rgb; h: number; r: number }; // color 0-255, height 0-1, roughness multiplier 0-1

// ---- noise ---------------------------------------------------------------

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

class Lattice {
  private readonly values: Float32Array;
  constructor(readonly size: number, seed: number) {
    const rand = mulberry32(seed);
    this.values = new Float32Array(size * size);
    for (let i = 0; i < this.values.length; i += 1) this.values[i] = rand();
  }
  /** Smooth, tileable value noise for u,v in [0,1) (any real number wraps). */
  at(u: number, v: number): number {
    const n = this.size;
    const x = (u - Math.floor(u)) * n;
    const y = (v - Math.floor(v)) * n;
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = x - x0;
    const fy = y - y0;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const x1 = (x0 + 1) % n;
    const y1 = (y0 + 1) % n;
    const a = this.values[y0 * n + x0];
    const b = this.values[y0 * n + x1];
    const c = this.values[y1 * n + x0];
    const d = this.values[y1 * n + x1];
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  }
}

/** Fractal noise built from tileable lattices (frequencies are lattice sizes). */
class Fbm {
  private readonly layers: Lattice[];
  constructor(seed: number, private readonly base: number, octaves: number) {
    this.layers = Array.from({ length: octaves }, (_, i) => new Lattice(base * 2 ** i, seed + i * 101));
  }
  at(u: number, v: number): number {
    let sum = 0;
    let amp = 0.5;
    let norm = 0;
    for (const layer of this.layers) {
      sum += layer.at(u, v) * amp;
      norm += amp;
      amp *= 0.5;
    }
    return sum / norm;
  }
}

// ---- color helpers -------------------------------------------------------

function hexToRgb(hex: string): Rgb {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const mixRgb = (a: Rgb, b: Rgb, t: number): Rgb => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const scaleRgb = (a: Rgb, k: number): Rgb => [a[0] * k, a[1] * k, a[2] * k];
const hash2 = (a: number, b: number, seed: number) => {
  let h = (Math.imul(a + 374761393, 668265263) ^ Math.imul(b + 1274126177, 2246822519) ^ Math.imul(seed + 97, 3266489917)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return (h ^ (h >>> 16)) / 4294967296;
};

// ---- canvas plumbing -----------------------------------------------------

function paint(size: number, sample: (u: number, v: number) => Sample, colorOnly = false): { color: HTMLCanvasElement; bump: HTMLCanvasElement; rough: HTMLCanvasElement } {
  // colorOnly (cheap tier): bump and roughness maps are never read, so they stay 1x1 and the sampler loop skips them.
  const make = (side = size) => {
    const canvas = document.createElement("canvas");
    canvas.width = side;
    canvas.height = side;
    return canvas;
  };
  const color = make();
  const bump = make(colorOnly ? 1 : size);
  const rough = make(colorOnly ? 1 : size);
  const cctx = color.getContext("2d")!;
  const bctx = bump.getContext("2d")!;
  const rctx = rough.getContext("2d")!;
  const cdata = cctx.createImageData(size, size);
  const bdata = bctx.createImageData(colorOnly ? 1 : size, colorOnly ? 1 : size);
  const rdata = rctx.createImageData(colorOnly ? 1 : size, colorOnly ? 1 : size);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const s = sample((x + 0.5) / size, (y + 0.5) / size);
      const i = (y * size + x) * 4;
      cdata.data[i] = s.c[0];
      cdata.data[i + 1] = s.c[1];
      cdata.data[i + 2] = s.c[2];
      cdata.data[i + 3] = 255;
      if (colorOnly) continue;
      const h = Math.max(0, Math.min(255, s.h * 255));
      bdata.data[i] = bdata.data[i + 1] = bdata.data[i + 2] = h;
      bdata.data[i + 3] = 255;
      const r = Math.max(0, Math.min(255, s.r * 255));
      rdata.data[i] = rdata.data[i + 1] = rdata.data[i + 2] = r;
      rdata.data[i + 3] = 255;
    }
  }
  cctx.putImageData(cdata, 0, 0);
  if (!colorOnly) {
    bctx.putImageData(bdata, 0, 0);
    rctx.putImageData(rdata, 0, 0);
  }
  return { color, bump, rough };
}

function toTextures(canvases: ReturnType<typeof paint>, tileMeters: number, anisotropy: number): SurfaceMaps {
  const build = (canvas: HTMLCanvasElement, srgb: boolean) => {
    const texture = new CanvasTexture(canvas);
    texture.wrapS = RepeatWrapping;
    texture.wrapT = RepeatWrapping;
    texture.colorSpace = srgb ? SRGBColorSpace : NoColorSpace;
    texture.anisotropy = anisotropy;
    texture.generateMipmaps = true;
    texture.minFilter = LinearMipmapLinearFilter;
    texture.magFilter = LinearFilter;
    texture.needsUpdate = true;
    return texture;
  };
  return { color: build(canvases.color, true), bump: build(canvases.bump, false), rough: build(canvases.rough, false), tileMeters };
}

// ---- wall styles ---------------------------------------------------------

function wallSampler(style: WallStyle, base: Rgb): { tile: number; sample: (u: number, v: number) => Sample } {
  const broad = new Fbm(11, 3, 3);
  const fine = new Fbm(23, 24, 3);
  const grain = new Lattice(128, 41);

  switch (style) {
    case "brick": {
      const cols = 4;
      const rows = 12;
      const mortar: Rgb = [196, 188, 176];
      return {
        tile: 0.92,
        sample: (u, v) => {
          const row = Math.floor(v * rows);
          const shift = row % 2 === 0 ? 0 : 0.5;
          const bu = u * cols + shift;
          const col = Math.floor(bu);
          const fu = bu - col;
          const fv = v * rows - row;
          const edge = Math.min(fu, 1 - fu, fv * 0.28, (1 - fv) * 0.28);
          const inMortar = edge < 0.035;
          const tone = 0.82 + 0.34 * hash2(col, row, 3);
          const speck = fine.at(u, v);
          if (inMortar) return { c: scaleRgb(mortar, 0.9 + speck * 0.14), h: 0.05, r: 1 };
          const brick = scaleRgb(mixRgb(base, [60, 28, 22], 0.2 + hash2(col, row, 9) * 0.35), tone * (0.72 + speck * 0.2));
          return { c: brick, h: 0.55 + speck * 0.4, r: 0.92 };
        },
      };
    }
    case "concrete":
      return {
        tile: 1.6,
        sample: (u, v) => {
          const b = broad.at(u, v);
          const f = fine.at(u, v);
          const pit = grain.at(u * 3, v * 3) > 0.93 ? 0.55 : 1;
          const k = (0.86 + b * 0.22 + (f - 0.5) * 0.14) * pit;
          const seam = Math.abs(((v * 2) % 1) - 0.5) > 0.495 ? 0.8 : 1;
          return { c: scaleRgb(base, k * seam), h: 0.5 + (f - 0.5) * 0.7 * pit, r: 0.9 };
        },
      };
    case "wood_panel": {
      const planks = 8;
      return {
        tile: 1.12,
        sample: (u, v) => {
          const idx = Math.floor(u * planks);
          const fu = u * planks - idx;
          const tone = 0.78 + 0.44 * hash2(idx, 1, 5);
          const ring = Math.sin((fu * 6 + broad.at(u * 2, v * 0.5) * 6 + hash2(idx, 2, 6) * 10) * Math.PI) * 0.5 + 0.5;
          const streak = fine.at(u * 0.4 + idx * 0.13, v * 0.06);
          const k = tone * (0.86 + ring * 0.1 + streak * 0.18);
          const gap = fu < 0.025 || fu > 0.975;
          const colorValue = gap ? scaleRgb(base, 0.35) : scaleRgb(mixRgb(base, [48, 28, 14], ring * 0.35), k);
          return { c: colorValue, h: gap ? 0.05 : 0.5 + ring * 0.3, r: gap ? 1 : 0.7 + streak * 0.2 };
        },
      };
    }
    case "marble":
      return {
        tile: 1.8,
        sample: (u, v) => {
          const warp = broad.at(u, v) * 2.2;
          const vein = Math.abs(Math.sin((u * 3 + v * 2 + warp) * Math.PI * 2));
          const line = Math.pow(1 - vein, 14);
          const fine2 = Math.pow(1 - Math.abs(Math.sin((u * 7 - v * 5 + warp * 2.4) * Math.PI * 2)), 22) * 0.5;
          const k = 0.96 + (fine.at(u, v) - 0.5) * 0.05;
          const c = mixRgb(scaleRgb(base, k), [120, 118, 122], Math.min(0.55, line * 0.5 + fine2 * 0.3));
          return { c, h: 0.5, r: 0.6 + line * 0.3 };
        },
      };
    case "velvet":
      return {
        tile: 1.2,
        sample: (u, v) => {
          const b = broad.at(u, v);
          const f = grain.at(u * 6, v * 6);
          const k = 0.85 + b * 0.2 + (f - 0.5) * 0.1;
          return { c: scaleRgb(base, k), h: 0.5 + (f - 0.5) * 0.5, r: 1 };
        },
      };
    case "linen": {
      const threads = 70;
      return {
        tile: 0.9,
        sample: (u, v) => {
          const wx = Math.sin(u * threads * Math.PI * 2) * 0.5 + 0.5;
          const wy = Math.sin(v * threads * Math.PI * 2) * 0.5 + 0.5;
          const over = (Math.floor(u * threads) + Math.floor(v * threads)) % 2 === 0;
          const weave = over ? wx : wy;
          const slub = fine.at(u * 0.5, v * 8) * 0.12;
          const k = 0.9 + weave * 0.12 + slub + (broad.at(u, v) - 0.5) * 0.08;
          return { c: scaleRgb(base, k), h: 0.4 + weave * 0.5, r: 0.95 };
        },
      };
    }
    default:
      // plaster and custom_color: soft, slightly mottled lime plaster.
      return {
        tile: 1.6,
        sample: (u, v) => {
          const b = broad.at(u, v);
          const f = fine.at(u, v);
          const trowel = Math.sin((u * 5 + b * 2.2) * Math.PI * 2) * 0.006;
          const k = 0.955 + b * 0.075 + (f - 0.5) * 0.045 + trowel;
          return { c: scaleRgb(base, k), h: 0.45 + (f - 0.5) * 0.7 + b * 0.2, r: 0.93 };
        },
      };
  }
}

export function makeWallMaps(style: WallStyle, baseHex: string, size: number, anisotropy: number, colorOnly = false): SurfaceMaps {
  const base = hexToRgb(baseHex);
  const { tile, sample } = wallSampler(style, base);
  return toTextures(paint(size, sample, colorOnly), tile, anisotropy);
}

// ---- floor styles --------------------------------------------------------

function floorSampler(style: FloorStyle, base: Rgb): { tile: number; sample: (u: number, v: number) => Sample } {
  const broad = new Fbm(71, 3, 3);
  const fine = new Fbm(83, 24, 3);
  const fibre = new Lattice(192, 97);

  switch (style) {
    case "marble": {
      const tiles = 2;
      return {
        tile: 1.2,
        sample: (u, v) => {
          const tu = u * tiles;
          const tv = v * tiles;
          const ix = Math.floor(tu);
          const iy = Math.floor(tv);
          const fx = tu - ix;
          const fy = tv - iy;
          const grout = Math.min(fx, 1 - fx, fy, 1 - fy) < 0.006;
          const checker = (ix + iy) % 2 === 0 ? 1 : 0.955;
          const warp = broad.at(u, v) * 2.6;
          const vein = Math.pow(1 - Math.abs(Math.sin((u * 2 + v * 1.4 + warp + hash2(ix, iy, 2)) * Math.PI * 2)), 16);
          const c = mixRgb(scaleRgb(base, checker * (0.97 + fine.at(u, v) * 0.05)), [130, 128, 134], Math.min(0.5, vein * 0.5));
          return grout ? { c: scaleRgb(base, 0.62), h: 0.1, r: 1 } : { c, h: 0.5, r: 0.55 + vein * 0.2 };
        },
      };
    }
    case "concrete":
      return {
        tile: 1.6,
        sample: (u, v) => {
          const b = broad.at(u, v);
          const f = fine.at(u, v);
          const joint = Math.min(Math.abs(((u * 2) % 1) - 0.5), Math.abs(((v * 2) % 1) - 0.5)) > 0.4975 ? 0.78 : 1;
          return { c: scaleRgb(base, (0.88 + b * 0.2 + (f - 0.5) * 0.08) * joint), h: 0.5 + (f - 0.5) * 0.4, r: 0.75 + b * 0.25 };
        },
      };
    case "carpet":
      return {
        tile: 1,
        sample: (u, v) => {
          const f = fibre.at(u, v);
          const g = fibre.at(u * 2.3 + 0.1, v * 2.3 + 0.4);
          const b = broad.at(u, v);
          const k = 0.88 + (f * 0.5 + g * 0.5 - 0.5) * 0.28 + b * 0.1;
          return { c: scaleRgb(base, k), h: 0.4 + f * 0.6, r: 1 };
        },
      };
    case "dark_wood": {
      const rows = 6;
      const cols = 2;
      return {
        tile: 1.2,
        sample: (u, v) => {
          const row = Math.floor(v * rows);
          const shift = (hash2(row, 4, 8) * 0.9 + row * 0.37) % 1;
          const bu = u * cols + shift;
          const col = Math.floor(bu);
          const fu = bu - col;
          const fv = v * rows - row;
          const gap = fv < 0.02 || fv > 0.98 || fu < 0.006;
          const tone = 0.78 + 0.4 * hash2(col, row, 7);
          const ring = Math.sin((fv * 5 + broad.at(u * 0.4, v * 3) * 8 + hash2(col, row, 12) * 10) * Math.PI) * 0.5 + 0.5;
          const streak = fine.at(u * 0.12 + col * 0.1, v * 0.5);
          const k = tone * (0.82 + ring * 0.12 + streak * 0.2);
          return gap ? { c: scaleRgb(base, 0.4), h: 0.05, r: 1 } : { c: scaleRgb(base, k), h: 0.5 + ring * 0.25, r: 0.65 + streak * 0.25 };
        },
      };
    }
    default: {
      // parquet: staggered planks of light wood
      const rows = 12;
      const cols = 2;
      return {
        tile: 1.08,
        sample: (u, v) => {
          const row = Math.floor(v * rows);
          const shift = row % 2 === 0 ? 0 : 0.5;
          const bu = u * cols + shift;
          const col = Math.floor(bu);
          const fu = bu - col;
          const fv = v * rows - row;
          const gap = fv < 0.03 || fv > 0.97 || fu < 0.008 || fu > 0.992;
          const tone = 0.84 + 0.3 * hash2(col, row, 15);
          const ring = Math.sin((fv * 3 + broad.at(u * 0.6, v * 4) * 6 + hash2(col, row, 4) * 8) * Math.PI) * 0.5 + 0.5;
          const streak = fine.at(u * 0.08 + col * 0.2, v * 0.6);
          const k = tone * (0.9 + ring * 0.08 + streak * 0.16);
          return gap
            ? { c: scaleRgb(base, 0.55), h: 0.05, r: 1 }
            : { c: scaleRgb(mixRgb(base, [150, 100, 60], ring * 0.25), k), h: 0.5 + ring * 0.2, r: 0.7 + streak * 0.25 };
        },
      };
    }
  }
}

export function makeFloorMaps(style: FloorStyle, baseHex: string, size: number, anisotropy: number, colorOnly = false): SurfaceMaps {
  const base = hexToRgb(baseHex);
  const { tile, sample } = floorSampler(style, base);
  return toTextures(paint(size, sample, colorOnly), tile, anisotropy);
}

// ---- decorations ---------------------------------------------------------

/** Plush carpet pile in a given color (used for runners and rugs). */
export function makePileMaps(colorHex: string, size: number, anisotropy: number, colorOnly = false): SurfaceMaps {
  return makeFloorMaps("carpet", colorHex, size, anisotropy, colorOnly);
}

/** A rug face with a border and medallion; `persian` is ornate, otherwise geometric. */
export function makeRugTexture(baseHex: string, persian: boolean, anisotropy: number): Texture {
  const w = 512;
  const h = 320;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const base = hexToRgb(baseHex);
  const css = (c: Rgb) => `rgb(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])})`;
  const cream = css([232, 220, 190]);
  const dark = css(scaleRgb(base, 0.55));
  const mid = css(base);
  const light = css(mixRgb(base, [255, 255, 255], 0.28));
  ctx.fillStyle = dark;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = cream;
  ctx.lineWidth = 6;
  ctx.strokeRect(10, 10, w - 20, h - 20);
  ctx.strokeStyle = light;
  ctx.lineWidth = 3;
  ctx.strokeRect(26, 26, w - 52, h - 52);
  ctx.fillStyle = mid;
  ctx.fillRect(36, 36, w - 72, h - 72);
  if (persian) {
    ctx.save();
    ctx.translate(w / 2, h / 2);
    for (let ring = 0; ring < 3; ring += 1) {
      ctx.beginPath();
      ctx.ellipse(0, 0, 150 - ring * 40, 92 - ring * 24, 0, 0, Math.PI * 2);
      ctx.fillStyle = ring % 2 === 0 ? dark : light;
      ctx.fill();
      ctx.strokeStyle = cream;
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    for (let i = 0; i < 12; i += 1) {
      ctx.rotate((Math.PI * 2) / 12);
      ctx.beginPath();
      ctx.moveTo(0, -20);
      ctx.quadraticCurveTo(14, -40, 0, -56);
      ctx.quadraticCurveTo(-14, -40, 0, -20);
      ctx.fillStyle = cream;
      ctx.fill();
    }
    ctx.restore();
    ctx.fillStyle = cream;
    for (let x = 52; x < w - 40; x += 28) {
      ctx.fillRect(x, 44, 12, 5);
      ctx.fillRect(x, h - 49, 12, 5);
    }
  } else {
    ctx.strokeStyle = cream;
    ctx.lineWidth = 4;
    for (let i = 0; i < 5; i += 1) {
      const inset = 56 + i * 22;
      ctx.strokeRect(inset, inset * 0.62 + 12, w - inset * 2, h - (inset * 0.62 + 12) * 2);
    }
    ctx.fillStyle = light;
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-34, -34, 68, 68);
    ctx.restore();
  }
  // fibre noise
  const img = ctx.getImageData(0, 0, w, h);
  const rand = mulberry32(5);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (rand() - 0.5) * 26;
    img.data[i] += n;
    img.data[i + 1] += n;
    img.data[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = anisotropy;
  return texture;
}

export function disposeMaps(maps: SurfaceMaps | undefined) {
  if (!maps) return;
  maps.color.dispose();
  maps.bump.dispose();
  maps.rough.dispose();
}
