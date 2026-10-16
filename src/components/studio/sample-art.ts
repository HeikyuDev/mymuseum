import type { ViewerArtwork } from "@/lib/viewer-model";
import type { FrameStyle } from "@/types/database";

// Abstract placeholder pictures so empty halls and pickers still have something to show.

const PALETTES = [
  ["#f6c177", "#eb6f92", "#31748f"],
  ["#9ccfd8", "#c4a7e7", "#26233a"],
  ["#a3be8c", "#ebcb8b", "#d08770"],
] as const;

export const SAMPLE_ASPECTS = [1.35, 0.8, 1.6] as const;

export function sampleArtworkImage(index: number, aspect: number = SAMPLE_ASPECTS[index % 3]): string {
  const [a, b, c] = PALETTES[index % PALETTES.length];
  const w = 300;
  const h = Math.round(w / aspect);
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}' viewBox='0 0 ${w} ${h}'>` +
    `<defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='${a}'/><stop offset='1' stop-color='${c}'/></linearGradient></defs>` +
    `<rect width='${w}' height='${h}' fill='url(#g)'/>` +
    `<circle cx='${w * 0.68}' cy='${h * 0.32}' r='${h * 0.2}' fill='${b}' opacity='.9'/>` +
    `<path d='M0 ${h} L${w * 0.35} ${h * 0.55} L${w * 0.6} ${h * 0.8} L${w * 0.8} ${h * 0.6} L${w} ${h * 0.85} V${h} Z' fill='rgba(0,0,0,.28)'/>` +
    `</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/** Placeholder pictures for empty categories; `label` is the localized title prefix. */
export function sampleViewerArtworks(frameStyle: FrameStyle, label: string): ViewerArtwork[] {
  return SAMPLE_ASPECTS.map((aspect, index) => ({
    id: `sample-${index}`,
    title: `${label} ${index + 1}`,
    description: null,
    author: null,
    year: null,
    imageUrl: sampleArtworkImage(index, aspect),
    aspect,
    frameStyle,
    frameColor: null,
    mat: false,
    matColor: null,
  }));
}
