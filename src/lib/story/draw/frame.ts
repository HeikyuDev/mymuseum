import type { FrameStyle } from "@/types/database";
import { darken, lighten } from "../color";
import type { FrameGeometry } from "../layout";
import type { Rect } from "../formats";
import { mulberry32, polygon, withShadow, type Ctx } from "./util";

export type PhotoSource = { image: CanvasImageSource; width: number; height: number };

type FrameInput = {
  ctx: Ctx;
  scale: number;
  rect: Rect; // outer rect (frame + mat + photo)
  geometry: FrameGeometry;
  style: FrameStyle;
  color: string;
  matColor: string | null;
  photo: PhotoSource;
};

/** Light comes from the upper left: lit sides are top/left, shaded sides bottom/right. */
function bevel(ctx: Ctx, outer: Rect, inner: Rect, lit: string, mid: string, shade: string) {
  const { x, y, w, h } = outer;
  const o = [x, y, x + w, y + h];
  const i = [inner.x, inner.y, inner.x + inner.w, inner.y + inner.h];
  const sides: [string, [number, number][]][] = [
    [lit, [[o[0], o[1]], [o[2], o[1]], [i[2], i[1]], [i[0], i[1]]]],
    [mid, [[o[0], o[1]], [i[0], i[1]], [i[0], i[3]], [o[0], o[3]]]],
    [shade, [[o[2], o[1]], [o[2], o[3]], [i[2], i[3]], [i[2], i[1]]]],
    [shade, [[o[0], o[3]], [i[0], i[3]], [i[2], i[3]], [o[2], o[3]]]],
  ];
  for (const [fill, pts] of sides) {
    polygon(ctx, pts);
    ctx.fillStyle = fill;
    ctx.fill();
  }
}

function metalGradient(ctx: Ctx, rect: Rect, color: string) {
  const g = ctx.createLinearGradient(rect.x, rect.y, rect.x + rect.w, rect.y + rect.h);
  g.addColorStop(0, lighten(color, 0.55));
  g.addColorStop(0.24, color);
  g.addColorStop(0.48, darken(color, 0.38));
  g.addColorStop(0.74, lighten(color, 0.5));
  g.addColorStop(1, color);
  return g;
}

/** Draws the cast shadow, frame, mat and photo exactly as a hung print would look. */
export function drawFramedPhoto({ ctx, scale, rect, geometry, style, color, matColor, photo }: FrameInput) {
  const { pad, matPad, t } = geometry;
  const outer = rect;
  const matRect: Rect = { x: outer.x + pad, y: outer.y + pad, w: outer.w - 2 * pad, h: outer.h - 2 * pad };
  const imgRect: Rect = { x: matRect.x + matPad, y: matRect.y + matPad, w: geometry.imgW, h: geometry.imgH };
  const depth = style === "canvas_wrap" ? Math.max(6, t * 1.1) : Math.max(2, t * 0.55);
  const glass = style === "floating_glass";

  // 1. Cast shadow on the wall: wide ambient + tight contact shadow, offset away from the light.
  const bodyFill = glass ? "#d8d8d8" : color;
  withShadow(
    ctx,
    scale,
    glass
      ? { color: "rgba(0,0,0,0.34)", blur: 70, x: 20, y: 46 }
      : { color: "rgba(0,0,0,0.38)", blur: 58, x: 14, y: 30 },
    () => {
      ctx.fillStyle = bodyFill;
      ctx.fillRect(outer.x, outer.y, outer.w, outer.h);
    },
  );
  withShadow(ctx, scale, { color: "rgba(0,0,0,0.42)", blur: glass ? 14 : 9, x: glass ? 7 : 3, y: glass ? 14 : 6 }, () => {
    ctx.fillStyle = bodyFill;
    ctx.fillRect(outer.x, outer.y, outer.w, outer.h);
  });

  // 2. Thickness: visible right and bottom faces.
  if (!glass) {
    const side = darken(color, 0.55);
    polygon(ctx, [
      [outer.x + outer.w, outer.y],
      [outer.x + outer.w + depth, outer.y + depth],
      [outer.x + outer.w + depth, outer.y + outer.h + depth],
      [outer.x + outer.w, outer.y + outer.h],
    ]);
    ctx.fillStyle = side;
    ctx.fill();
    polygon(ctx, [
      [outer.x, outer.y + outer.h],
      [outer.x + depth, outer.y + outer.h + depth],
      [outer.x + outer.w + depth, outer.y + outer.h + depth],
      [outer.x + outer.w, outer.y + outer.h],
    ]);
    ctx.fillStyle = darken(side, 0.25);
    ctx.fill();
  }

  // 3. Frame face.
  if (pad > 0 && !glass) {
    const rand = mulberry32(99);
    switch (style) {
      case "gold":
      case "metallic":
      case "vintage_ornate": {
        ctx.fillStyle = metalGradient(ctx, outer, color);
        ctx.fillRect(outer.x, outer.y, outer.w, outer.h);
        bevel(ctx, outer, matRect, "rgba(255,255,255,0.32)", "rgba(255,255,255,0.1)", "rgba(0,0,0,0.3)");
        if (style === "vintage_ornate") {
          for (const k of [0.3, 0.62]) {
            const inset = pad * k;
            ctx.strokeStyle = "rgba(0,0,0,0.32)";
            ctx.lineWidth = Math.max(1, pad * 0.06);
            ctx.strokeRect(outer.x + inset, outer.y + inset, outer.w - 2 * inset, outer.h - 2 * inset);
            ctx.strokeStyle = "rgba(255,240,190,0.4)";
            ctx.strokeRect(outer.x + inset + 1.5, outer.y + inset + 1.5, outer.w - 2 * inset - 3, outer.h - 2 * inset - 3);
          }
        }
        break;
      }
      case "wood": {
        const g = ctx.createLinearGradient(outer.x, outer.y, outer.x + outer.w, outer.y + outer.h);
        g.addColorStop(0, lighten(color, 0.2));
        g.addColorStop(0.5, color);
        g.addColorStop(1, darken(color, 0.3));
        ctx.fillStyle = g;
        ctx.fillRect(outer.x, outer.y, outer.w, outer.h);
        ctx.save();
        ctx.beginPath();
        ctx.rect(outer.x, outer.y, outer.w, outer.h);
        ctx.rect(matRect.x, matRect.y, matRect.w, matRect.h);
        ctx.clip("evenodd");
        ctx.lineWidth = 1;
        for (let n = 0; n < Math.max(20, outer.w / 5); n += 1) {
          ctx.strokeStyle = `rgba(30,15,5,${0.05 + rand() * 0.12})`;
          const gx = outer.x + rand() * outer.w;
          ctx.beginPath();
          ctx.moveTo(gx, outer.y);
          ctx.lineTo(gx + (rand() - 0.5) * 6, outer.y + outer.h);
          ctx.stroke();
          const gy = outer.y + rand() * outer.h;
          ctx.beginPath();
          ctx.moveTo(outer.x, gy);
          ctx.lineTo(outer.x + outer.w, gy + (rand() - 0.5) * 6);
          ctx.stroke();
        }
        ctx.restore();
        bevel(ctx, outer, matRect, "rgba(255,255,255,0.2)", "rgba(255,255,255,0.06)", "rgba(0,0,0,0.26)");
        break;
      }
      case "black_gallery": {
        ctx.fillStyle = color;
        ctx.fillRect(outer.x, outer.y, outer.w, outer.h);
        bevel(ctx, outer, matRect, "rgba(255,255,255,0.16)", "rgba(255,255,255,0.06)", "rgba(255,255,255,0.02)");
        ctx.strokeStyle = "rgba(255,255,255,0.14)";
        ctx.lineWidth = 1;
        ctx.strokeRect(outer.x + 0.5, outer.y + 0.5, outer.w - 1, outer.h - 1);
        break;
      }
      case "minimal":
      default: {
        ctx.fillStyle = color;
        ctx.fillRect(outer.x, outer.y, outer.w, outer.h);
        bevel(ctx, outer, matRect, "rgba(255,255,255,0.25)", "rgba(255,255,255,0.08)", "rgba(0,0,0,0.18)");
        break;
      }
    }
    // Shadow the frame lip casts onto the mat/photo.
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.fillRect(matRect.x, matRect.y, matRect.w, Math.max(1.5, t * 0.35));
    ctx.fillRect(matRect.x, matRect.y, Math.max(1.5, t * 0.35), matRect.h);
  }

  // 4. Mat with a beveled window.
  if (matColor && matPad > 0) {
    ctx.fillStyle = matColor;
    ctx.fillRect(matRect.x, matRect.y, matRect.w, matRect.h);
    const grain = mulberry32(7);
    ctx.fillStyle = "rgba(0,0,0,0.018)";
    for (let n = 0; n < 160; n += 1) {
      ctx.fillRect(matRect.x + grain() * matRect.w, matRect.y + grain() * matRect.h, 2, 2);
    }
    const b = Math.max(2, matPad * 0.06);
    const core = lighten(matColor, 0.7);
    bevel(
      ctx,
      { x: imgRect.x - b, y: imgRect.y - b, w: imgRect.w + 2 * b, h: imgRect.h + 2 * b },
      imgRect,
      darken(core, 0.04),
      darken(core, 0.1),
      lighten(darken(matColor, 0.1), 0.2),
    );
    // Soft shadow of the mat's edge on the matboard itself is subtle; keep the opening crisp.
  } else if (!glass) {
    // No mat: fill behind the photo with the frame's own inner color.
    ctx.fillStyle = darken(color, 0.4);
    ctx.fillRect(imgRect.x, imgRect.y, imgRect.w, imgRect.h);
  }

  // 5. The photo, cover-fitted so any aspect ratio fills the window exactly.
  ctx.save();
  ctx.beginPath();
  ctx.rect(imgRect.x, imgRect.y, imgRect.w, imgRect.h);
  ctx.clip();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  const winRatio = imgRect.w / imgRect.h;
  const srcRatio = photo.width / photo.height;
  let sw = photo.width;
  let sh = photo.height;
  let sx = 0;
  let sy = 0;
  if (srcRatio > winRatio) {
    sw = photo.height * winRatio;
    sx = (photo.width - sw) / 2;
  } else {
    sh = photo.width / winRatio;
    sy = (photo.height - sh) / 2;
  }
  ctx.drawImage(photo.image, sx, sy, sw, sh, imgRect.x, imgRect.y, imgRect.w, imgRect.h);

  // Depth: the mat window shades the photo's top/left edges slightly.
  const edge = Math.max(6, Math.min(imgRect.w, imgRect.h) * 0.025);
  const top = ctx.createLinearGradient(0, imgRect.y, 0, imgRect.y + edge);
  top.addColorStop(0, "rgba(0,0,0,0.28)");
  top.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = top;
  ctx.fillRect(imgRect.x, imgRect.y, imgRect.w, edge);
  const left = ctx.createLinearGradient(imgRect.x, 0, imgRect.x + edge, 0);
  left.addColorStop(0, "rgba(0,0,0,0.22)");
  left.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = left;
  ctx.fillRect(imgRect.x, imgRect.y, edge, imgRect.h);

  // Faint glass reflection.
  const sheen = ctx.createLinearGradient(imgRect.x, imgRect.y, imgRect.x + imgRect.w * 0.7, imgRect.y + imgRect.h * 0.7);
  sheen.addColorStop(0, glass ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.07)");
  sheen.addColorStop(0.35, "rgba(255,255,255,0)");
  ctx.fillStyle = sheen;
  ctx.fillRect(imgRect.x, imgRect.y, imgRect.w, imgRect.h);
  ctx.restore();

  if (glass) {
    ctx.strokeStyle = "rgba(255,255,255,0.6)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(outer.x + 0.75, outer.y + 0.75, outer.w - 1.5, outer.h - 1.5);
  }
}
