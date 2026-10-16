import { describe, expect, it } from "vitest";
import { resolveHallStyle } from "@/lib/hall-style";
import { analyzePhoto, type PhotoStats } from "./color";
import {
  DEFAULT_STYLE_OPTIONS,
  defaultCaptionTexts,
  parseScene,
  parseStoredOptions,
  resolveStoryPlan,
  type StoryArtworkInfo,
  type StoryHallInfo,
  type StoryStyleOptions,
} from "./plan";

const halls: StoryHallInfo[] = [
  { id: "a", name: "White", style: resolveHallStyle({}) },
  { id: "b", name: "Velvet", style: resolveHallStyle({ wall_style: "velvet", lighting_preset: "dramatic", floor_decoration: "red_carpet" }) },
  { id: "c", name: "Brick", style: resolveHallStyle({ wall_style: "brick" }) },
];
const artwork: StoryArtworkInfo = {
  title: "The Last Supper",
  year: 2025,
  imageUrl: "x",
  aspect: 1.5,
  frameStyle: "minimal",
  frameColor: null,
  mat: false,
  matColor: null,
};
const museum = { title: "Fernandez", slug: "fernandez", accent: "#c9a227", fontPairing: "classic" as const };

const plan = (options: Partial<StoryStyleOptions> = {}, hallId: string | null = "a", stats: PhotoStats | null = null) =>
  resolveStoryPlan({
    options: { ...DEFAULT_STYLE_OPTIONS, ...options },
    texts: defaultCaptionTexts(artwork),
    artwork,
    halls,
    hallId,
    museum,
    stats,
  });

describe("defaultCaptionTexts", () => {
  it("uses the artwork title and only the year as a detail, never the author", () => {
    expect(defaultCaptionTexts({ title: "  Sunday  ", year: 1999 })).toEqual({ title: "Sunday", detail: "1999", description: "" });
    expect(defaultCaptionTexts({ title: "Sunday", year: null }).detail).toBe("");
  });
});

describe("resolveStoryPlan", () => {
  it("uses the artwork's hall wall in auto mode", () => {
    expect(plan({}, "b").wall.style).toBe("velvet");
    expect(plan({}, "b").lighting.tint).toBe("255, 240, 215");
  });
  it("lets the owner pick another hall or a preset wall", () => {
    expect(plan({ scene: "hall:c" }, "a").wall.style).toBe("brick");
    expect(plan({ scene: "wall:marble" }, "a").wall.style).toBe("marble");
    expect(plan({ scene: "wall:custom_color" }, "a").wall.style).toBe("plaster");
    expect(parseScene("hall:missing", halls, "b").wallStyle).toBe("velvet");
  });
  it("turns on a wide mat for photos by default and respects off", () => {
    expect(plan().mat).not.toBeNull();
    expect(plan({ mat: "off" }).mat).toBeNull();
  });
  it("gives the minimal frame a color that contrasts with the wall", () => {
    expect(plan({}, "a").frame.color).toBe("#1b1b1b");
    expect(plan({}, "b").frame.color).toBe("#f6f3ec");
    expect(plan({ frameColor: "#336699" }).frame.color).toBe("#336699");
  });
  it("shows the floor only when asked", () => {
    expect(plan().floor).toBeNull();
    expect(plan({ showFloor: true }, "b").floor?.decoration).toBe("red_carpet");
  });
  it("switches spotlight and vignette off independently", () => {
    const p = plan({ spotlight: false, vignette: false });
    expect(p.lighting.cone).toBe(0);
    expect(p.lighting.vignette).toBe(0);
  });
  it("uses a plaque on busy walls and the handwritten style for the handwritten pairing", () => {
    expect(plan({}, "c").caption.style).toBe("plaque");
    expect(plan({}, "a").caption.style).toBe("elegant");
    const hand = resolveStoryPlan({
      options: DEFAULT_STYLE_OPTIONS,
      texts: defaultCaptionTexts(artwork),
      artwork,
      halls,
      hallId: "a",
      museum: { ...museum, fontPairing: "handwritten" },
      stats: null,
    });
    expect(hand.caption.style).toBe("handwritten");
  });
  it("adds the museum watermark by default and removes it when disabled", () => {
    expect(plan().watermark).toBe("Fernandez");
    expect(plan({ watermark: false }).watermark).toBeNull();
  });
  it("dims a bright wall behind a bright photo", () => {
    const bright = analyzePhoto(Array.from({ length: 50 }, () => [245, 245, 240, 255]).flat());
    expect(plan({}, "a", bright).wall.dim).toBeGreaterThan(0);
    expect(plan({ wallTint: "none" }, "a", bright).wall.dim).toBe(0);
  });
  it("applies a custom wall tint", () => {
    expect(plan({ wallTint: "custom", wallTintColor: "#336699" }).wall.tint?.color).toBe("#336699");
  });
});

describe("parseStoredOptions", () => {
  it("accepts valid stored options", () => {
    expect(parseStoredOptions({ ...DEFAULT_STYLE_OPTIONS, format: "post", grain: false }).format).toBe("post");
  });
  it("falls back per field when a value is invalid", () => {
    const parsed = parseStoredOptions({ format: "huge", mat: "on", frameColor: "red", grain: "yes" });
    expect(parsed.format).toBe("story");
    expect(parsed.mat).toBe("on");
    expect(parsed.frameColor).toBeNull();
    expect(parsed.grain).toBe(true);
  });
  it("ignores garbage", () => {
    expect(parseStoredOptions("nope")).toEqual(DEFAULT_STYLE_OPTIONS);
    expect(parseStoredOptions(null)).toEqual(DEFAULT_STYLE_OPTIONS);
  });
});
