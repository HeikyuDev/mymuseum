import { describe, expect, it } from "vitest";
import { resolveFrameStyle } from "./viewer-model";
import { resolveHallStyle } from "./hall-style";
import { resolveMuseumTheme } from "./theme";

describe("resolveFrameStyle", () => {
  it("keeps an explicit frame style", () => {
    expect(resolveFrameStyle("gold", "minimal")).toBe("gold");
  });
  it("inherits the hall default when the artwork has none", () => {
    expect(resolveFrameStyle(null, "black_gallery")).toBe("black_gallery");
    expect(resolveFrameStyle("unknown", "wood")).toBe("wood");
  });
});

describe("resolveHallStyle", () => {
  it("falls back to white gallery defaults", () => {
    const style = resolveHallStyle({});
    expect(style.wallStyle).toBe("plaster");
    expect(style.lighting).toBe("soft");
    expect(style.decor).toEqual([]);
  });
  it("degrades custom_color without a valid color", () => {
    expect(resolveHallStyle({ wall_style: "custom_color", wall_color: "nope" }).wallStyle).toBe("plaster");
  });
  it("reads decor toggles from the jsonb bag", () => {
    expect(resolveHallStyle({ decor: { plants: true, benches: false } }).decor).toEqual(["plants"]);
  });
});

describe("resolveMuseumTheme", () => {
  it("resolves defaults and overrides", () => {
    const theme = resolveMuseumTheme({ theme_overrides: { radius: "round", motion: "bogus" } });
    expect(theme.overrides.radius).toBe("round");
    expect(theme.overrides.motion).toBe("normal");
  });
  it("allows visitor exports by default and respects an explicit opt-out", () => {
    expect(resolveMuseumTheme({}).overrides.allowVisitorExport).toBe(true);
    expect(resolveMuseumTheme({ theme_overrides: { radius: "soft" } }).overrides.allowVisitorExport).toBe(true);
    expect(resolveMuseumTheme({ theme_overrides: { allowVisitorExport: false } }).overrides.allowVisitorExport).toBe(false);
    expect(resolveMuseumTheme({ theme_overrides: { allowVisitorExport: "no" } }).overrides.allowVisitorExport).toBe(true);
  });
  it("defaults the museum language to Spanish and honors defaultLocale", () => {
    expect(resolveMuseumTheme({}).overrides.defaultLocale).toBe("es");
    expect(resolveMuseumTheme({ theme_overrides: { defaultLocale: "en" } }).overrides.defaultLocale).toBe("en");
    expect(resolveMuseumTheme({ theme_overrides: { defaultLocale: "fr" } }).overrides.defaultLocale).toBe("es");
  });
});
