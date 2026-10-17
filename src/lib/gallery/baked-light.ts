// Baked lighting for the cheapest quality tier. Instead of real lights, shadows and additive glow sprites,
// the walls and floors carry their lighting in per-vertex colors: ambient occlusion at the ceiling and the
// floor line, a soft warm pool of light behind every artwork and a falloff toward the back of the room.
// Pure functions, so the shapes are unit tested and the scene code only samples them.

export type BakedSpot = {
  /** Wall position of the artwork (m). */
  x: number;
  /** Half of the artwork's outer width (m). */
  halfWidth: number;
};

export type BakedLight = {
  /** Multiplier applied to the surface color (can exceed 1 inside a light pool). */
  gain: number;
  /** 0-1 amount of pool light here, used to tint toward the spot color. */
  pool: number;
};

const smoothstep = (a: number, b: number, v: number) => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Strongest pool at this position, summed softly so overlapping pools do not blow out. */
function poolAt(spots: readonly BakedSpot[], x: number, vertical: number, reachX: number, reachV: number): number {
  let sum = 0;
  for (let i = 0; i < spots.length; i += 1) {
    const u = (x - spots[i].x) / (spots[i].halfWidth + reachX);
    sum += Math.exp(-(u * u + vertical * vertical / (reachV * reachV)) * 1.25);
  }
  return Math.min(1.15, sum);
}

/** Extra pool strength for dark surfaces: a multiplier cannot lift near-black velvet, so the pool has to be brighter there. */
const POOL_LIFT = 5.6;

/** 0 for a light surface, 1 for a black one (perceived brightness of a #rrggbb color). */
export function darkness(hex: string): number {
  const n = Number.parseInt(hex.slice(1), 16);
  const lum = (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
  return Math.min(1, Math.max(0, 1 - lum * 1.15));
}

/**
 * Light on the wall at (x, y). `glow` is the hall's light strength (0 = flat natural light, no pools),
 * `height` the wall height, `lift` how dark the wall color is (see `darkness`).
 */
export function wallLightInto(out: BakedLight, x: number, y: number, height: number, spots: readonly BakedSpot[], glow: number, lift = 0): BakedLight {
  // Soft darkening under the crown and at the baseboard: the two places a real room is darker.
  const crown = 1 - 0.3 * smoothstep(height - 1.15, height, y);
  const base = 1 - 0.34 * (1 - smoothstep(0, 0.95, y));
  const pool = glow > 0 ? poolAt(spots, x, y - 1.85, 1.5, 1.9) * glow : 0;
  const ambient = 0.7 + 0.22 * (1 - Math.min(1, glow));
  out.gain = crown * base * (ambient + (0.62 + POOL_LIFT * lift ** 1.6) * pool);
  out.pool = Math.min(1, pool);
  return out;
}

/** Light on the floor at wall position `x`, `z` meters out from the wall. `depth` is the room depth. */
export function floorLightInto(out: BakedLight, x: number, z: number, depth: number, spots: readonly BakedSpot[], glow: number, lift = 0): BakedLight {
  const falloff = 1 - 0.42 * smoothstep(0.8, depth, z);
  const corner = 1 - 0.3 * (1 - smoothstep(0, 0.8, z));
  const pool = glow > 0 ? poolAt(spots, x, z - 1.5, 1.2, 1.9) * glow : 0;
  const ambient = 0.76 + 0.18 * (1 - Math.min(1, glow));
  out.gain = falloff * corner * (ambient + (0.5 + POOL_LIFT * 0.6 * lift ** 1.6) * pool);
  out.pool = Math.min(1, pool);
  return out;
}

/** Blends a color channel toward the warm spot color where the pool is strong. */
export const tintChannel = (value: number, spot: number, pool: number) => value + (spot - value) * 0.3 * pool;
