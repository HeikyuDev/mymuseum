import { describe, expect, it } from "vitest";
import { FRAME_BUDGET_MS, GOVERNOR_WINDOW, LADDERS, QUALITY, detectTier, forMobile, governorStep, initialGovernor, isWeakGpu, maxLevel, parsePreference, resolveQuality, tierAt, tierForPreference, windowStats, type GovernorState, type QualityTier } from "./quality";

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
});

describe("low tier recipe", () => {
  it("uses no real lights, no shadows, no reflector and cheap materials", () => {
    expect(QUALITY.low.spotCount).toBe(0);
    expect(QUALITY.low.baked).toBe(true);
    expect(QUALITY.low.simpleMaterials).toBe(true);
    expect(QUALITY.low.dpr[1]).toBeLessThanOrEqual(1.25);
    expect(QUALITY.low.surfaceTextureSize).toBeLessThanOrEqual(256);
    expect(QUALITY.medium.shadowLights).toBeLessThanOrEqual(1);
  });
});

function run(tier: QualityTier, windows: { ms: number; lag?: number }[]) {
  let state: GovernorState = initialGovernor();
  const actions: string[] = [];
  for (const w of windows) {
    const step = governorStep(state, w.ms, w.lag ?? 0, tier);
    state = step.state;
    actions.push(step.action);
  }
  return { state, actions };
}

const win = (ms: number, lag = 0) => ({ ms, lag });

describe("governorStep", () => {
  const slow = win(FRAME_BUDGET_MS.high + 20);
  const fast = win(8);
  it("ignores the warm-up windows and a single slow window", () => {
    expect(run("high", [slow, slow, slow]).actions).toEqual(["none", "none", "none"]);
    expect(run("high", [fast, fast, slow, fast, slow, fast]).actions.every((a) => a === "none")).toBe(true);
  });
  it("degrades one rung after two consecutive slow windows and then waits (no flapping)", () => {
    const { actions } = run("high", [fast, fast, slow, slow, slow, slow, slow]);
    expect(actions.filter((a) => a === "degrade")).toHaveLength(1);
    expect(actions[3]).toBe("degrade");
  });
  it("also reacts to windows where many frames lag even if the median is fine", () => {
    const { actions } = run("medium", [fast, fast, win(10, 0.5), win(10, 0.5)]);
    expect(actions[3]).toBe("degrade");
  });
  it("stops asking once there is nothing left to give up", () => {
    let state = initialGovernor();
    const actions: string[] = [];
    for (let i = 0; i < 30; i += 1) {
      const step = governorStep(state, 99, 1, "low", false);
      state = step.state;
      actions.push(step.action);
    }
    expect(actions).not.toContain("degrade");
  });
  it("uses a window of frames large enough to ignore single hitches", () => {
    expect(GOVERNOR_WINDOW).toBeGreaterThanOrEqual(24);
    expect(windowStats([16, 16, 16, 300, 16], 25).median).toBe(16);
  });
});

describe("degradation ladder", () => {
  it("gives up resolution first, then shadows and the reflection, and the baked tier last", () => {
    const levels = Array.from({ length: maxLevel("high") + 1 }, (_, level) => resolveQuality("high", level, false));
    const firstLite = levels.findIndex((q) => !q.shadows);
    const firstBaked = levels.findIndex((q) => q.baked);
    expect(levels[0]).toEqual(QUALITY.high);
    expect(levels[1].dpr[1]).toBeLessThan(levels[0].dpr[1]);
    expect(levels[1].shadows && levels[1].reflector).toBe(true);
    expect(firstLite).toBeGreaterThan(2);
    expect(levels[firstLite].reflector).toBe(false);
    expect(firstBaked).toBeGreaterThan(firstLite);
    expect(levels.slice(0, firstBaked).every((q) => !q.baked)).toBe(true);
  });
  it("walks the same resolution steps down on every start and never raises the quality", () => {
    for (const start of ["high", "medium", "low"] as const) {
      let previousDpr = Infinity;
      for (let level = 0; level <= maxLevel(start); level += 1) {
        const q = resolveQuality(start, level, false);
        if (tierAt(start, level) === LADDERS[start][level].tier) expect(q.tier).toBe(LADDERS[start][level].tier);
        if (level > 0 && LADDERS[start][level].tier === LADDERS[start][level - 1].tier) expect(q.dpr[1]).toBeLessThanOrEqual(previousDpr);
        previousDpr = q.dpr[1];
      }
    }
  });
  it("clamps out-of-range levels", () => {
    expect(resolveQuality("medium", 99, false).tier).toBe("low");
    expect(resolveQuality("high", -3, false)).toEqual(QUALITY.high);
  });
});

describe("forMobile", () => {
  it("drops MSAA, caps the pixel ratio and removes the reflection", () => {
    const q = forMobile(QUALITY.high);
    expect(q.antialias).toBe(false);
    expect(q.dpr[1]).toBeLessThanOrEqual(1.5);
    expect(q.reflector).toBe(false);
    expect(q.moveScale).toBeLessThan(1);
    expect(q.shadowLights).toBeLessThanOrEqual(q.spotCount);
  });
  it("leaves export renders untouched", () => {
    expect(forMobile(QUALITY.export)).toEqual(QUALITY.export);
  });
});
