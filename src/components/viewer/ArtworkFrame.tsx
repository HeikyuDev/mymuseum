/* eslint-disable @next/next/no-img-element */
import type { CSSProperties } from "react";
import type { ViewerArtwork } from "@/lib/museum-data";
import type { FrameStyle } from "@/types/database";

// Frame thickness as a multiple of the base unit `t`.
const PAD_MULT: Record<FrameStyle, number> = {
  minimal: 0.6,
  wood: 1.7,
  gold: 1.6,
  metallic: 1.2,
  canvas_wrap: 0,
  black_gallery: 0.9,
  vintage_ornate: 2.6,
  floating_glass: 0,
};

const DEFAULT_COLOR: Record<FrameStyle, string> = {
  minimal: "#f6f3ec",
  wood: "#6b4423",
  gold: "#c9a227",
  metallic: "#b8bcc2",
  canvas_wrap: "#e6e0d2",
  black_gallery: "#111111",
  vintage_ornate: "#b08d3c",
  floating_glass: "#ffffff",
};

export type FrameMetrics = {
  t: number;
  pad: number;
  matPad: number;
  imgW: number;
  imgH: number;
  w: number;
  h: number;
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Fits the image (plus frame and mat) inside a maxW x maxH box. */
export function computeFrame(
  ratio: number,
  maxW: number,
  maxH: number,
  style: FrameStyle,
  mat: boolean,
): FrameMetrics {
  const t = clamp(maxH * 0.028, 3, 14);
  const pad = t * PAD_MULT[style];
  const matPad = mat && style !== "canvas_wrap" ? Math.max(8, maxH * 0.06) : 0;
  const extra = pad + matPad;
  const boxW = Math.max(20, maxW - 2 * extra);
  const boxH = Math.max(20, maxH - 2 * extra);
  let imgW = boxW;
  let imgH = boxW / ratio;
  if (imgH > boxH) {
    imgH = boxH;
    imgW = boxH * ratio;
  }
  return { t, pad, matPad, imgW, imgH, w: imgW + 2 * extra, h: imgH + 2 * extra };
}

// Light comes from the upper left, so thickness extrudes toward the lower right.
function extrude(depth: number, color: string): string {
  return Array.from({ length: depth }, (_, i) => `${i + 1}px ${i + 1}px 0 ${color}`).join(", ");
}

const CAST = "12px 20px 28px rgba(0,0,0,.32), 3px 5px 8px rgba(0,0,0,.25)";

function frameStyleFor(style: FrameStyle, color: string, m: FrameMetrics): CSSProperties {
  const light = `color-mix(in srgb, ${color} 55%, white)`;
  const dark = `color-mix(in srgb, ${color} 62%, black)`;
  const metal = `linear-gradient(135deg, ${light} 0%, ${color} 24%, ${dark} 48%, ${light} 74%, ${color} 100%)`;
  const bevel = `inset 1px 1px 2px rgba(255,255,255,.35), inset -2px -2px 3px rgba(0,0,0,.4)`;
  const base: CSSProperties = { padding: m.pad };
  switch (style) {
    case "minimal":
      return { ...base, background: color, boxShadow: `${extrude(3, "rgba(0,0,0,.3)")}, ${CAST}` };
    case "wood":
      return {
        ...base,
        background: `repeating-linear-gradient(90deg, rgba(0,0,0,.09) 0 2px, transparent 2px 7px), linear-gradient(135deg, ${light}, ${color} 45%, ${dark})`,
        boxShadow: `${bevel}, ${extrude(5, "rgba(30,15,5,.55)")}, ${CAST}`,
      };
    case "gold":
    case "metallic":
      return { ...base, background: metal, boxShadow: `${bevel}, ${extrude(5, "rgba(0,0,0,.45)")}, ${CAST}` };
    case "canvas_wrap":
      return {
        ...base,
        background: color,
        boxShadow: `${extrude(8, `color-mix(in srgb, ${color} 70%, black)`)}, ${CAST}`,
      };
    case "black_gallery":
      return { ...base, background: color, boxShadow: `inset 0 0 0 1px rgba(255,255,255,.12), ${extrude(4, "rgba(0,0,0,.6)")}, ${CAST}` };
    case "vintage_ornate":
      return {
        ...base,
        background: `repeating-linear-gradient(45deg, rgba(0,0,0,.14) 0 3px, transparent 3px 9px), ${metal}`,
        boxShadow: `${bevel}, inset 0 0 0 ${m.t * 0.5}px rgba(0,0,0,.22), inset 0 0 0 ${m.t * 0.75}px rgba(255,235,170,.35), ${extrude(6, "rgba(40,25,0,.55)")}, ${CAST}`,
      };
    case "floating_glass":
    default:
      return {
        ...base,
        background: "rgba(255,255,255,.12)",
        boxShadow: `0 0 0 1px rgba(255,255,255,.55), 0 0 0 5px rgba(255,255,255,.12), ${extrude(3, "rgba(255,255,255,.25)")}, 0 28px 44px rgba(0,0,0,.28)`,
      };
  }
}

type Props = {
  artwork: ViewerArtwork;
  metrics: FrameMetrics;
  eager: boolean;
  onLoadRatio: (ratio: number) => void;
};

export function ArtworkFrame({ artwork, metrics, eager, onLoadRatio }: Props) {
  const color = artwork.frameColor ?? DEFAULT_COLOR[artwork.frameStyle];
  const matColor = artwork.matColor ?? "#f4f0e6";
  const glass = artwork.frameStyle === "floating_glass";
  return (
    <div
      className="relative"
      style={{ width: metrics.w, height: metrics.h, ...frameStyleFor(artwork.frameStyle, color, metrics) }}
    >
      <div
        className="h-full w-full"
        style={{
          padding: metrics.matPad,
          background: metrics.matPad ? matColor : undefined,
          boxShadow: metrics.matPad ? "inset 1px 1px 3px rgba(0,0,0,.25), inset -1px -1px 1px rgba(255,255,255,.5)" : undefined,
        }}
      >
        <div className="relative h-full w-full overflow-hidden" style={{ boxShadow: "inset 0 0 6px rgba(0,0,0,.5)" }}>
          <img
            src={artwork.imageUrl}
            alt={artwork.title}
            draggable={false}
            loading={eager ? "eager" : "lazy"}
            decoding="async"
            onLoad={(e) => {
              const { naturalWidth, naturalHeight } = e.currentTarget;
              if (naturalWidth && naturalHeight) onLoadRatio(naturalWidth / naturalHeight);
            }}
            className="h-full w-full select-none object-cover"
          />
          {glass ? (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{ background: "linear-gradient(115deg, rgba(255,255,255,.3) 0%, rgba(255,255,255,0) 28%)" }}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
