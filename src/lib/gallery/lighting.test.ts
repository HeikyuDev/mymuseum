import { describe, expect, it } from "vitest";
import { BRIGHTNESS_MAX, BRIGHTNESS_MIN, clampBrightness, resolveHallLight, resolveHallStyle } from "@/lib/hall-style";
import { hallFieldsSchema } from "@/lib/validation/schemas";
import { photoLevel, zoneLighting, zoneLook } from "./scene-look";

describe("hall light resolution", () => {
  it("falls back to safe defaults for missing or invalid data", () => {
    expect(resolveHallLight(undefined)).toEqual({ lightMode: "default", brightness: 100 });
    expect(resolveHallLight({ lightMode: "blinding", brightness: "x" })).toEqual({ lightMode: "default", brightness: 100 });
    expect(resolveHallLight([1, 2])).toEqual({ lightMode: "default", brightness: 100 });
  });
  it("reads the mode and clamps brightness", () => {
    expect(resolveHallLight({ lightMode: "off", brightness: 10 })).toEqual({ lightMode: "off", brightness: BRIGHTNESS_MIN });
    expect(clampBrightness(500)).toBe(BRIGHTNESS_MAX);
    expect(resolveHallStyle({ decor: { plants: true, lightMode: "dim", brightness: 80 } }).decor).toEqual(["plants"]);
    expect(resolveHallStyle({ decor: { lightMode: "dim", brightness: 80 } })).toMatchObject({ lightMode: "dim", brightness: 80 });
  });
  it("validates the decor bag with Zod and keeps the light keys", () => {
    const base = {
      name: "Hall", description: null, is_visible: true, wall_style: "plaster", wall_color: null, floor_style: "parquet",
      floor_decoration: "none", floor_decoration_color: null, lighting_preset: "soft", default_frame_style: "minimal", accent_color: null,
    } as const;
    const ok = hallFieldsSchema.parse({ ...base, decor: { plants: true, lightMode: "off", brightness: 70 } });
    expect(ok.decor).toMatchObject({ plants: true, lightMode: "off", brightness: 70 });
    expect(hallFieldsSchema.safeParse({ ...base, decor: { lightMode: "nope" } }).success).toBe(false);
    expect(hallFieldsSchema.parse({ ...base, decor: { brightness: 999 } }).decor.brightness).toBe(BRIGHTNESS_MAX);
  });
});

describe("zoneLighting", () => {
  it("Off has no spotlights, glow or glare", () => {
    const off = zoneLighting("soft", "off");
    expect(off.spots).toBe(false);
    expect(off.spotIntensity).toBe(0);
    expect(off.glow).toBe(0);
    expect(off.shine).toBeLessThan(0.3);
  });
  it("modes order spotlight strength and brightness scales exposure", () => {
    expect(zoneLighting("soft", "soft").spotIntensity).toBeLessThan(zoneLighting("soft", "default").spotIntensity);
    expect(zoneLighting("soft", "dim").exposure).toBeLessThan(zoneLighting("soft", "default").exposure);
    expect(zoneLighting("soft", "default", 50).exposure).toBeCloseTo(zoneLighting("soft", "default", 100).exposure / 2);
  });
  it("the default is calmer than before (exposure well below 1)", () => {
    for (const preset of ["soft", "warm", "cold", "dramatic"] as const) expect(zoneLighting(preset).exposure).toBeLessThan(0.9);
  });
  it("photos stay true to color: the unlit level never exceeds 1 and stays high", () => {
    expect(photoLevel(zoneLighting("soft", "default", 120))).toBe(1);
    expect(photoLevel(zoneLighting("soft", "dim", 40))).toBeGreaterThan(0.75);
  });
  it("zones carry their mode into the look", () => {
    expect(zoneLook(resolveHallStyle({ decor: { lightMode: "off" } })).lighting.spots).toBe(false);
  });
});
