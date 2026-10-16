export type Ctx = CanvasRenderingContext2D;

export function createCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return canvas;
}

/** Small deterministic PRNG so every render of the same plan is identical. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const tileCache = new Map<string, HTMLCanvasElement>();

function cached(key: string, size: number, paint: (data: ImageData) => void): HTMLCanvasElement {
  const hit = tileCache.get(key);
  if (hit) return hit;
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const data = ctx.createImageData(size, size);
    paint(data);
    ctx.putImageData(data, 0, 0);
  }
  tileCache.set(key, canvas);
  return canvas;
}

/** Per-pixel random speckle. mode "dark" is black only, "mono" is black and white. */
export function speckleTile(seed: number, amp: number, mode: "dark" | "mono", size = 256): HTMLCanvasElement {
  return cached(`speckle:${seed}:${amp}:${mode}:${size}`, size, (img) => {
    const rand = mulberry32(seed);
    for (let i = 0; i < size * size; i += 1) {
      const v = rand();
      const light = mode === "mono" && v > 0.5;
      const c = light ? 255 : 0;
      img.data[i * 4] = c;
      img.data[i * 4 + 1] = c;
      img.data[i * 4 + 2] = c;
      img.data[i * 4 + 3] = Math.round((mode === "mono" ? Math.abs(v - 0.5) * 2 : v) * amp * 255);
    }
  });
}

const smooth = (t: number) => t * t * (3 - 2 * t);

/** Seamless low-frequency blotches: white where the field is high, black where low. */
export function blotchTile(seed: number, cells: number, amp: number, size = 256): HTMLCanvasElement {
  return cached(`blotch:${seed}:${cells}:${amp}:${size}`, size, (img) => {
    const rand = mulberry32(seed);
    const grid = Array.from({ length: cells * cells }, () => rand());
    const at = (x: number, y: number) => grid[(y % cells) * cells + (x % cells)];
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const fx = (x / size) * cells;
        const fy = (y / size) * cells;
        const x0 = Math.floor(fx);
        const y0 = Math.floor(fy);
        const tx = smooth(fx - x0);
        const ty = smooth(fy - y0);
        const top = at(x0, y0) * (1 - tx) + at(x0 + 1, y0) * tx;
        const bottom = at(x0, y0 + 1) * (1 - tx) + at(x0 + 1, y0 + 1) * tx;
        const v = top * (1 - ty) + bottom * ty;
        const c = v > 0.5 ? 255 : 0;
        const i = (y * size + x) * 4;
        img.data[i] = c;
        img.data[i + 1] = c;
        img.data[i + 2] = c;
        img.data[i + 3] = Math.round(Math.abs(v - 0.5) * 2 * amp * 255);
      }
    }
  });
}

/** Fills a rect with a tiled texture. */
export function fillTexture(ctx: Ctx, tile: HTMLCanvasElement, x: number, y: number, w: number, h: number) {
  const pattern = ctx.createPattern(tile, "repeat");
  if (!pattern) return;
  ctx.save();
  ctx.fillStyle = pattern;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
}

export function polygon(ctx: Ctx, points: readonly (readonly [number, number])[]) {
  ctx.beginPath();
  points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  ctx.closePath();
}

/** Runs `paint` with a canvas shadow. Blur and offsets are in canvas pixels, so they follow `scale`. */
export function withShadow(ctx: Ctx, scale: number, shadow: { color: string; blur: number; x: number; y: number }, paint: () => void) {
  ctx.save();
  ctx.shadowColor = shadow.color;
  ctx.shadowBlur = shadow.blur * scale;
  ctx.shadowOffsetX = shadow.x * scale;
  ctx.shadowOffsetY = shadow.y * scale;
  paint();
  ctx.restore();
}

export const yieldToMain = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));
