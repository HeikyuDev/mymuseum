import { describe, expect, it } from "vitest";
import { QUALITY, detectTier } from "./quality";

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
