import type { CSSProperties } from "react";
import { FLOOR_BASE, WALL_BASE } from "@/lib/scene-palette";
import type { FloorDecoration, FloorStyle, WallStyle } from "@/types/database";

export { FLOOR_DECORATION_SPECS, LIGHTING, type DecorationSpec, type Lighting } from "@/lib/scene-palette";

// Procedural CSS/SVG textures. No image assets.

const svgUrl = (body: string, w: number, h: number) =>
  `url("data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}'>${body}</svg>`,
  )}")`;

/** Tileable fractal noise rendered as black speckle with the given strength. */
const noise = (freq: string, strength: number, octaves = 3, seed = 3) =>
  svgUrl(
    `<filter id='n' x='0' y='0' width='100%' height='100%'><feTurbulence type='fractalNoise' baseFrequency='${freq}' numOctaves='${octaves}' seed='${seed}' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  ${strength} 0 0 0 0'/></filter><rect width='100%' height='100%' filter='url(#n)'/>`,
    256,
    256,
  );

/** Thin veins: only the mid-range of the noise survives. */
const veins = (freq: string, alpha: number, seed: number) =>
  svgUrl(
    `<filter id='v' x='0' y='0' width='100%' height='100%'><feTurbulence type='fractalNoise' baseFrequency='${freq}' numOctaves='4' seed='${seed}' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.35  0 0 0 0 0.35  0 0 0 0 0.38  1 0 0 0 0'/><feComponentTransfer><feFuncA type='table' tableValues='0 0 0 0 ${alpha} 0 0 0 0'/></feComponentTransfer></filter><rect width='100%' height='100%' filter='url(#v)'/>`,
    512,
    512,
  );

const brickTile = svgUrl(
  `<rect width='96' height='64' fill='#a89b8c'/>` +
    `<rect x='2' y='2' width='44' height='28' fill='#9a4b3a'/><rect x='50' y='2' width='44' height='28' fill='#8f4333'/>` +
    `<rect x='-22' y='34' width='44' height='28' fill='#8f4333'/><rect x='26' y='34' width='44' height='28' fill='#a15240'/><rect x='74' y='34' width='44' height='28' fill='#8f4333'/>`,
  96,
  64,
);

export type LayerStyle = Pick<
  CSSProperties,
  "backgroundColor" | "backgroundImage" | "backgroundSize" | "backgroundRepeat"
>;

export function wallLayer(style: WallStyle, color: string | null): LayerStyle {
  switch (style) {
    case "brick":
      return {
        backgroundColor: WALL_BASE.brick,
        backgroundImage: `${noise("0.8", 0.35)}, ${brickTile}`,
        backgroundSize: "256px 256px, 96px 64px",
      };
    case "concrete":
      return {
        backgroundColor: WALL_BASE.concrete,
        backgroundImage: `${noise("0.55", 0.4)}, ${noise("0.015", 0.35, 2, 9)}`,
        backgroundSize: "256px 256px, 256px 256px",
      };
    case "wood_panel":
      return {
        backgroundColor: WALL_BASE.wood_panel,
        backgroundImage: `repeating-linear-gradient(90deg, rgba(0,0,0,.38) 0 2px, rgba(255,255,255,.05) 2px 4px, transparent 4px 120px), ${svgUrl(
          `<filter id='w' x='0' y='0' width='100%' height='100%'><feTurbulence type='fractalNoise' baseFrequency='0.012 0.45' numOctaves='3' seed='5' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.15  0 0 0 0 0.07  0 0 0 0 0.02  0 1.2 0 0 -0.15'/></filter><rect width='100%' height='100%' filter='url(#w)'/>`,
          256,
          256,
        )}`,
        backgroundSize: "120px 100%, 256px 256px",
      };
    case "marble":
      return {
        backgroundColor: WALL_BASE.marble,
        backgroundImage: `${veins("0.006 0.012", 0.55, 4)}, ${veins("0.015 0.008", 0.3, 11)}`,
        backgroundSize: "512px 512px, 512px 512px",
      };
    case "velvet":
      return {
        backgroundColor: WALL_BASE.velvet,
        backgroundImage: `repeating-linear-gradient(90deg, rgba(0,0,0,.3) 0 6px, rgba(255,255,255,.06) 6px 12px, transparent 12px 30px), ${noise("1.4", 0.3)}`,
        backgroundSize: "auto, 256px 256px",
      };
    case "linen":
      return {
        backgroundColor: WALL_BASE.linen,
        backgroundImage: `repeating-linear-gradient(0deg, rgba(0,0,0,.06) 0 1px, transparent 1px 3px), repeating-linear-gradient(90deg, rgba(0,0,0,.06) 0 1px, transparent 1px 3px), ${noise("1.2", 0.2)}`,
        backgroundSize: "auto, auto, 256px 256px",
      };
    case "custom_color":
      return {
        backgroundColor: color ?? WALL_BASE.custom_color,
        backgroundImage: noise("0.9", 0.12),
        backgroundSize: "256px 256px",
      };
    case "plaster":
    default:
      // Bright off-white gallery wall.
      return {
        backgroundColor: WALL_BASE.plaster,
        backgroundImage: noise("0.9", 0.1),
        backgroundSize: "256px 256px",
      };
  }
}

export function floorLayer(style: FloorStyle): LayerStyle {
  switch (style) {
    case "marble":
      return {
        backgroundColor: FLOOR_BASE.marble,
        backgroundImage: `${veins("0.008 0.02", 0.4, 6)}, repeating-conic-gradient(rgba(255,255,255,.35) 0% 25%, rgba(0,0,0,.05) 0% 50%)`,
        backgroundSize: "512px 512px, 220px 220px",
      };
    case "concrete":
      return {
        backgroundColor: FLOOR_BASE.concrete,
        backgroundImage: `repeating-linear-gradient(90deg, rgba(0,0,0,.14) 0 2px, transparent 2px 260px), repeating-linear-gradient(0deg, rgba(0,0,0,.12) 0 2px, transparent 2px 200px), ${noise("0.5", 0.3)}`,
        backgroundSize: "auto, auto, 256px 256px",
      };
    case "carpet":
      return {
        backgroundColor: FLOOR_BASE.carpet,
        backgroundImage: noise("1.6", 0.4),
        backgroundSize: "256px 256px",
      };
    case "dark_wood":
      return {
        backgroundColor: FLOOR_BASE.dark_wood,
        backgroundImage: `repeating-linear-gradient(90deg, rgba(0,0,0,.4) 0 2px, transparent 2px 84px), ${noise("0.02 0.4", 0.5, 3, 8)}`,
        backgroundSize: "auto, 256px 256px",
      };
    case "parquet":
    default:
      // Light oak planks.
      return {
        backgroundColor: FLOOR_BASE.parquet,
        backgroundImage: `repeating-linear-gradient(90deg, rgba(90,60,30,.35) 0 2px, transparent 2px 96px), repeating-linear-gradient(0deg, rgba(90,60,30,.12) 0 1px, transparent 1px 48px), ${noise("0.015 0.35", 0.35, 3, 12)}`,
        backgroundSize: "auto, auto, 256px 256px",
      };
  }
}

// --- floor decorations (drawn on the perspective floor plane) ---------------

const persianTile = (color: string) =>
  svgUrl(
    `<rect width='48' height='48' fill='${color}'/>` +
      `<path d='M24 4 L44 24 L24 44 L4 24 Z' fill='none' stroke='#e8d9b0' stroke-width='2'/>` +
      `<path d='M24 14 L34 24 L24 34 L14 24 Z' fill='#e8d9b0' fill-opacity='.35'/>`,
    48,
    48,
  );

/** Style of the decoration body (the visible rectangle or ellipse on the floor plane). */
export function decorationBody(id: Exclude<FloorDecoration, "none">, color: string): CSSProperties {
  switch (id) {
    case "red_carpet":
      return {
        backgroundColor: color,
        backgroundImage: `${noise("1.8", 0.35)}, linear-gradient(90deg, rgba(0,0,0,.22), transparent 14%, transparent 86%, rgba(0,0,0,.22))`,
        borderTop: "5px solid #d4af37",
        borderBottom: "5px solid #d4af37",
        boxShadow: "inset 0 0 0 3px rgba(0,0,0,.18), 0 18px 34px rgba(0,0,0,.35), 0 -6px 18px rgba(0,0,0,.2)",
      };
    case "runner_gold_trim":
      return {
        backgroundColor: color,
        backgroundImage: `${noise("1.8", 0.3)}, repeating-linear-gradient(90deg, rgba(212,175,55,.35) 0 2px, transparent 2px 60px)`,
        border: "6px double #d4af37",
        boxShadow: "inset 0 0 0 10px rgba(0,0,0,.14), 0 16px 30px rgba(0,0,0,.35)",
      };
    case "rug_persian":
      return {
        backgroundColor: color,
        backgroundImage: persianTile(color),
        backgroundSize: "48px 48px",
        border: "10px solid #e8d9b0",
        boxShadow: "inset 0 0 0 4px rgba(0,0,0,.35), 0 14px 26px rgba(0,0,0,.3)",
      };
    case "rug_geometric":
      return {
        backgroundColor: color,
        backgroundImage:
          "repeating-conic-gradient(from 45deg at 50% 50%, rgba(255,255,255,.16) 0 25%, transparent 0 50%)",
        backgroundSize: "56px 56px",
        border: "8px solid #f0ece4",
        boxShadow: "inset 0 0 0 3px rgba(0,0,0,.3), 0 14px 26px rgba(0,0,0,.28)",
      };
    case "spotlight_pool":
    default:
      return {
        backgroundImage: `radial-gradient(ellipse at center, ${color} 0%, rgba(255,246,220,.55) 35%, rgba(255,246,220,0) 70%)`,
        opacity: 0.9,
      };
  }
}
