import { averageColor, hexToRgb, pickTextTone, type Rgb, type TextTone } from "./color";
import { STORY_FORMATS } from "./formats";
import { captionMaxHeight, composeStory, layoutCaption } from "./layout";
import { wallBaseColor, type StoryPlan } from "./plan";
import { canvasMeasureFor, drawCaption, drawWatermark, type StoryFonts } from "./draw/caption";
import { drawFloor } from "./draw/floor";
import { drawFramedPhoto, type PhotoSource } from "./draw/frame";
import { drawAtmosphere, drawSpotlight } from "./draw/light";
import { adjustWall, drawWall } from "./draw/wall";
import { yieldToMain, type Ctx } from "./draw/util";

export type { StoryFonts } from "./draw/caption";
export type { PhotoSource } from "./draw/frame";

export class RenderCancelled extends Error {
  constructor() {
    super("Render cancelled");
    this.name = "RenderCancelled";
  }
}

export type RenderOptions = {
  canvas: HTMLCanvasElement;
  plan: StoryPlan;
  photo: PhotoSource;
  fonts: StoryFonts;
  /** 1 renders the full format resolution (e.g. 1080x1920); previews use a smaller value. */
  scale: number;
  isCancelled?: () => boolean;
};

/** Average color of a design-space rect, or null when the canvas cannot be read back. */
function sampleRegion(ctx: Ctx, scale: number, x: number, y: number, w: number, h: number): Rgb | null {
  try {
    const sx = Math.max(0, Math.floor(x * scale));
    const sy = Math.max(0, Math.floor(y * scale));
    const sw = Math.max(1, Math.min(ctx.canvas.width - sx, Math.floor(w * scale)));
    const sh = Math.max(1, Math.min(ctx.canvas.height - sy, Math.floor(h * scale)));
    return averageColor(ctx.getImageData(sx, sy, sw, sh).data);
  } catch {
    return null;
  }
}

/**
 * Draws the whole museum-wall photograph: wall, optional floor, lighting, the
 * framed photo with its cast shadow, the caption and the watermark. Heavy steps
 * yield to the main thread so the UI stays responsive.
 */
export async function renderStory({ canvas, plan, photo, fonts, scale, isCancelled }: RenderOptions): Promise<{ tone: TextTone }> {
  const format = STORY_FORMATS[plan.format];
  canvas.width = Math.round(format.width * scale);
  canvas.height = Math.round(format.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available in this browser.");
  const check = async () => {
    await yieldToMain();
    if (isCancelled?.()) throw new RenderCancelled();
  };

  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  const W = format.width;
  const H = format.height;
  const hasFloor = plan.floor !== null;
  const watermark = plan.watermark !== null;

  // Measure the caption first: the artwork takes the space it leaves.
  const captionStyle = plan.caption.style;
  const caption = layoutCaption({
    texts: plan.caption.texts,
    style: captionStyle,
    format,
    maxWidth: format.width - 2 * format.safe.side,
    maxHeight: captionMaxHeight(format, hasFloor, watermark),
    measureFor: canvasMeasureFor(ctx, captionStyle, fonts),
  });
  const composition = composeStory({
    format,
    hasFloor,
    ratio: photo.width / photo.height,
    frameStyle: plan.frame.style,
    mat: plan.mat !== null,
    source: photo,
    captionHeight: caption.height,
    watermark,
  });

  // Wall (and floor).
  const wallH = composition.floorY ?? H;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, W, wallH);
  ctx.clip();
  drawWall(ctx, plan.wall.style, plan.wall.color, W, wallH);
  adjustWall(ctx, W, wallH, plan.wall.dim, plan.wall.tint);
  ctx.restore();
  await check();

  if (plan.floor && composition.floorY !== null) {
    drawFloor(ctx, scale, W, H, composition.floorY, plan.floor);
    await check();
  }

  // Light, then the picture on top of its own pool of light.
  drawSpotlight(ctx, plan.lighting, composition.art);
  drawFramedPhoto({
    ctx,
    scale,
    rect: composition.art,
    geometry: composition.geometry,
    style: plan.frame.style,
    color: plan.frame.color,
    matColor: plan.mat?.color ?? null,
    photo,
  });
  await check();

  drawAtmosphere(ctx, plan.lighting, plan.grain, W, H);
  await check();

  // Text color from the real pixels behind the caption (falls back to the wall palette).
  const fallback = hexToRgb(wallBaseColor(plan.wall.style, plan.wall.color));
  const toneFor = (rgb: Rgb | null): TextTone => pickTextTone(rgb ?? fallback);
  const pick = (explicit: StoryPlan["caption"]["tone"], rgb: Rgb | null): TextTone => (explicit === "auto" ? toneFor(rgb) : explicit);

  const captionBg = sampleRegion(ctx, scale, composition.caption.x, composition.caption.y, composition.caption.w, Math.max(caption.height, 1));
  const tone = pick(plan.caption.tone, captionBg);
  drawCaption({
    ctx,
    scale,
    layout: caption,
    style: captionStyle,
    box: composition.caption,
    tone,
    accent: plan.caption.accent,
    fonts,
  });

  if (plan.watermark && composition.watermarkY !== null) {
    const bg = sampleRegion(ctx, scale, W * 0.2, composition.watermarkY - 20, W * 0.6, 40);
    drawWatermark(ctx, plan.watermark, W / 2, composition.watermarkY, pick(plan.caption.tone, bg), fonts);
  }
  return { tone };
}
