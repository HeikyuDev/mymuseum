import { WALL_BASE } from "@/lib/scene-palette";
import type { WallStyle } from "@/types/database";
import { darken, lighten, mixHex } from "../color";
import { blotchTile, fillTexture, mulberry32, speckleTile, type Ctx } from "./util";

/** Paints a procedural wall into (0, 0, w, h). Deterministic for a given style. */
export function drawWall(ctx: Ctx, style: WallStyle, color: string | null, w: number, h: number) {
  const base = style === "custom_color" && color ? color : WALL_BASE[style];
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);
  const rand = mulberry32(style.length * 7919 + 13);

  switch (style) {
    case "brick": {
      const bw = 128;
      const bh = 44;
      const mortar = "#b3a898";
      ctx.fillStyle = mortar;
      ctx.fillRect(0, 0, w, h);
      for (let row = 0, y = 0; y < h + bh; row += 1, y += bh) {
        const offset = row % 2 ? -bw / 2 : 0;
        for (let x = offset; x < w; x += bw) {
          const shade = rand();
          const brick = mixHex("#8f4333", shade > 0.5 ? "#b05a44" : "#6e3226", Math.abs(shade - 0.5) * 0.9);
          ctx.fillStyle = brick;
          ctx.fillRect(x + 2, y + 2, bw - 4, bh - 4);
          ctx.fillStyle = "rgba(255,255,255,0.08)";
          ctx.fillRect(x + 2, y + 2, bw - 4, 3);
          ctx.fillStyle = "rgba(0,0,0,0.18)";
          ctx.fillRect(x + 2, y + bh - 6, bw - 4, 4);
        }
      }
      fillTexture(ctx, speckleTile(5, 0.45, "dark"), 0, 0, w, h);
      fillTexture(ctx, blotchTile(21, 5, 0.22), 0, 0, w, h);
      break;
    }
    case "concrete": {
      fillTexture(ctx, blotchTile(9, 4, 0.16), 0, 0, w, h);
      fillTexture(ctx, blotchTile(10, 16, 0.12), 0, 0, w, h);
      fillTexture(ctx, speckleTile(3, 0.2, "mono"), 0, 0, w, h);
      // Formwork seams and tie holes.
      const panel = 360;
      ctx.strokeStyle = "rgba(0,0,0,0.16)";
      ctx.lineWidth = 2;
      for (let x = panel; x < w; x += panel) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = panel; y < h; y += panel) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
      ctx.fillStyle = "rgba(0,0,0,0.28)";
      for (let x = panel / 2; x < w; x += panel) {
        for (let y = panel / 2; y < h; y += panel) {
          ctx.beginPath();
          ctx.arc(x, y, 4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      break;
    }
    case "wood_panel": {
      const pw = 120;
      for (let x = 0, i = 0; x < w; x += pw, i += 1) {
        const tone = mixHex("#8a5a36", rand() > 0.5 ? "#a46c40" : "#6c4527", rand() * 0.55);
        const grad = ctx.createLinearGradient(x, 0, x + pw, 0);
        grad.addColorStop(0, darken(tone, 0.12));
        grad.addColorStop(0.5, tone);
        grad.addColorStop(1, darken(tone, 0.12));
        ctx.fillStyle = grad;
        ctx.fillRect(x, 0, pw, h);
        ctx.lineWidth = 1.2;
        for (let g = 0; g < 26; g += 1) {
          const gx = x + 6 + rand() * (pw - 12);
          ctx.strokeStyle = `rgba(40,20,5,${0.05 + rand() * 0.14})`;
          ctx.beginPath();
          ctx.moveTo(gx, 0);
          ctx.bezierCurveTo(gx + (rand() - 0.5) * 16, h * 0.3, gx + (rand() - 0.5) * 16, h * 0.7, gx + (rand() - 0.5) * 8, h);
          ctx.stroke();
        }
        // Knots
        if (i % 3 === 0) {
          const ky = h * (0.15 + rand() * 0.7);
          const kx = x + pw * (0.3 + rand() * 0.4);
          ctx.strokeStyle = "rgba(40,20,5,0.22)";
          for (let r = 4; r < 16; r += 4) {
            ctx.beginPath();
            ctx.ellipse(kx, ky, r * 0.6, r * 1.5, 0, 0, Math.PI * 2);
            ctx.stroke();
          }
        }
        ctx.fillStyle = "rgba(0,0,0,0.55)";
        ctx.fillRect(x, 0, 2.5, h);
        ctx.fillStyle = "rgba(255,255,255,0.07)";
        ctx.fillRect(x + 2.5, 0, 2, h);
      }
      break;
    }
    case "marble": {
      fillTexture(ctx, blotchTile(31, 3, 0.09), 0, 0, w, h);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      for (let v = 0; v < 9; v += 1) {
        const vertical = rand() > 0.35;
        let x = vertical ? rand() * w : -20;
        let y = vertical ? -20 : rand() * h;
        const points: [number, number][] = [[x, y]];
        for (let s = 0; s < 40; s += 1) {
          x += vertical ? (rand() - 0.5) * 70 : 40 + rand() * 30;
          y += vertical ? 40 + rand() * 30 : (rand() - 0.5) * 70;
          points.push([x, y]);
        }
        const stroke = (width: number, alpha: number) => {
          ctx.lineWidth = width;
          ctx.strokeStyle = `rgba(78,82,92,${alpha})`;
          ctx.beginPath();
          points.forEach(([px, py], i) => (i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)));
          ctx.stroke();
        };
        stroke(9, 0.035);
        stroke(3.2, 0.1 + rand() * 0.08);
        stroke(1.1, 0.28 + rand() * 0.2);
      }
      fillTexture(ctx, speckleTile(4, 0.05, "mono"), 0, 0, w, h);
      break;
    }
    case "velvet": {
      for (let x = 0; x < w; x += 54) {
        const grad = ctx.createLinearGradient(x, 0, x + 54, 0);
        grad.addColorStop(0, "rgba(0,0,0,0.38)");
        grad.addColorStop(0.45, "rgba(255,255,255,0.1)");
        grad.addColorStop(1, "rgba(0,0,0,0.38)");
        ctx.fillStyle = grad;
        ctx.fillRect(x, 0, 54, h);
      }
      fillTexture(ctx, speckleTile(6, 0.32, "mono"), 0, 0, w, h);
      break;
    }
    case "linen": {
      ctx.strokeStyle = "rgba(60,45,20,0.09)";
      ctx.lineWidth = 1;
      for (let y = 0; y < h; y += 4) {
        ctx.beginPath();
        ctx.moveTo(0, y + 0.5);
        ctx.lineTo(w, y + 0.5);
        ctx.stroke();
      }
      for (let x = 0; x < w; x += 4) {
        ctx.beginPath();
        ctx.moveTo(x + 0.5, 0);
        ctx.lineTo(x + 0.5, h);
        ctx.stroke();
      }
      fillTexture(ctx, blotchTile(41, 8, 0.1), 0, 0, w, h);
      fillTexture(ctx, speckleTile(8, 0.12, "mono"), 0, 0, w, h);
      break;
    }
    case "custom_color":
    case "plaster":
    default: {
      fillTexture(ctx, blotchTile(51, 3, 0.1), 0, 0, w, h);
      fillTexture(ctx, blotchTile(52, 10, 0.06), 0, 0, w, h);
      fillTexture(ctx, speckleTile(2, 0.1, "mono"), 0, 0, w, h);
      break;
    }
  }

  // Soft shade under the ceiling line, like the viewer.
  const ceiling = ctx.createLinearGradient(0, 0, 0, h * 0.22);
  ceiling.addColorStop(0, "rgba(0,0,0,0.22)");
  ceiling.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = ceiling;
  ctx.fillRect(0, 0, w, h * 0.22);
}

/** Dims and tints the wall (applied before the artwork is hung). */
export function adjustWall(ctx: Ctx, w: number, h: number, dim: number, tint: { color: string; alpha: number } | null) {
  if (tint) {
    ctx.save();
    ctx.globalCompositeOperation = "multiply";
    ctx.globalAlpha = tint.alpha;
    ctx.fillStyle = lighten(tint.color, 0.15);
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }
  if (dim > 0) {
    ctx.fillStyle = `rgba(0,0,0,${dim})`;
    ctx.fillRect(0, 0, w, h);
  }
}
