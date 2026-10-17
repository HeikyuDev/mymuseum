import { BufferGeometry, Float32BufferAttribute } from "three";
import type { FrameStyle } from "@/types/database";
import { FRAME_SPECS } from "@/lib/gallery/frame-specs";

// Frames are real mouldings: a 2D cross-section (offset from the opening, depth
// from the wall) swept around a rectangle. Every ring is a rectangle, so the four
// sides meet in perfect mitres and each profile step catches the light.

export type ProfilePoint = readonly [offset: number, depth: number];

/** Cross-sections from the inner edge outward. The builder closes them against the wall. */
export const FRAME_PROFILES: Partial<Record<FrameStyle, readonly ProfilePoint[]>> = {
  minimal: [
    [0, 0.028],
    [0.004, 0.04],
    [0.018, 0.04],
    [0.022, 0.032],
  ],
  wood: [
    [0, 0.034],
    [0.004, 0.046],
    [0.012, 0.058],
    [0.03, 0.065],
    [0.046, 0.058],
    [0.056, 0.044],
    [0.064, 0.05],
    [0.07, 0.038],
  ],
  gold: [
    [0, 0.04],
    [0.006, 0.056],
    [0.014, 0.07],
    [0.03, 0.074],
    [0.036, 0.062],
    [0.05, 0.062],
    [0.058, 0.08],
    [0.074, 0.08],
    [0.083, 0.07],
    [0.095, 0.048],
  ],
  metallic: [
    [0, 0.03],
    [0.003, 0.05],
    [0.027, 0.05],
    [0.03, 0.044],
  ],
  black_gallery: [
    [0, 0.034],
    [0.004, 0.055],
    [0.036, 0.055],
    [0.04, 0.04],
  ],
  vintage_ornate: [
    [0, 0.05],
    [0.01, 0.072],
    [0.02, 0.092],
    [0.04, 0.098],
    [0.05, 0.082],
    [0.065, 0.082],
    [0.075, 0.104],
    [0.09, 0.104],
    [0.1, 0.088],
    [0.115, 0.088],
    [0.125, 0.094],
    [0.14, 0.082],
    [0.15, 0.062],
    [0.16, 0.046],
  ],
};

/**
 * Sweeps `profile` around an opening of openW x openH (meters).
 * Texture coordinates are in meters (along the side, along the profile), so a
 * tiling texture keeps its real-world scale.
 */
export function sweepGeometry(openW: number, openH: number, profile: readonly ProfilePoint[], pad: number): BufferGeometry {
  const points: ProfilePoint[] = [[0, 0.004], ...profile, [pad, 0]];
  const positions: number[] = [];
  const uvs: number[] = [];
  const hw = openW / 2;
  const hh = openH / 2;

  const corner = (index: number, offset: number, z: number): [number, number, number] => {
    const w = hw + offset;
    const h = hh + offset;
    switch (index % 4) {
      case 0:
        return [-w, h, z];
      case 1:
        return [w, h, z];
      case 2:
        return [w, -h, z];
      default:
        return [-w, -h, z];
    }
  };

  let arc = 0;
  for (let p = 0; p < points.length - 1; p += 1) {
    const [oa, za] = points[p];
    const [ob, zb] = points[p + 1];
    const segment = Math.hypot(ob - oa, zb - za);
    for (let side = 0; side < 4; side += 1) {
      const a0 = corner(side, oa, za);
      const a1 = corner(side + 1, oa, za);
      const b1 = corner(side + 1, ob, zb);
      const b0 = corner(side, ob, zb);
      const horizontal = side % 2 === 0;
      const coord = (v: [number, number, number]) => (horizontal ? v[0] : v[1]);
      const quad = [a0, a1, b1, a0, b1, b0];
      const quadUv = [
        [coord(a0), arc],
        [coord(a1), arc],
        [coord(b1), arc + segment],
        [coord(a0), arc],
        [coord(b1), arc + segment],
        [coord(b0), arc + segment],
      ];
      for (let k = 0; k < 6; k += 1) {
        positions.push(...quad[k]);
        uvs.push(quadUv[k][0], quadUv[k][1]);
      }
    }
    arc += segment;
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  geometry.computeVertexNormals();
  return geometry;
}

/** Frame moulding for a style, or null for styles without one (canvas, glass). */
export function frameGeometry(style: FrameStyle, openW: number, openH: number, simple = false): BufferGeometry | null {
  const profile = FRAME_PROFILES[style];
  if (!profile) return null;
  // Cheap tier: a stepped profile with a bevelled lip and an outer shoulder (a handful of quads per side).
  // The steps face different ways, so the frame still reads as a moulding under flat ambient light.
  if (simple) {
    const { depth, pad } = FRAME_SPECS[style];
    return sweepGeometry(openW, openH, [[0, depth * 0.62], [Math.min(0.006, pad * 0.18), depth], [pad * 0.62, depth], [pad * 0.74, depth * 0.78], [pad - 0.002, depth * 0.78]], pad);
  }
  return sweepGeometry(openW, openH, profile, FRAME_SPECS[style].pad);
}

/** Passe-partout: a flat board with a 45 degree bevel down to the photo. */
export function matGeometry(imageW: number, imageH: number, matW: number): BufferGeometry {
  const bevel = Math.min(0.008, matW * 0.15);
  const profile: ProfilePoint[] = [
    [0, 0.002],
    [bevel, 0.009],
    [matW - 0.001, 0.009],
  ];
  // The sweep adds (0, 0.004) in front and (pad, 0) behind; the bevel must start
  // at the photo edge, so the opening is the photo size and pad equals the mat.
  return sweepGeometry(imageW, imageH, profile.slice(1), matW);
}
