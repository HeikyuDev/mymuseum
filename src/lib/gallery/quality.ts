// Quality tiers for the 3D scene. Pure data, a pure device classifier and a pure runtime
// governor, so every decision is unit tested without a GPU.

export type QualityTier = "low" | "medium" | "high" | "export";

export type QualitySettings = {
  tier: QualityTier;
  /** Device pixel ratio range handed to the canvas. */
  dpr: [number, number];
  antialias: boolean;
  shadows: boolean;
  shadowMapSize: number;
  /** Spotlights that exist at once (they are re-targeted to the artworks nearest the camera). */
  spotCount: number;
  /** How many of those spotlights cast shadows. */
  shadowLights: number;
  /** Cheapest lighting: no real spotlights, baked-looking glow sprites and ambient occlusion gradients. */
  baked: boolean;
  /** Lambert materials with pre-lit textures instead of PBR. */
  simpleMaterials: boolean;
  reflector: boolean;
  reflectorResolution: number;
  /** Longest side of a photo texture on the GPU. */
  photoTextureMax: number;
  /** The artwork the camera rests on is upgraded from its thumbnail to the full image. */
  upgradeFocus: boolean;
  /** Side of the procedural wall/floor textures. */
  surfaceTextureSize: number;
  anisotropy: number;
  /** Artworks within this many stops of the focus keep their texture loaded. */
  loadRadius: number;
  /** Photo downloads running at once. */
  maxLoads: number;
  /** Decorative props (benches, plants, ropes) are skipped on the cheapest tier. */
  props: boolean;
  /** Environment reflection map strength (0 skips generating it). */
  envIntensity: number;
  /** Frame mouldings use a plain box profile instead of the swept profile. */
  simpleFrames: boolean;
  /** Zones and artworks farther than this many meters from the camera are not drawn. */
  cullDistance: number;
};

export const QUALITY: Record<QualityTier, QualitySettings> = {
  low: {
    tier: "low",
    dpr: [0.75, 1],
    antialias: false,
    shadows: false,
    shadowMapSize: 512,
    spotCount: 0,
    shadowLights: 0,
    baked: true,
    simpleMaterials: true,
    reflector: false,
    reflectorResolution: 256,
    photoTextureMax: 1280,
    upgradeFocus: false,
    surfaceTextureSize: 256,
    anisotropy: 2,
    loadRadius: 2,
    maxLoads: 2,
    props: false,
    envIntensity: 0,
    simpleFrames: true,
    cullDistance: 16,
  },
  medium: {
    tier: "medium",
    dpr: [1, 1.5],
    antialias: true,
    shadows: true,
    shadowMapSize: 1024,
    spotCount: 2,
    shadowLights: 1,
    baked: false,
    simpleMaterials: false,
    reflector: false,
    reflectorResolution: 384,
    photoTextureMax: 1536,
    upgradeFocus: true,
    surfaceTextureSize: 512,
    anisotropy: 4,
    loadRadius: 3,
    maxLoads: 3,
    props: true,
    envIntensity: 0.3,
    simpleFrames: false,
    cullDistance: 24,
  },
  high: {
    tier: "high",
    dpr: [1, 2],
    antialias: true,
    shadows: true,
    shadowMapSize: 2048,
    spotCount: 3,
    shadowLights: 2,
    baked: false,
    simpleMaterials: false,
    reflector: true,
    reflectorResolution: 768,
    photoTextureMax: 2048,
    upgradeFocus: true,
    surfaceTextureSize: 512,
    anisotropy: 8,
    loadRadius: 4,
    maxLoads: 4,
    props: true,
    envIntensity: 0.3,
    simpleFrames: false,
    cullDistance: 32,
  },
  export: {
    tier: "export",
    dpr: [1, 1],
    antialias: true,
    shadows: true,
    shadowMapSize: 2048,
    spotCount: 5,
    shadowLights: 3,
    baked: false,
    simpleMaterials: false,
    reflector: true,
    reflectorResolution: 1024,
    photoTextureMax: 2560,
    upgradeFocus: true,
    surfaceTextureSize: 768,
    anisotropy: 8,
    loadRadius: 2,
    maxLoads: 4,
    props: true,
    envIntensity: 0.3,
    simpleFrames: false,
    cullDistance: 200,
  },
};

export type DeviceInfo = {
  viewportWidth: number;
  coarsePointer: boolean;
  deviceMemory?: number;
  hardwareConcurrency?: number;
  /** True when the WebGL renderer string looks like a software rasterizer. */
  softwareRenderer?: boolean;
  /** Unmasked WebGL renderer string, used to spot known weak GPUs. */
  rendererName?: string;
  maxTextureSize?: number;
  /** Admin previews and other small embeds. */
  embedded?: boolean;
  reducedData?: boolean;
  reducedMotion?: boolean;
};

const WEAK_GPU = /mali-(4|t[0-7])|adreno \(tm\) ?[2-4]\d\d\b|powervr|videocore|vivante|intel.*(hd graphics (2|3|4)\d{3}\b|gma)/i;

export function isWeakGpu(name: string | undefined): boolean {
  return Boolean(name && WEAK_GPU.test(name));
}

/** Picks the starting tier from the device signals. The runtime governor may lower it later. */
export function detectTier(device: DeviceInfo): QualityTier {
  if (device.softwareRenderer || isWeakGpu(device.rendererName)) return "low";
  const mobile = device.coarsePointer || device.viewportWidth < 700;
  const weak =
    (device.deviceMemory !== undefined && device.deviceMemory <= 2) ||
    (device.hardwareConcurrency !== undefined && device.hardwareConcurrency <= 2) ||
    (device.maxTextureSize !== undefined && device.maxTextureSize < 8192) ||
    device.reducedData === true ||
    (mobile && ((device.deviceMemory !== undefined && device.deviceMemory <= 3) || (device.hardwareConcurrency !== undefined && device.hardwareConcurrency <= 4)));
  if (weak) return "low";
  // Embedded previews (studio) stay light but keep shadows and props so they match the real thing.
  if (device.embedded || mobile || device.reducedMotion) return "medium";
  const strong =
    (device.deviceMemory === undefined || device.deviceMemory >= 8) &&
    (device.hardwareConcurrency === undefined || device.hardwareConcurrency >= 6) &&
    (device.maxTextureSize === undefined || device.maxTextureSize >= 16384);
  return strong ? "high" : "medium";
}

/** A tier's settings with the pixel ratio scaled (the governor lowers it on the low tier). */
export function scaledQuality(tier: QualityTier, scale: number): QualitySettings {
  const base = QUALITY[tier];
  if (scale >= 1) return base;
  const [min, max] = base.dpr;
  return { ...base, dpr: [Math.max(0.5, min * scale), Math.max(0.5, max * scale)] };
}

export type QualityPreference ="auto" | "high" | "low";

export function parsePreference(value: unknown): QualityPreference {
  return value === "high" || value === "low" ? value : "auto";
}

/** The tier a preference resolves to; `auto` keeps the detected one. */
export function tierForPreference(preference: QualityPreference, detected: QualityTier): QualityTier {
  return preference === "auto" ? detected : preference;
}

const ORDER: QualityTier[] = ["low", "medium", "high"];

export function lowerTier(tier: QualityTier): QualityTier {
  const index = ORDER.indexOf(tier);
  return index <= 0 ? "low" : ORDER[index - 1];
}

// ---- runtime governor ---------------------------------------------------------------------

/** Frame time budgets in ms: ~40 fps for medium and high, ~28 fps for low. */
export const FRAME_BUDGET_MS: Record<"low" | "medium" | "high", number> = { high: 25, medium: 25, low: 36 };
/** Frames per measurement window. Frames only exist while the camera moves (frameloop demand). */
export const GOVERNOR_WINDOW = 40;
const WARMUP_WINDOWS = 2;
const OVER_WINDOWS_TO_ACT = 2;
const COOLDOWN_WINDOWS = 3;
/** Resolution multipliers the governor walks through on the low tier (after it can no longer lower the tier). */
export const LOW_SCALES = [1, 0.75, 0.6] as const;

export type GovernorState = {
  windows: number;
  over: number;
  cooldown: number;
  /** Index into LOW_SCALES. */
  scaleStep: number;
};

export const initialGovernor = (): GovernorState => ({ windows: 0, over: 0, cooldown: 0, scaleStep: 0 });

export type GovernorAction = "none" | "tier-down" | "scale-down";

/**
 * One decision per measurement window (the average frame time of GOVERNOR_WINDOW frames).
 * It only ever degrades: two consecutive over-budget windows are needed, and after acting it
 * waits a few windows so shader recompiles and texture uploads cannot trigger a second step.
 * Because it never upgrades, the quality cannot flap.
 */
export function governorStep(state: GovernorState, avgFrameMs: number, tier: QualityTier): { state: GovernorState; action: GovernorAction } {
  const key = tier === "low" || tier === "medium" || tier === "high" ? tier : "high";
  const windows = state.windows + 1;
  if (windows <= WARMUP_WINDOWS) return { state: { ...state, windows }, action: "none" };
  if (state.cooldown > 0) return { state: { ...state, windows, cooldown: state.cooldown - 1, over: 0 }, action: "none" };
  const over = avgFrameMs > FRAME_BUDGET_MS[key] ? state.over + 1 : 0;
  if (over < OVER_WINDOWS_TO_ACT) return { state: { ...state, windows, over }, action: "none" };
  if (key !== "low") return { state: { ...state, windows, over: 0, cooldown: COOLDOWN_WINDOWS }, action: "tier-down" };
  if (state.scaleStep < LOW_SCALES.length - 1) {
    return { state: { ...state, windows, over: 0, cooldown: COOLDOWN_WINDOWS, scaleStep: state.scaleStep + 1 }, action: "scale-down" };
  }
  return { state: { ...state, windows, over: 0 }, action: "none" };
}
