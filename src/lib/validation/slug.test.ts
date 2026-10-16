import { describe, expect, it } from "vitest";
import { slugify, uniqueHallSlug, validateSlug } from "./slug";

describe("validateSlug", () => {
  it("accepts valid slugs", () => {
    expect(validateSlug("my-museum")).toBeNull();
    expect(validateSlug("a1b")).toBeNull();
  });

  it("returns message codes with their limits", () => {
    expect(validateSlug("ab")).toBe("val.slugMin:3");
    expect(validateSlug("a".repeat(41))).toBe("val.slugMax:40");
    expect(validateSlug("Upper")).toBe("val.slugFormat");
  });

  it("rejects malformed slugs", () => {
    expect(validateSlug("ab")).not.toBeNull();
    expect(validateSlug("a".repeat(41))).not.toBeNull();
    expect(validateSlug("Upper")).not.toBeNull();
    expect(validateSlug("two--hyphens")).not.toBeNull();
    expect(validateSlug("-leading")).not.toBeNull();
    expect(validateSlug("trailing-")).not.toBeNull();
    expect(validateSlug("has space")).not.toBeNull();
  });

  it("rejects reserved slugs", () => {
    for (const slug of ["admin", "studio", "login", "logout", "api", "assets"]) {
      expect(validateSlug(slug)).toBe("val.slugReserved");
    }
  });
});

describe("slugify", () => {
  it("normalizes accents, case and punctuation", () => {
    expect(slugify("Museo de Arte Moderno!")).toBe("museo-de-arte-moderno");
    expect(slugify("  Café  ")).toBe("cafe");
  });

  it("respects the max length without a trailing hyphen", () => {
    const result = slugify("word ".repeat(30), 12);
    expect(result.length).toBeLessThanOrEqual(12);
    expect(result.endsWith("-")).toBe(false);
  });
});

describe("uniqueHallSlug", () => {
  it("adds a numeric suffix on collision", () => {
    expect(uniqueHallSlug("Main Hall", ["main-hall"])).toBe("main-hall-2");
    expect(uniqueHallSlug("Main Hall", ["main-hall", "main-hall-2"])).toBe("main-hall-3");
  });

  it("falls back for names without usable characters", () => {
    expect(uniqueHallSlug("!!!", [])).toBe("hall");
  });
});
