// Photographic finishing applied on top of the real render. Nothing here invents
// scenery: it only mimics what a lens and film do (vignette, grain) and signs the shot.

export type FinishOptions = {
  vignette: boolean;
  grain: boolean;
  watermark: string | null;
  fontFamily: string;
  /** Lowest y (px) the watermark may use: the bottom edge of the safe area. */
  watermarkBottom: number;
};

function averageLuminance(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): number {
  try {
    const { data } = ctx.getImageData(Math.max(0, Math.floor(x)), Math.max(0, Math.floor(y)), Math.max(1, Math.floor(w)), Math.max(1, Math.floor(h)));
    let total = 0;
    for (let i = 0; i < data.length; i += 4) total += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
    return total / (data.length / 4);
  } catch {
    return 128;
  }
}

function drawVignette(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const radius = Math.hypot(w, h) / 2;
  const gradient = ctx.createRadialGradient(w / 2, h / 2, radius * 0.45, w / 2, h / 2, radius);
  gradient.addColorStop(0, "rgba(0,0,0,0)");
  gradient.addColorStop(1, "rgba(18,12,6,0.34)");
  ctx.save();
  ctx.globalCompositeOperation = "multiply";
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

function drawGrain(ctx: CanvasRenderingContext2D, w: number, h: number, scale: number) {
  const tile = document.createElement("canvas");
  tile.width = 192;
  tile.height = 192;
  const tctx = tile.getContext("2d");
  if (!tctx) return;
  const image = tctx.createImageData(tile.width, tile.height);
  let seed = 1337;
  for (let i = 0; i < image.data.length; i += 4) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const v = 118 + ((seed >>> 24) / 255) * 20;
    image.data[i] = image.data[i + 1] = image.data[i + 2] = v;
    image.data[i + 3] = 255;
  }
  tctx.putImageData(image, 0, 0);
  const pattern = ctx.createPattern(tile, "repeat");
  if (!pattern) return;
  ctx.save();
  ctx.globalCompositeOperation = "overlay";
  ctx.globalAlpha = 0.16;
  ctx.scale(Math.max(1, scale), Math.max(1, scale));
  ctx.fillStyle = pattern;
  ctx.fillRect(0, 0, w / Math.max(1, scale), h / Math.max(1, scale));
  ctx.restore();
}

function drawWatermark(ctx: CanvasRenderingContext2D, w: number, text: string, family: string, bottom: number, scale: number) {
  const size = 22 * scale;
  const y = bottom - 28 * scale;
  ctx.save();
  ctx.font = `500 ${size}px ${family}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  const spaced = text.toUpperCase().split("").join(String.fromCharCode(8202, 8202));
  const light = averageLuminance(ctx, w * 0.2, y - size * 1.4, w * 0.6, size * 2) < 135;
  ctx.shadowColor = light ? "rgba(0,0,0,0.45)" : "rgba(255,255,255,0.5)";
  ctx.shadowBlur = 6 * scale;
  ctx.fillStyle = light ? "rgba(255,255,255,0.88)" : "rgba(30,26,22,0.82)";
  ctx.fillText(spaced, w / 2, y);
  ctx.restore();
}

/** Applies the finishing touches in place on a 2D canvas that already holds the render. */
export function finishPhoto(canvas: HTMLCanvasElement, options: FinishOptions, scale: number) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const { width: w, height: h } = canvas;
  if (options.vignette) drawVignette(ctx, w, h);
  if (options.grain) drawGrain(ctx, w, h, scale);
  if (options.watermark) drawWatermark(ctx, w, options.watermark, options.fontFamily, options.watermarkBottom, scale);
}
