import { describe, expect, it } from "vitest";
import { FRAME_BUDGET_MS, GOVERNOR_WINDOW, LOW_SCALES, QUALITY, detectTier, governorStep, initialGovernor, isWeakGpu, lowerTier, parsePreference, tierForPreference, type GovernorState, type QualityTier } from "./quality";

const desktop = { viewportWidth: 1440, coarsePointer: false, deviceMemory: 8, hardwareConcurrency: 8 };

describe("detectTier", () => {
  it("gives capable desktops the high tier", () => {
    expect(detectTier(desktop)).toBe("high");
    expect(detectTier({ viewportWidth: 1440, coarsePointer: false })).toBe("high");
  });

  it("downgrades phones, weak machines, software renderers and embeds", () => {
    expect(detectTier({ ...desktop, viewportWidth: 390, coarsePointer: true })).toBe("medium");
    expect(detectTier({ ...desktop, deviceMemory: 2 })).toBe("low");
    expect(detectTier({ ...desktop, hardwareConcurrency: 2 })).toBe("low");
    expect(detectTier({ ...desktop, softwareRenderer: true })).toBe("low");
    expect(detectTier({ ...desktop, embedded: true })).toBe("medium");
    expect(detectTier({ ...desktop, embedded: true, deviceMemory: 2 })).toBe("low");
    expect(detectTier({ ...desktop, deviceMemory: 4, hardwareConcurrency: 4 })).toBe("medium");
  });
});

describe("QUALITY", () => {
  it("never casts more shadows than there are spotlights and drops costly features on low", () => {
    for (const settings of Object.values(QUALITY)) expect(settings.shadowLights).toBeLessThanOrEqual(settings.spotCount);
    expect(QUALITY.low.reflector).toBe(false);
    expect(QUALITY.low.shadows).toBe(false);
    expect(QUALITY.low.photoTextureMax).toBeLessThan(QUALITY.high.photoTextureMax);
  });
});

describe("detectTier signals", () => {
  it("treats weak GPUs, small texture limits and data saver as low", () => {
    expect(detectTier({ ...desktop, rendererName: "Mali-T720" })).toBe("low");
    expect(detectTier({ ...desktop, rendererName: "Adreno (TM) 308" })).toBe("low");
    expect(detectTier({ ...desktop, maxTextureSize: 4096 })).toBe("low");
    expect(detectTier({ ...desktop, reducedData: true })).toBe("low");
    expect(isWeakGpu("ANGLE (AMD, AMD Radeon(TM) Graphics)")).toBe(false);
  });

  it("caps phones with little memory or few cores at low and reduced motion at medium", () => {
    expect(detectTier({ viewportWidth: 390, coarsePointer: true, deviceMemory: 3, hardwareConcurrency: 8 })).toBe("low");
    expect(detectTier({ viewportWidth: 390, coarsePointer: true, deviceMemory: 4, hardwareConcurrency: 4 })).toBe("low");
    expect(detectTier({ ...desktop, reducedMotion: true })).toBe("medium");
  });
});

describe("quality preference", () => {
  it("auto keeps the detected tier and manual choices override it", () => {
    expect(tierForPreference("auto", "medium")).toBe("medium");
    expect(tierForPreference("low", "high")).toBe("low");
    expect(tierForPreference("high", "low")).toBe("high");
    expect(parsePreference("nonsense")).toBe("auto");
    expect(parsePreference("low")).toBe("low");
  });
  it("lowerTier never goes below low", () => {
    expect(lowerTier("high")).toBe("medium");
    expect(lowerTier("medium")).toBe("low");
    expect(lowerTier("low")).toBe("low");
  });
});

describe("low tier recipe", () => {
  it("uses no real lights, no shadows, no reflector and cheap materials", () => {
    expect(QUALITY.low.spotCount).toBe(0);
    expect(QUALITY.low.baked).toBe(true);
    expect(QUALITY.low.simpleMaterials).toBe(true);
    expect(QUALITY.low.dpr[1]).toBeLessThanOrEqual(1);
    expect(QUALITY.low.surfaceTextureSize).toBeLessThanOrEqual(256);
    expect(QUALITY.medium.shadowLights).toBeLessThanOrEqual(1);
  });
});

function run(tier: QualityTier, windows: number[]) {
  let state: GovernorState = initialGovernor();
  const actions: string[] = [];
  for (const ms of windows) {
    const step = governorStep(state, ms, tier);
    state = step.state;
    actions.push(step.action);
  }
  return { state, actions };
}

describe("governorStep", () => {
  const slow = FRAME_BUDGET_MS.high + 20;
  const fast = 8;
  it("ignores the warm-up windows and a single slow window", () => {
    expect(run("high", [slow, slow, slow]).actions).toEqual(["none", "none", "none"]);
    expect(run("high", [fast, fast, slow, fast, slow, fast]).actions.every((a) => a === "none")).toBe(true);
  });
  it("downgrades after two consecutive slow windows and then waits (no flapping)", () => {
    const { actions } = run("high", [fast, fast, slow, slow, slow, slow, slow]);
    expect(actions.filter((a) => a === "tier-down")).toHaveLength(1);
    expect(actions[3]).toBe("tier-down");
  });
  it("on low only lowers the resolution scale, step by step, and then stops", () => {
    const many = Array.from({ length: 40 }, () => FRAME_BUDGET_MS.low + 30);
    const { actions, state } = run("low", many);
    expect(actions.filter((a) => a === "scale-down")).toHaveLength(LOW_SCALES.length - 1);
    expect(actions).not.toContain("tier-down");
    expect(state.scaleStep).toBe(LOW_SCALES.length - 1);
  });
  it("uses a window of frames large enough to ignore single hitches", () => {
    expect(GOVERNOR_WINDOW).toBeGreaterThanOrEqual(30);
  });
});
