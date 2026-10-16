import { FLOOR_BASE } from "@/lib/scene-palette";
import type { DecorId } from "@/lib/hall-style";
import type { FloorDecoration, FloorStyle } from "@/types/database";
import { darken, lighten } from "../color";
import { blotchTile, fillTexture, mulberry32, polygon, speckleTile, withShadow, type Ctx } from "./util";

// A low-angle view of the floor: a perspective strip below the wall. World
// depth is uniform in z; the screen y of depth z is hy + (H - hy) / z.

const Z_FAR = 3.2;

type Persp = { vx: number; hy: number; floorY: number; w: number; h: number };

const yAt = (p: Persp, z: number) => p.hy + (p.h - p.hy) / z;
/** Screen x of a point whose x on the bottom edge is `xb`, at depth z. */
const xAt = (p: Persp, xb: number, z: number) => p.vx + (xb - p.vx) / z;

function makePersp(w: number, h: number, floorY: number): Persp {
  const fh = h - floorY;
  return { vx: w / 2, hy: floorY - fh / 2.2, floorY, w, h };
}

type FloorOptions = {
  style: FloorStyle;
  decoration: FloorDecoration;
  decorationColor: string;
  decor: readonly DecorId[];
};

export function drawFloor(ctx: Ctx, scale: number, w: number, h: number, floorY: number, options: FloorOptions) {
  const p = makePersp(w, h, floorY);
  const fh = h - floorY;
  const rand = mulberry32(options.style.length * 131 + 7);

  // Baseboard on the wall, above the floor line.
  const bb = Math.round(h * 0.02);
  const board = ctx.createLinearGradient(0, floorY - bb, 0, floorY);
  board.addColorStop(0, "#f4f1ea");
  board.addColorStop(1, "#d6d1c6");
  ctx.fillStyle = board;
  ctx.fillRect(0, floorY - bb, w, bb);
  ctx.fillStyle = "rgba(0,0,0,0.22)";
  ctx.fillRect(0, floorY - bb - 2, w, 2);

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, floorY, w, fh);
  ctx.clip();

  const base = FLOOR_BASE[options.style];
  ctx.fillStyle = base;
  ctx.fillRect(0, floorY, w, fh);

  // Tiles / boards in perspective.
  const config = {
    parquet: { cols: 12, rows: 13, stagger: true, spread: 0.14, joint: "rgba(80,52,26,0.4)" },
    dark_wood: { cols: 9, rows: 11, stagger: true, spread: 0.18, joint: "rgba(0,0,0,0.55)" },
    marble: { cols: 5, rows: 6, stagger: false, spread: 0.06, joint: "rgba(90,90,96,0.35)" },
    concrete: { cols: 4, rows: 5, stagger: false, spread: 0.07, joint: "rgba(0,0,0,0.28)" },
    carpet: { cols: 0, rows: 0, stagger: false, spread: 0, joint: "transparent" },
  }[options.style];

  if (config.cols > 0) {
    const colW = w / config.cols;
    const dz = (Z_FAR - 1) / config.rows;
    for (let r = 0; r < config.rows; r += 1) {
      const za = Z_FAR - r * dz;
      const zb = za - dz;
      const shift = config.stagger && r % 2 ? colW / 2 : 0;
      for (let c = -1; c <= config.cols; c += 1) {
        const x0 = c * colW + shift;
        const x1 = x0 + colW;
        const tone = options.style === "marble" ? ((c + r) % 2 ? lighten(base, 0.12) : darken(base, 0.04)) : base;
        const jitter = (rand() - 0.5) * 2 * config.spread;
        polygon(ctx, [
          [xAt(p, x0, za), yAt(p, za)],
          [xAt(p, x1, za), yAt(p, za)],
          [xAt(p, x1, zb), yAt(p, zb)],
          [xAt(p, x0, zb), yAt(p, zb)],
        ]);
        ctx.fillStyle = jitter >= 0 ? lighten(tone, jitter) : darken(tone, -jitter);
        ctx.fill();
        ctx.strokeStyle = config.joint;
        ctx.lineWidth = 1.4;
        ctx.stroke();
      }
    }
  }
  if (options.style === "carpet") fillTexture(ctx, speckleTile(14, 0.55, "dark"), 0, floorY, w, fh);
  else if (options.style === "concrete") fillTexture(ctx, blotchTile(15, 6, 0.18), 0, floorY, w, fh);
  else fillTexture(ctx, speckleTile(16, 0.14, "mono"), 0, floorY, w, fh);

  drawDecoration(ctx, scale, p, options.decoration, options.decorationColor);

  // Depth shading: dark at the wall junction, lit toward the viewer, soft sheen in the middle.
  const shade = ctx.createLinearGradient(0, floorY, 0, h);
  shade.addColorStop(0, "rgba(0,0,0,0.5)");
  shade.addColorStop(0.5, "rgba(0,0,0,0.08)");
  shade.addColorStop(1, "rgba(255,255,255,0.05)");
  ctx.fillStyle = shade;
  ctx.fillRect(0, floorY, w, fh);
  if (options.style === "marble" || options.style === "parquet" || options.style === "dark_wood") {
    const sheen = ctx.createRadialGradient(w / 2, floorY + fh * 0.2, 10, w / 2, floorY + fh * 0.2, w * 0.7);
    sheen.addColorStop(0, "rgba(255,255,255,0.14)");
    sheen.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = sheen;
    ctx.fillRect(0, floorY, w, fh);
  }
  ctx.restore();

  drawProps(ctx, w, h, floorY, options.decor);
}

function drawDecoration(ctx: Ctx, scale: number, p: Persp, kind: FloorDecoration, color: string) {
  if (kind === "none") return;
  const { w, h, floorY } = p;
  const fh = h - floorY;

  if (kind === "red_carpet" || kind === "runner_gold_trim") {
    const half = w * 0.2;
    const quad = (k: number): [number, number][] => [
      [xAt(p, p.vx - half * k, Z_FAR), yAt(p, Z_FAR)],
      [xAt(p, p.vx + half * k, Z_FAR), yAt(p, Z_FAR)],
      [p.vx + half * k, h + 4],
      [p.vx - half * k, h + 4],
    ];
    withShadow(ctx, scale, { color: "rgba(0,0,0,0.45)", blur: 24, x: 0, y: 6 }, () => {
      polygon(ctx, quad(1));
      ctx.fillStyle = color;
      ctx.fill();
    });
    const grad = ctx.createLinearGradient(p.vx - half, 0, p.vx + half, 0);
    grad.addColorStop(0, "rgba(0,0,0,0.28)");
    grad.addColorStop(0.18, "rgba(0,0,0,0)");
    grad.addColorStop(0.82, "rgba(0,0,0,0)");
    grad.addColorStop(1, "rgba(0,0,0,0.28)");
    polygon(ctx, quad(1));
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.save();
    polygon(ctx, quad(1));
    ctx.clip();
    fillTexture(ctx, speckleTile(17, 0.5, "dark"), p.vx - half, floorY, half * 2, fh);
    ctx.restore();
    ctx.strokeStyle = "#d4af37";
    ctx.lineWidth = Math.max(3, fh * 0.018);
    polygon(ctx, quad(0.94));
    ctx.stroke();
    if (kind === "runner_gold_trim") {
      ctx.lineWidth = 2;
      polygon(ctx, quad(0.84));
      ctx.stroke();
    }
    return;
  }

  if (kind === "rug_persian" || kind === "rug_geometric") {
    const half = w * 0.3;
    const za = 2.7;
    const zb = 1.35;
    const rug = (k: number): [number, number][] => [
      [xAt(p, p.vx - half * k, za), yAt(p, za)],
      [xAt(p, p.vx + half * k, za), yAt(p, za)],
      [xAt(p, p.vx + half * k, zb), yAt(p, zb)],
      [xAt(p, p.vx - half * k, zb), yAt(p, zb)],
    ];
    withShadow(ctx, scale, { color: "rgba(0,0,0,0.4)", blur: 18, x: 0, y: 5 }, () => {
      polygon(ctx, rug(1));
      ctx.fillStyle = "#e8d9b0";
      ctx.fill();
    });
    polygon(ctx, rug(0.93));
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = kind === "rug_persian" ? "#e8d9b0" : "rgba(255,255,255,0.35)";
    ctx.lineWidth = 2;
    for (const k of [0.8, 0.62, 0.4]) {
      polygon(ctx, rug(k));
      ctx.stroke();
    }
    ctx.save();
    polygon(ctx, rug(0.93));
    ctx.clip();
    fillTexture(ctx, speckleTile(18, 0.35, "dark"), 0, floorY, w, fh);
    ctx.restore();
    return;
  }

  // spotlight_pool
  ctx.save();
  const cy = yAt(p, 1.7);
  ctx.translate(p.vx, cy);
  ctx.scale(1, 0.28);
  const pool = ctx.createRadialGradient(0, 0, 0, 0, 0, w * 0.42);
  pool.addColorStop(0, color);
  pool.addColorStop(0.35, "rgba(255,246,220,0.55)");
  pool.addColorStop(1, "rgba(255,246,220,0)");
  ctx.fillStyle = pool;
  ctx.beginPath();
  ctx.arc(0, 0, w * 0.42, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawProps(ctx: Ctx, w: number, h: number, floorY: number, decor: readonly DecorId[]) {
  const fh = h - floorY;

  if (decor.includes("plants")) {
    const k = (fh * 0.9) / 150;
    const x = w * 0.09 - 45 * k;
    const y = floorY + fh * 0.04;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(k, k);
    ctx.fillStyle = "rgba(0,0,0,.28)";
    ctx.beginPath();
    ctx.ellipse(45, 146, 30, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    const leaf = (d: string, fill: string) => {
      ctx.fillStyle = fill;
      ctx.fill(new Path2D(d));
    };
    leaf("M45 90 C20 70 18 35 40 8 C50 38 62 60 45 90Z", "#3f6b45");
    leaf("M45 92 C70 74 78 44 58 18 C46 44 36 66 45 92Z", "#4f8656");
    leaf("M44 94 C28 84 8 78 4 56 C26 56 40 70 44 94Z", "#335a3a");
    leaf("M46 94 C62 84 82 80 86 60 C64 58 50 72 46 94Z", "#3f6b45");
    leaf("M26 100 H64 L58 144 H32 Z", "#d8d2c6");
    leaf("M26 100 H64 L63 108 H27 Z", "#bdb6a8");
    ctx.restore();
  }

  if (decor.includes("benches")) {
    const k = (fh * 0.42) / 56;
    const x = w * 0.78 - 75 * k;
    const y = floorY + fh * 0.2;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(k, k);
    ctx.fillStyle = "rgba(0,0,0,.35)";
    ctx.beginPath();
    ctx.ellipse(75, 58, 72, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#1a1917";
    ctx.fillRect(14, 22, 6, 34);
    ctx.fillRect(130, 22, 6, 34);
    const seat = ctx.createLinearGradient(0, 0, 0, 22);
    seat.addColorStop(0, "#3a3835");
    seat.addColorStop(1, "#23221f");
    ctx.fillStyle = seat;
    ctx.beginPath();
    ctx.roundRect(0, 0, 150, 22, 6);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.18)";
    ctx.fillRect(4, 1, 142, 2);
    ctx.restore();
  }

  if (decor.includes("rope_barriers")) {
    const k = (fh * 0.5) / 82;
    const width = 210 * k;
    const x = w * 0.5 - width / 2;
    const y = floorY + fh * 0.38;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(k, k);
    for (const px of [0, 201]) {
      const post = ctx.createLinearGradient(px, 0, px + 9, 0);
      post.addColorStop(0, "#8a6d2b");
      post.addColorStop(0.45, "#e5c76b");
      post.addColorStop(1, "#8a6d2b");
      ctx.fillStyle = post;
      ctx.beginPath();
      ctx.roundRect(px, 4, 9, 74, 4);
      ctx.fill();
      ctx.fillStyle = "#8a6d2b";
      ctx.beginPath();
      ctx.ellipse(px + 4.5, 78, 9, 4, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.lineCap = "round";
    ctx.strokeStyle = "rgba(0,0,0,.28)";
    ctx.lineWidth = 9;
    ctx.stroke(new Path2D("M6 18 Q105 70 204 18"));
    ctx.strokeStyle = "#a3122b";
    ctx.stroke(new Path2D("M6 12 Q105 62 204 12"));
    ctx.restore();
  }
}
