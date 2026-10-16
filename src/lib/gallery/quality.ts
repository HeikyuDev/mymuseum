// Quality tiers for the 3D scene. Pure data + a pure detector, so the choice is testable.

export type QualityTier = "low" | "medium" | "high" | "export";

export type QualitySettings = {
  tier: QualityTier;
  dpr: [number, number];
  antialias: boolean;
  shadows: boolean;
  shadowMapSize: number;
  /** Spotlights that exist at once (they are re-targeted to the artworks nearest the camera). */
  spotCount: number;
  /** How many of those spotlights cast shadows. */
  shadowLights: number;
  reflector: boolean;
  reflectorResolution: number;
  /** Longest side of a photo texture on the GPU. */
  photoTextureMax: number;
  /** Side of the procedural wall/floor textures. */
  surfaceTextureSize: number;
  anisotropy: number;
  /** Artworks within this many stops of the focus keep their texture loaded. */
  loadRadius: number;
  /** Decorative props (benches, plants, ropes, light fixtures) are skipped on the cheapest tier. */
  props: boolean;
};

export const QUALITY: Record<QualityTier, QualitySettings> = {
  low: {
    tier: "low",
    dpr: [1, 1.5],
    antialias: false,
    shadows: false,
    shadowMapSize: 512,
    spotCount: 2,
    shadowLights: 0,
    reflector: false,
    reflectorResolution: 256,
    photoTextureMax: 1024,
    surfaceTextureSize: 256,
    anisotropy: 2,
    loadRadius: 2,
    props: false,
  },
  medium: {
    tier: "medium",
    dpr: [1, 1.75],
    antialias: true,
    shadows: true,
    shadowMapSize: 1024,
    spotCount: 3,
    shadowLights: 1,
    reflector: false,
    reflectorResolution: 384,
    photoTextureMax: 1536,
    surfaceTextureSize: 512,
    anisotropy: 4,
    loadRadius: 3,
    props: true,
  },
  high: {
    tier: "high",
    dpr: [1, 2],
    antialias: true,
    shadows: true,
    shadowMapSize: 2048,
    spotCount: 4,
    shadowLights: 2,
    reflector: true,
    reflectorResolution: 768,
    photoTextureMax: 2048,
    surfaceTextureSize: 512,
    anisotropy: 8,
    loadRadius: 4,
    props: true,
  },
  export: {
    tier: "export",
    dpr: [1, 1],
    antialias: true,
    shadows: true,
    shadowMapSize: 2048,
    spotCount: 5,
    shadowLights: 3,
    reflector: true,
    reflectorResolution: 1024,
    photoTextureMax: 2560,
    surfaceTextureSize: 768,
    anisotropy: 8,
    loadRadius: 2,
    props: true,
  },
};

export type DeviceInfo = {
  viewportWidth: number;
  coarsePointer: boolean;
  deviceMemory?: number;
  hardwareConcurrency?: number;
  /** True when the WebGL renderer string looks like a software rasterizer. */
  softwareRenderer?: boolean;
  /** Admin previews and other small embeds. */
  embedded?: boolean;
  reducedData?: boolean;
};

export function detectTier(device: DeviceInfo): QualityTier {
  if (device.softwareRenderer) return "low";
  const weak =
    (device.deviceMemory !== undefined && device.deviceMemory <= 2) ||
    (device.hardwareConcurrency !== undefined && device.hardwareConcurrency <= 2) ||
    device.reducedData === true;
  if (weak) return "low";
  // Embedded previews (admin) stay light but keep shadows and props so they match the real thing.
  if (device.embedded) return "medium";
  const mobile = device.coarsePointer || device.viewportWidth < 700;
  if (mobile) return "medium";
  const strong =
    (device.deviceMemory === undefined || device.deviceMemory >= 8) &&
    (device.hardwareConcurrency === undefined || device.hardwareConcurrency >= 6);
  return strong ? "high" : "medium";
}
