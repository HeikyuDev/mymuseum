import { FRAME_PAD_MULT } from "@/lib/scene-palette";
import type { FrameStyle } from "@/types/database";
import { contentRegion, type Rect, type StoryFormat } from "./formats";
import { fitText, wrapLines, trackedWidth, type Measure } from "./text";

// ---- artwork frame geometry -------------------------------------------------

export const MIN_RATIO = 0.2;
export const MAX_RATIO = 5;
/** A photo is never shown larger than this multiple of its pixel size. */
export const MAX_UPSCALE = 3;

const FRAME_UNIT = 0.028; // frame thickness unit relative to the photo's short side
const MAT_FACTOR = 0.11; // wide passe-partout, relative to the photo's short side
const MIN_FRAME_PAD = 4;

export type FrameGeometry = {
  /** Outer size including frame and mat. */
  outerW: number;
  outerH: number;
  /** Visible photo size. */
  imgW: number;
  imgH: number;
  pad: number;
  matPad: number;
  /** Thickness unit used for bevels and extrusion. */
  t: number;
};

export const clampRatio = (ratio: number) =>
  Number.isFinite(ratio) && ratio > 0 ? Math.min(MAX_RATIO, Math.max(MIN_RATIO, ratio)) : 4 / 3;

/**
 * Fits photo + mat + frame inside maxW x maxH for ANY aspect ratio. Frame and
 * mat are proportional to the photo's short side, so a panorama gets a slim
 * border and a portrait a generous one, never a distorted one.
 */
export function computeFrameGeometry(input: {
  ratio: number;
  maxW: number;
  maxH: number;
  style: FrameStyle;
  mat: boolean;
  /** Source pixel size, used to cap upscaling of low resolution photos. */
  source?: { width: number; height: number } | null;
}): FrameGeometry {
  const r = clampRatio(input.ratio);
  const padUnits = FRAME_PAD_MULT[input.style] * FRAME_UNIT;
  const matUnits = input.mat && input.style !== "canvas_wrap" ? MAT_FACTOR : 0;
  const c = padUnits + matUnits;
  const short = Math.min(r, 1); // photo is r x 1 in height units
  const unitW = r + 2 * c * short;
  const unitH = 1 + 2 * c * short;
  let k = Math.min(Math.max(input.maxW, 1) / unitW, Math.max(input.maxH, 1) / unitH);
  const src = input.source;
  if (src && src.width > 0 && src.height > 0) {
    k = Math.min(k, MAX_UPSCALE * src.height, (MAX_UPSCALE * src.width) / r);
  }
  const imgH = k;
  const imgW = k * r;
  const pad = padUnits > 0 ? Math.max(MIN_FRAME_PAD, padUnits * short * k) : 0;
  const matPad = matUnits * short * k;
  return {
    outerW: imgW + 2 * (pad + matPad),
    outerH: imgH + 2 * (pad + matPad),
    imgW,
    imgH,
    pad,
    matPad,
    t: Math.max(2, FRAME_UNIT * short * k),
  };
}

// ---- caption layout ---------------------------------------------------------

export type CaptionStyleId = "elegant" | "plaque" | "handwritten";
export type CaptionRole = "title" | "detail" | "description";

export type CaptionTexts = { title: string; detail: string; description: string };

export type CaptionBlock = {
  role: CaptionRole | "rule";
  lines: string[];
  size: number;
  lineHeight: number;
  /** Offset from the top of the caption content. */
  y: number;
};

export type CaptionLayout = {
  blocks: CaptionBlock[];
  /** Widest line (content width, without plaque padding). */
  contentWidth: number;
  contentHeight: number;
  /** Total box including plaque padding (equals content size for other styles). */
  width: number;
  height: number;
  padding: number;
};

export type MeasureFor = (role: CaptionRole, size: number) => Measure;

export const PLAQUE_PADDING = 30;
const TITLE_LINE = 1.16;
const BODY_LINE = 1.35;
const DETAIL_TRACKING_EM = 0.22;

export const detailTracking = (size: number) => size * DETAIL_TRACKING_EM;

/**
 * Lays the caption out inside maxWidth x maxHeight. Title is mandatory and
 * auto-fitted (up to 2 lines); the small detail line is one line; description is
 * optional and dropped line by line before the title is shrunk.
 */
export function layoutCaption(input: {
  texts: CaptionTexts;
  style: CaptionStyleId;
  format: StoryFormat;
  maxWidth: number;
  maxHeight: number;
  measureFor: MeasureFor;
}): CaptionLayout {
  const { texts, style, format, measureFor } = input;
  const padding = style === "plaque" ? PLAQUE_PADDING : 0;
  const innerW = Math.max(40, input.maxWidth - 2 * padding);
  const innerMaxH = Math.max(0, input.maxHeight - 2 * padding);
  const type = format.type;
  const titleScale = style === "handwritten" ? 1.3 : 1;
  const hasTitle = texts.title.trim().length > 0;
  const hasDetail = texts.detail.trim().length > 0;
  const hasDesc = texts.description.trim().length > 0;

  const attempt = (scale: number, descLines: number): { blocks: CaptionBlock[]; width: number; height: number } => {
    const blocks: CaptionBlock[] = [];
    let y = 0;
    let width = 0;
    if (hasTitle) {
      const fit = fitText({
        text: texts.title,
        maxWidth: innerW,
        maxLines: 2,
        minSize: Math.round(type.titleMin * titleScale * scale),
        maxSize: Math.round(type.titleMax * titleScale * scale),
        measureAt: (size) => measureFor("title", size),
      });
      const lineHeight = fit.size * TITLE_LINE;
      blocks.push({ role: "title", lines: fit.lines, size: fit.size, lineHeight, y });
      const m = measureFor("title", fit.size);
      width = Math.max(width, ...fit.lines.map(m));
      y += lineHeight * fit.lines.length;
    }
    if (hasDetail) {
      if (hasTitle) {
        y += type.detail * 0.45;
        blocks.push({ role: "rule", lines: [], size: 0, lineHeight: 2, y });
        y += 2 + type.detail * 0.55;
      }
      const size = Math.round(type.detail * scale);
      const measure = measureFor("detail", size);
      const line = wrapLines(texts.detail.toUpperCase(), innerW, (s) => trackedWidth(s, detailTracking(size), measure), 1).lines;
      blocks.push({ role: "detail", lines: line, size, lineHeight: size * 1.3, y });
      width = Math.max(width, ...line.map((l) => trackedWidth(l, detailTracking(size), measure)));
      y += size * 1.3;
    }
    if (hasDesc && descLines > 0) {
      y += type.descMax * 0.6;
      const fit = fitText({
        text: texts.description,
        maxWidth: innerW,
        maxLines: descLines,
        minSize: Math.round(type.descMin * scale),
        maxSize: Math.round(type.descMax * scale),
        step: 1,
        measureAt: (size) => measureFor("description", size),
      });
      const lineHeight = fit.size * BODY_LINE;
      blocks.push({ role: "description", lines: fit.lines, size: fit.size, lineHeight, y });
      const m = measureFor("description", fit.size);
      width = Math.max(width, ...fit.lines.map(m));
      y += lineHeight * fit.lines.length;
    }
    return { blocks, width, height: y };
  };

  const descOptions = hasDesc ? [3, 2, 1, 0] : [0];
  let chosen = attempt(0.7, 0);
  search: for (const scale of [1, 0.92, 0.84, 0.76, 0.7]) {
    for (const descLines of descOptions) {
      const result = attempt(scale, descLines);
      if (result.height <= innerMaxH) {
        chosen = result;
        break search;
      }
    }
  }

  const width = style === "plaque" ? Math.min(input.maxWidth, Math.max(chosen.width + 2 * padding, 360)) : chosen.width;
  return {
    blocks: chosen.blocks,
    contentWidth: chosen.width,
    contentHeight: chosen.height,
    width,
    height: chosen.blocks.length ? chosen.height + 2 * padding : 0,
    padding,
  };
}

// ---- composition ------------------------------------------------------------

export const WATERMARK_HEIGHT = 44;

/** Tallest caption box we allow: about a third of the region, minus the watermark. */
export function captionMaxHeight(format: StoryFormat, hasFloor: boolean, watermark: boolean): number {
  const region = contentRegion(format, hasFloor);
  return Math.round(region.h * 0.34) - (watermark ? WATERMARK_HEIGHT : 0);
}

export type Composition = {
  region: Rect;
  floorY: number | null;
  /** Outer rect of the framed artwork. */
  art: Rect;
  geometry: FrameGeometry;
  /** Top-left of the caption box and its available width. */
  caption: { x: number; y: number; w: number; h: number };
  watermarkY: number | null;
};

/** Gap between the artwork and its caption. */
export const captionGap = (format: StoryFormat) => Math.round(format.height * 0.032);

/**
 * Places artwork, caption and watermark inside the safe region. The artwork
 * takes whatever height the caption leaves; the group sits slightly above the
 * optical centre.
 */
export function composeStory(input: {
  format: StoryFormat;
  hasFloor: boolean;
  ratio: number;
  frameStyle: FrameStyle;
  mat: boolean;
  source?: { width: number; height: number } | null;
  captionHeight: number;
  watermark: boolean;
}): Composition {
  const { format } = input;
  const region = contentRegion(format, input.hasFloor);
  const wm = input.watermark ? WATERMARK_HEIGHT : 0;
  const gap = input.captionHeight > 0 ? captionGap(format) : 0;
  const availableH = region.h - wm - input.captionHeight - gap;
  const geometry = computeFrameGeometry({
    ratio: input.ratio,
    maxW: region.w,
    maxH: Math.max(availableH, 80),
    style: input.frameStyle,
    mat: input.mat,
    source: input.source,
  });
  const groupH = geometry.outerH + gap + input.captionHeight;
  const slack = Math.max(0, region.h - wm - groupH);
  const top = region.y + slack * 0.46;
  const art: Rect = { x: region.x + (region.w - geometry.outerW) / 2, y: top, w: geometry.outerW, h: geometry.outerH };
  return {
    region: { x: region.x, y: region.y, w: region.w, h: region.h },
    floorY: region.floorY,
    art,
    geometry,
    caption: { x: region.x, y: art.y + art.h + gap, w: region.w, h: input.captionHeight },
    watermarkY: input.watermark ? region.y + region.h - wm / 2 : null,
  };
}
