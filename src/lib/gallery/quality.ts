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
  /** Render resolution multiplier while the camera glides (restored at rest). 1 keeps full resolution. */
  moveScale: number;
};

export const QUALITY: Record<QualityTier, QualitySettings> = {
  low: {
    tier: "low",
    dpr: [1, 1.25],
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
    props: true,
    envIntensity: 0,
    simpleFrames: true,
    cullDistance: 16,
    moveScale: 0.85,
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
    moveScale: 0.85,
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
    moveScale: 1,
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
    moveScale: 1,
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

/** A tier's settings with the pixel ratio scaled (the governor lowers it first). */
export function scaledQuality(tier: QualityTier, scale: number): QualitySettings {
  return withScale(QUALITY[tier], scale);
}

function withScale(base: QualitySettings, scale: number): QualitySettings {
  if (scale >= 1) return base;
  const [min, max] = base.dpr;
  return { ...base, dpr: [Math.max(0.5, min * scale), Math.max(0.5, max * scale)] };
}

/**
 * Phone adjustments: no MSAA (the pixel ratio already hides most aliasing), a pixel ratio of at most 1.5,
 * smaller shadow maps, no planar reflection and fewer lights. Fill rate is what phones run out of first.
 */
export function forMobile(base: QualitySettings): QualitySettings {
  if (base.tier === "export") return base;
  return {
    ...base,
    antialias: false,
    dpr: [Math.min(base.dpr[0], 1), Math.min(base.dpr[1], 1.5)],
    shadowMapSize: Math.min(base.shadowMapSize, 1024),
    reflector: false,
    spotCount: Math.min(base.spotCount, 2),
    shadowLights: Math.min(base.shadowLights, 1),
    photoTextureMax: Math.min(base.photoTextureMax, 1536),
    moveScale: Math.min(base.moveScale, 0.75),
  };
}

export type QualityPreference = "auto" | "high" | "low";

export function parsePreference(value: unknown): QualityPreference {
  return value === "high" || value === "low" ? value : "auto";
}

/** The tier a preference resolves to; `auto` keeps the detected one. */
export function tierForPreference(preference: QualityPreference, detected: QualityTier): QualityTier {
  return preference === "auto" ? detected : preference;
}

// ---- graceful degradation ---------------------------------------------------------------------

type Rung = {
  /** Base tier of the rung (the baked low tier is the last resort). */
  tier: "low" | "medium" | "high";
  /** Resolution multiplier. */
  scale: number;
  /** No planar reflection and no shadows (the rendering features that cost the most per frame). */
  lite?: boolean;
};

const rung = (tier: Rung["tier"], scale: number, lite = false): Rung => ({ tier, scale, lite });

/**
 * The order in which a device that cannot keep up gives things up: resolution first, then shadows and the
 * reflection, and only then the baked low tier. Each device walks down from its starting tier.
 */
export const LADDERS: Record<"low" | "medium" | "high", readonly Rung[]> = {
  high: [rung("high", 1), rung("high", 0.85), rung("high", 0.7), rung("high", 0.7, true), rung("low", 1), rung("low", 0.85), rung("low", 0.7)],
  medium: [rung("medium", 1), rung("medium", 0.85), rung("medium", 0.7), rung("medium", 0.7, true), rung("low", 1), rung("low", 0.85), rung("low", 0.7)],
  low: [rung("low", 1), rung("low", 0.85), rung("low", 0.7), rung("low", 0.6)],
};

export function ladderStart(tier: QualityTier): "low" | "medium" | "high" {
  return tier === "low" || tier === "medium" ? tier : "high";
}

export function maxLevel(start: QualityTier): number {
  return LADDERS[ladderStart(start)].length - 1;
}

/** The settings of a device that started on `start` and has been degraded `level` rungs. */
export function resolveQuality(start: QualityTier, level: number, mobile: boolean): QualitySettings {
  const ladder = LADDERS[ladderStart(start)];
  const step = ladder[Math.min(Math.max(level, 0), ladder.length - 1)];
  let base = QUALITY[step.tier];
  if (mobile) base = forMobile(base);
  if (step.lite) base = { ...base, reflector: false, shadows: false, shadowLights: 0 };
  return withScale(base, step.scale);
}

/** Tier name of a rung (used to key the canvas: a different tier is a different scene). */
export function tierAt(start: QualityTier, level: number): QualityTier {
  const ladder = LADDERS[ladderStart(start)];
  return ladder[Math.min(Math.max(level, 0), ladder.length - 1)].tier;
}

// ---- runtime governor ---------------------------------------------------------------------

/** Frame time budgets in ms: ~40 fps for medium and high, ~30 fps for low. */
export const FRAME_BUDGET_MS: Record<"low" | "medium" | "high", number> = { high: 25, medium: 25, low: 33 };
/** Frames per measurement window. Frames only exist while the camera moves (frameloop demand). */
export const GOVERNOR_WINDOW = 30;
const WARMUP_WINDOWS = 2;
const OVER_WINDOWS_TO_ACT = 2;
const COOLDOWN_WINDOWS = 3;
/** A window also counts as slow when this share of its frames took longer than 1.5 budgets. */
const LAG_SHARE = 0.3;

export type GovernorState = {
  windows: number;
  over: number;
  cooldown: number;
};

export const initialGovernor = (): GovernorState => ({ windows: 0, over: 0, cooldown: 0 });

export type GovernorAction = "none" | "degrade";

/** Median of a window of frame times (ms). The median ignores the one-off hitch of a texture upload. */
export function windowStats(frames: readonly number[], budgetMs: number): { median: number; lagShare: number } {
  if (frames.length === 0) return { median: 0, lagShare: 0 };
  const sorted = [...frames].sort((a, b) => a - b);
  const lag = frames.filter((ms) => ms > budgetMs * 1.5).length / frames.length;
  return { median: sorted[Math.floor(sorted.length / 2)], lagShare: lag };
}

/**
 * One decision per measurement window. It only ever degrades one rung: two consecutive slow windows
 * are needed (median over budget, or a third of the frames far over it), and after acting it waits a few
 * windows so shader recompiles and texture uploads cannot trigger a second step. Because it never upgrades,
 * the quality cannot flap.
 */
export function governorStep(state: GovernorState, medianMs: number, lagShare: number, tier: QualityTier, canDegrade = true): { state: GovernorState; action: GovernorAction } {
  const budget = FRAME_BUDGET_MS[ladderStart(tier)];
  const windows = state.windows + 1;
  if (windows <= WARMUP_WINDOWS) return { state: { ...state, windows }, action: "none" };
  if (state.cooldown > 0) return { state: { ...state, windows, cooldown: state.cooldown - 1, over: 0 }, action: "none" };
  const slow = medianMs > budget || lagShare > LAG_SHARE;
  const over = slow ? state.over + 1 : 0;
  if (over < OVER_WINDOWS_TO_ACT) return { state: { ...state, windows, over }, action: "none" };
  if (!canDegrade) return { state: { ...state, windows, over: 0 }, action: "none" };
  return { state: { ...state, windows, over: 0, cooldown: COOLDOWN_WINDOWS }, action: "degrade" };
}

/** Frames slower than this are a stall (a texture upload, a tab switch), not the pace of the device. */
export const GOVERNOR_MAX_SAMPLE_MS = 150;
/** The first frames of a glide carry the work of starting it and are not representative. */
export const GOVERNOR_GLIDE_SETTLE_MS = 160;
/** After a tab switch, a resize or a rotation the browser needs a moment before frame times mean anything. */
export const GOVERNOR_QUIET_MS = 2000;

export type SampleContext = {
  frameMs: number;
  hidden: boolean;
  now: number;
  /** No samples before this time (set by visibility, resize and rotation events). */
  quietUntil: number;
  glideStartedAt: number;
  /** Glides completed: the opening glide (warm-up, uploads, the curtain fade) never counts. */
  glides: number;
};

/** Whether a frame of a glide may count toward the governor window. */
export function shouldSampleFrame(c: SampleContext): boolean {
  if (c.hidden || c.glides < 1) return false;
  if (c.frameMs > GOVERNOR_MAX_SAMPLE_MS) return false;
  if (c.now < c.quietUntil) return false;
  return c.now - c.glideStartedAt >= GOVERNOR_GLIDE_SETTLE_MS;
}
