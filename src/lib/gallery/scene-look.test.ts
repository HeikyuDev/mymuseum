import { describe, expect, it } from "vitest";
import { isDarkColor, microcementColor } from "./scene-look";

const channels = (hex: string) => [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16));
const spread = (hex: string) => Math.max(...channels(hex)) - Math.min(...channels(hex));

describe("microcementColor", () => {
  it("takes most of the saturation out of strong wall colors", () => {
    for (const wall of ["#8f4333", "#5b1a2c", "#8a5a36", "#d8ccb5"]) {
      const result = microcementColor(wall);
      expect(result).toMatch(/^#[0-9a-f]{6}$/);
      expect(spread(result)).toBeLessThanOrEqual(spread(wall));
      expect(spread(result)).toBeLessThan(45);
    }
  });

  it("keeps light halls light and dark halls dark, without going to pure black or white", () => {
    expect(isDarkColor(microcementColor("#e7e2d8"))).toBe(false);
    expect(isDarkColor(microcementColor("#5b1a2c"))).toBe(true);
    expect(microcementColor("#000000")).not.toBe("#000000");
    expect(microcementColor("#ffffff")).not.toBe("#ffffff");
  });
});
