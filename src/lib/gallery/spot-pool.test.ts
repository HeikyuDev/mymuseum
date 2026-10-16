import { describe, expect, it } from "vitest";
import { isFarFrom, nearestIndices } from "./spot-pool";

describe("nearestIndices", () => {
  const xs = [0, 2, 4, 9, 10];
  it("returns the nearest values in order of distance", () => {
    const out = new Int32Array(3);
    expect(nearestIndices(xs, 3.4, out)).toBe(3);
    expect([...out]).toEqual([2, 1, 0]);
  });
  it("handles the ends and short lists", () => {
    const out = new Int32Array(4);
    expect(nearestIndices(xs, -5, out)).toBe(4);
    expect([...out]).toEqual([0, 1, 2, 3]);
    expect(nearestIndices([5], 1, out)).toBe(1);
    expect(nearestIndices([], 1, out)).toBe(0);
  });
});

describe("isFarFrom", () => {
  it("detects ranges outside the visibility distance", () => {
    expect(isFarFrom(0, 30, 40, 24)).toBe(true);
    expect(isFarFrom(10, 30, 40, 24)).toBe(false);
    expect(isFarFrom(100, 30, 40, 24)).toBe(true);
  });
});
