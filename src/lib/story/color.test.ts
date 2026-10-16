import { describe, expect, it } from "vitest";
import { analyzePhoto, averageColor, brightness, contrast, hexToRgb, mixHex, pickTextTone, suggestForPhoto } from "./color";

const solid = (r: number, g: number, b: number, n = 100) => Array.from({ length: n }, () => [r, g, b, 255]).flat();

describe("pickTextTone", () => {
  it("uses light text on dark walls and dark text on light walls", () => {
    expect(pickTextTone([20, 20, 30])).toBe("light");
    expect(pickTextTone([240, 236, 228])).toBe("dark");
    expect(pickTextTone([91, 26, 44])).toBe("light");
  });
  it("still reaches usable contrast on mid greys", () => {
    const tone = pickTextTone([128, 128, 128]);
    expect(contrast([128, 128, 128], tone === "light" ? [247, 243, 234] : [28, 26, 23])).toBeGreaterThan(3);
  });
});

describe("averageColor", () => {
  it("ignores transparent pixels", () => {
    expect(averageColor([255, 0, 0, 255, 0, 255, 0, 0])).toEqual([255, 0, 0]);
  });
  it("returns grey for empty data", () => expect(averageColor([])).toEqual([128, 128, 128]));
});

describe("analyzePhoto", () => {
  it("flags dark and bright photos", () => {
    expect(analyzePhoto(solid(10, 12, 20)).dark).toBe(true);
    expect(analyzePhoto(solid(240, 240, 235)).bright).toBe(true);
  });
  it("prefers a saturated subject over a larger grey area as dominant color", () => {
    const stats = analyzePhoto([...solid(120, 120, 120, 60), ...solid(220, 40, 30, 50)]);
    expect(stats.dominant[0]).toBeGreaterThan(stats.dominant[1] + 50);
  });
  it("handles fully transparent input", () => {
    expect(analyzePhoto([0, 0, 0, 0]).brightness).toBe(0.5);
  });
});

describe("suggestForPhoto", () => {
  it("dims a bright wall behind a bright photo only", () => {
    const bright = analyzePhoto(solid(245, 245, 240));
    expect(suggestForPhoto(bright, "#f1ede6").wallDim).toBeGreaterThan(0);
    expect(suggestForPhoto(bright, "#5b1a2c").wallDim).toBe(0);
    expect(suggestForPhoto(analyzePhoto(solid(10, 10, 15)), "#f1ede6").wallDim).toBe(0);
  });
  it("picks a minimal frame color that contrasts with the wall", () => {
    expect(suggestForPhoto(null, "#f1ede6").minimalFrameColor).toBe("#1b1b1b");
    expect(suggestForPhoto(null, "#5b1a2c").minimalFrameColor).toBe("#f6f3ec");
  });
  it("keeps a light mat for any photo", () => {
    for (const rgb of [[5, 5, 5], [250, 250, 250], [200, 30, 30]] as [number, number, number][]) {
      const mat = suggestForPhoto(analyzePhoto(solid(...rgb)), "#f1ede6").matColor;
      expect(brightness(hexToRgb(mat))).toBeGreaterThan(0.75);
    }
  });
});

describe("mixHex", () => {
  it("blends linearly", () => expect(mixHex("#000000", "#ffffff", 0.5)).toBe("#808080"));
});
