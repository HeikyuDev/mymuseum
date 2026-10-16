import { describe, expect, it } from "vitest";
import { buildFilename, slugify } from "./filename";

describe("slugify", () => {
  it("lowercases, folds accents and hyphenates", () => {
    expect(slugify("La Última Cena!")).toBe("la-ultima-cena");
  });
  it("falls back when nothing usable remains", () => {
    expect(slugify("!!!", "artwork")).toBe("artwork");
    expect(slugify("日本語", "museum")).toBe("museum");
  });
  it("caps the length without a trailing hyphen", () => {
    const slug = slugify(`${"a".repeat(30)} ${"b".repeat(30)}`, "x", 31);
    expect(slug.length).toBeLessThanOrEqual(31);
    expect(slug.endsWith("-")).toBe(false);
  });
});

describe("buildFilename", () => {
  it("follows {museum}-{artwork}-{format}.{ext}", () => {
    expect(buildFilename({ museumSlug: "fernandez", artworkTitle: "The Last Supper", format: "story", extension: "png" })).toBe(
      "fernandez-the-last-supper-story.png",
    );
    expect(buildFilename({ museumSlug: "m", artworkTitle: "", format: "square", extension: "jpg" })).toBe("m-artwork-square.jpg");
  });
});
