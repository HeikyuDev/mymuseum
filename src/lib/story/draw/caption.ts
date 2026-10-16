import { rgba, hexToRgb, toneColor, type TextTone } from "../color";
import type { Rect } from "../formats";
import { detailTracking, type CaptionLayout, type CaptionRole, type CaptionStyleId, type MeasureFor } from "../layout";
import { trackedWidth, type Measure } from "../text";
import { withShadow, type Ctx } from "./util";

export type StoryFonts = { display: string; body: string; script: string };

const PAPER = "#f6f2ea";
const INK = "#1c1a17";

export function fontFor(role: CaptionRole, style: CaptionStyleId, size: number, fonts: StoryFonts): string {
  if (role === "title") return `600 ${size}px ${style === "handwritten" ? fonts.script : fonts.display}`;
  if (role === "detail") return `500 ${size}px ${fonts.body}`;
  return `400 ${size}px ${style === "handwritten" ? fonts.script : fonts.body}`;
}

/** Real text measurement bound to the canvas, in the same fonts the caption is drawn with. */
export function canvasMeasureFor(ctx: Ctx, style: CaptionStyleId, fonts: StoryFonts): MeasureFor {
  return (role, size): Measure =>
    (text) => {
      ctx.font = fontFor(role, style, size, fonts);
      return ctx.measureText(text).width;
    };
}

/** Draws text one character at a time with extra tracking. */
function drawTracked(ctx: Ctx, text: string, x: number, y: number, tracking: number, align: "left" | "center") {
  const measure = (s: string) => ctx.measureText(s).width;
  const total = trackedWidth(text, tracking, measure);
  let cursor = align === "center" ? x - total / 2 : x;
  ctx.textAlign = "left";
  for (const char of Array.from(text)) {
    ctx.fillText(char, cursor, y);
    cursor += measure(char) + tracking;
  }
}

export function drawCaption(input: {
  ctx: Ctx;
  scale: number;
  layout: CaptionLayout;
  style: CaptionStyleId;
  box: Rect;
  tone: TextTone;
  accent: string;
  fonts: StoryFonts;
}) {
  const { ctx, scale, layout, style, box, accent, fonts } = input;
  if (layout.blocks.length === 0) return;

  const plaque = style === "plaque";
  const tone: TextTone = plaque ? "dark" : input.tone;
  const color = plaque ? INK : toneColor(tone);
  const cx = box.x + box.w / 2;
  const left = cx - layout.width / 2;
  const top = box.y + layout.padding;
  const textX = plaque ? left + layout.padding : cx;

  if (plaque) {
    withShadow(ctx, scale, { color: "rgba(0,0,0,0.38)", blur: 22, x: 4, y: 10 }, () => {
      ctx.fillStyle = PAPER;
      ctx.fillRect(left, box.y, layout.width, layout.height);
    });
    ctx.strokeStyle = "rgba(0,0,0,0.14)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(left + 0.75, box.y + 0.75, layout.width - 1.5, layout.height - 1.5);
    ctx.strokeStyle = rgba(hexToRgb(accent), 0.7);
    ctx.lineWidth = 1;
    ctx.strokeRect(left + 8, box.y + 8, layout.width - 16, layout.height - 16);
  }

  ctx.save();
  ctx.textBaseline = "alphabetic";
  if (!plaque) {
    ctx.shadowColor = tone === "light" ? "rgba(0,0,0,0.35)" : "rgba(255,255,255,0.3)";
    ctx.shadowBlur = 8 * scale;
    ctx.shadowOffsetY = 1 * scale;
  }

  for (const block of layout.blocks) {
    const y0 = top + block.y;
    if (block.role === "rule") {
      ctx.save();
      ctx.shadowColor = "transparent";
      ctx.fillStyle = plaque ? accent : rgba(hexToRgb(accent), 0.95);
      const len = 72;
      ctx.fillRect(plaque ? textX : cx - len / 2, y0, len, 2);
      ctx.restore();
      continue;
    }
    ctx.font = fontFor(block.role, style, block.size, fonts);
    ctx.fillStyle = block.role === "detail" ? rgba(hexToRgb(color), 0.78) : color;
    ctx.textAlign = plaque ? "left" : "center";
    block.lines.forEach((line, i) => {
      const baseline = y0 + i * block.lineHeight + block.size * 0.82;
      if (block.role === "detail") {
        drawTracked(ctx, line, textX, baseline, detailTracking(block.size), plaque ? "left" : "center");
      } else {
        ctx.textAlign = plaque ? "left" : "center";
        ctx.fillText(line, textX, baseline);
      }
    });
  }
  ctx.restore();
}

/** Small tracked museum name near the bottom of the safe area. */
export function drawWatermark(ctx: Ctx, name: string, cx: number, cy: number, tone: TextTone, fonts: StoryFonts) {
  const size = 26;
  const text = name.toUpperCase();
  ctx.save();
  ctx.font = `500 ${size}px ${fonts.body}`;
  ctx.textBaseline = "middle";
  const tracking = size * 0.3;
  const width = trackedWidth(text, tracking, (s) => ctx.measureText(s).width);
  const maxWidth = 800;
  const fit = width > maxWidth ? maxWidth / width : 1;
  ctx.translate(cx, cy);
  ctx.scale(fit, fit);
  ctx.fillStyle = rgba(hexToRgb(toneColor(tone)), 0.8);
  ctx.shadowColor = tone === "light" ? "rgba(0,0,0,0.3)" : "rgba(255,255,255,0.25)";
  ctx.shadowBlur = 4;
  drawTracked(ctx, text, 0, 0, tracking, "center");
  ctx.restore();
}
