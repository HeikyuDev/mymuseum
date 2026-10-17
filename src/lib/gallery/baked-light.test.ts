import { describe, expect, it } from "vitest";
import { darkness, floorLightInto, wallLightInto, type BakedLight, type BakedSpot } from "./baked-light";

const spots: BakedSpot[] = [{ x: 4, halfWidth: 0.8 }, { x: 8, halfWidth: 0.6 }];
const out = (): BakedLight => ({ gain: 0, pool: 0 });

describe("wallLightInto", () => {
  it("is brightest behind an artwork at eye level and falls off sideways", () => {
    const behind = wallLightInto(out(), 4, 1.85, 3.9, spots, 1);
    const between = wallLightInto(out(), 6, 1.85, 3.9, spots, 1);
    const far = wallLightInto(out(), 20, 1.85, 3.9, spots, 1);
    expect(behind.gain).toBeGreaterThan(between.gain);
    expect(between.gain).toBeGreaterThanOrEqual(far.gain);
    expect(behind.pool).toBeGreaterThan(0.8);
    expect(far.pool).toBeLessThan(0.01);
  });

  it("darkens toward the ceiling and the baseboard", () => {
    const eye = wallLightInto(out(), 20, 1.8, 3.9, [], 1).gain;
    expect(wallLightInto(out(), 20, 3.85, 3.9, [], 1).gain).toBeLessThan(eye);
    expect(wallLightInto(out(), 20, 0.02, 3.9, [], 1).gain).toBeLessThan(eye);
  });

  it("shows no pools when the hall light is off, but keeps the room evenly lit", () => {
    const flat = wallLightInto(out(), 4, 1.85, 3.9, spots, 0);
    expect(flat.pool).toBe(0);
    expect(flat.gain).toBeGreaterThan(0.85);
    expect(wallLightInto(out(), 4, 1.85, 3.9, spots, 0).gain).toBeCloseTo(wallLightInto(out(), 12, 1.85, 3.9, spots, 0).gain, 6);
  });

  it("keeps the gain in a sane range", () => {
    for (let x = -2; x < 14; x += 0.5) {
      for (let y = 0; y <= 3.9; y += 0.3) {
        const light = wallLightInto(out(), x, y, 3.9, spots, 1);
        expect(light.gain).toBeGreaterThan(0.2);
        expect(light.gain).toBeLessThan(1.7);
      }
    }
  });
});

describe("floorLightInto", () => {
  it("is lit in front of the artworks and darker toward the back of the room", () => {
    const front = floorLightInto(out(), 4, 1.5, 8, spots, 1);
    const back = floorLightInto(out(), 4, 7.5, 8, spots, 1);
    expect(front.gain).toBeGreaterThan(back.gain);
    expect(back.gain).toBeGreaterThan(0.3);
  });

  it("is darker where the floor meets the wall", () => {
    expect(floorLightInto(out(), 20, 0.02, 8, [], 1).gain).toBeLessThan(floorLightInto(out(), 20, 1.5, 8, [], 1).gain);
  });
});

describe("dark surfaces", () => {
  it("rates velvet darker than plaster", () => {
    expect(darkness("#5b1a2c")).toBeGreaterThan(darkness("#e7e2d8"));
    expect(darkness("#ffffff")).toBe(0);
    expect(darkness("#000000")).toBe(1);
  });

  it("lights the pool behind an artwork more strongly on a dark wall, so velvet does not stay black", () => {
    const light = wallLightInto(out(), 4, 1.85, 3.9, spots, 1, 0).gain;
    const dark = wallLightInto(out(), 4, 1.85, 3.9, spots, 1, darkness("#5b1a2c")).gain;
    expect(dark).toBeGreaterThan(light * 1.4);
  });
});
