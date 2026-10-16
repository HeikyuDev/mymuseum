import type { FrameStyle } from "@/types/database";

// Pure frame dimensions in meters. Shared by the layout engine (spacing needs
// the outer size) and the 3D frame builder (geometry), so both always agree.

export type FrameSpec = {
  /** Width of the frame face beyond the mat/opening. */
  pad: number;
  /** How far the frame projects from the wall. */
  depth: number;
  /** "profile" is a swept moulding, "canvas" a stretched canvas box, "glass" a floating acrylic panel. */
  kind: "profile" | "canvas" | "glass";
};

export const FRAME_SPECS: Record<FrameStyle, FrameSpec> = {
  minimal: { pad: 0.022, depth: 0.04, kind: "profile" },
  wood: { pad: 0.07, depth: 0.065, kind: "profile" },
  gold: { pad: 0.095, depth: 0.08, kind: "profile" },
  metallic: { pad: 0.03, depth: 0.05, kind: "profile" },
  canvas_wrap: { pad: 0, depth: 0.04, kind: "canvas" },
  black_gallery: { pad: 0.04, depth: 0.055, kind: "profile" },
  vintage_ornate: { pad: 0.16, depth: 0.1, kind: "profile" },
  floating_glass: { pad: 0.012, depth: 0.05, kind: "glass" },
};

/** Visible width of the passe-partout around the photo. */
export function matWidth(imageW: number, imageH: number): number {
  return Math.min(0.14, Math.max(0.06, Math.min(imageW, imageH) * 0.1));
}

export type ArtworkSize = {
  imageW: number;
  imageH: number;
  matW: number;
  /** Size of the photo plus mat, i.e. the frame opening. */
  openingW: number;
  openingH: number;
  /** Size including the frame. */
  outerW: number;
  outerH: number;
  depth: number;
};

export const DEFAULT_ASPECT = 4 / 3;

const TARGET_AREA = 1.35; // m^2 of photo, gives a pleasant, consistent rhythm
const MAX_W = 2.5;
const MAX_H = 1.55;

/** Real aspect ratio -> photo size in meters with a consistent visual weight. */
export function photoSize(aspect: number | null): { w: number; h: number } {
  const ratio = aspect !== null && Number.isFinite(aspect) && aspect > 0 ? Math.min(Math.max(aspect, 0.25), 6) : DEFAULT_ASPECT;
  let h = Math.sqrt(TARGET_AREA / ratio);
  let w = h * ratio;
  const scale = Math.min(1, MAX_W / w, MAX_H / h);
  h *= scale;
  w *= scale;
  return { w, h };
}

export function artworkSize(aspect: number | null, style: FrameStyle, mat: boolean): ArtworkSize {
  const { w: imageW, h: imageH } = photoSize(aspect);
  const spec = FRAME_SPECS[style];
  // Canvas wraps and floating glass have no mat: they show the photo edge to edge.
  const hasMat = mat && spec.kind === "profile";
  const matW = hasMat ? matWidth(imageW, imageH) : 0;
  const openingW = imageW + 2 * matW;
  const openingH = imageH + 2 * matW;
  return {
    imageW,
    imageH,
    matW,
    openingW,
    openingH,
    outerW: openingW + 2 * spec.pad,
    outerH: openingH + 2 * spec.pad,
    depth: spec.depth,
  };
}
