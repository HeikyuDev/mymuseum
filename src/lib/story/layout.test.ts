import { describe, expect, it } from "vitest";
import { contentRegion, STORY_FORMATS } from "./formats";
import { MAX_UPSCALE, captionMaxHeight, clampRatio, composeStory, computeFrameGeometry, layoutCaption, type MeasureFor } from "./layout";

const measureFor: MeasureFor = (_role, size) => (text) => text.length * size * 0.5;

describe("computeFrameGeometry", () => {
  it.each([0.25, 0.5, 0.75, 1, 1.5, 2, 4, 5])("fits ratio %s inside the box without distortion", (ratio) => {
    const g = computeFrameGeometry({ ratio, maxW: 900, maxH: 800, style: "wood", mat: true });
    expect(g.outerW).toBeLessThanOrEqual(900.001);
    expect(g.outerH).toBeLessThanOrEqual(800.001);
    expect(g.imgW / g.imgH).toBeCloseTo(ratio, 3);
  });
  it("scales mat and frame with the photo, so a panorama gets a slim border", () => {
    const pano = computeFrameGeometry({ ratio: 4, maxW: 900, maxH: 800, style: "minimal", mat: true });
    const square = computeFrameGeometry({ ratio: 1, maxW: 800, maxH: 800, style: "minimal", mat: true });
    expect(pano.matPad).toBeLessThan(square.matPad);
    expect(pano.matPad / pano.imgH).toBeCloseTo(square.matPad / square.imgH, 2);
  });
  it("has no mat for canvas wraps and no frame pad for glass", () => {
    expect(computeFrameGeometry({ ratio: 1, maxW: 500, maxH: 500, style: "canvas_wrap", mat: true })).toMatchObject({ pad: 0, matPad: 0 });
    expect(computeFrameGeometry({ ratio: 1, maxW: 500, maxH: 500, style: "floating_glass", mat: false }).pad).toBe(0);
  });
  it("caps upscaling of low resolution photos", () => {
    const g = computeFrameGeometry({ ratio: 4 / 3, maxW: 900, maxH: 900, style: "minimal", mat: true, source: { width: 120, height: 90 } });
    expect(g.imgW).toBeLessThanOrEqual(120 * MAX_UPSCALE + 0.001);
    expect(g.imgH).toBeLessThanOrEqual(90 * MAX_UPSCALE + 0.001);
  });
  it("survives absurd input", () => {
    expect(clampRatio(0)).toBeCloseTo(4 / 3);
    expect(clampRatio(1000)).toBe(5);
    const g = computeFrameGeometry({ ratio: Number.NaN, maxW: 0, maxH: 0, style: "gold", mat: true });
    expect(Number.isFinite(g.outerW) && Number.isFinite(g.outerH)).toBe(true);
  });
});

describe("safe zones", () => {
  it("keeps the story content out of the top 250 and bottom 340 px", () => {
    const region = contentRegion(STORY_FORMATS.story, false);
    expect(region.y).toBe(250);
    expect(region.y + region.h).toBe(1920 - 340);
  });
  it("stops above the floor when it is visible", () => {
    for (const format of Object.values(STORY_FORMATS)) {
      const region = contentRegion(format, true);
      expect(region.floorY).not.toBeNull();
      expect(region.y + region.h).toBeLessThan(region.floorY as number);
    }
  });
});

describe("composeStory", () => {
  it.each(Object.values(STORY_FORMATS))("keeps art, caption and watermark inside the region ($id)", (format) => {
    for (const ratio of [0.3, 0.75, 1, 1.5, 4]) {
      const captionHeight = captionMaxHeight(format, false, true);
      const c = composeStory({ format, hasFloor: false, ratio, frameStyle: "wood", mat: true, captionHeight, watermark: true });
      expect(c.art.y).toBeGreaterThanOrEqual(c.region.y - 0.001);
      expect(c.art.x).toBeGreaterThanOrEqual(c.region.x - 0.001);
      expect(c.art.x + c.art.w).toBeLessThanOrEqual(c.region.x + c.region.w + 0.001);
      expect(c.caption.y + c.caption.h).toBeLessThanOrEqual(c.region.y + c.region.h + 0.001);
      expect(c.watermarkY).not.toBeNull();
    }
  });
  it("centers the artwork horizontally", () => {
    const c = composeStory({ format: STORY_FORMATS.story, hasFloor: false, ratio: 1, frameStyle: "minimal", mat: true, captionHeight: 150, watermark: false });
    expect(c.art.x + c.art.w / 2).toBeCloseTo(540, 3);
  });
});

describe("layoutCaption", () => {
  const base = { style: "elegant" as const, format: STORY_FORMATS.story, maxWidth: 936, maxHeight: 400, measureFor };

  it("shows only the title and a discreet year by default", () => {
    const layout = layoutCaption({ ...base, texts: { title: "The Last Supper", detail: "2025", description: "" } });
    expect(layout.blocks.map((b) => b.role)).toEqual(["title", "rule", "detail"]);
    expect(layout.blocks[2].size).toBeLessThan(layout.blocks[0].size / 1.5);
  });
  it("omits the detail line when there is no year", () => {
    const layout = layoutCaption({ ...base, texts: { title: "Sunday", detail: "", description: "" } });
    expect(layout.blocks.map((b) => b.role)).toEqual(["title"]);
  });
  it("renders nothing for empty text", () => {
    expect(layoutCaption({ ...base, texts: { title: "", detail: "", description: "" } }).height).toBe(0);
  });
  it("never exceeds the allowed box with very long text", () => {
    const long = "word ".repeat(200);
    const layout = layoutCaption({ ...base, texts: { title: long, detail: "1999", description: long } });
    expect(layout.height).toBeLessThanOrEqual(400);
    const title = layout.blocks.find((b) => b.role === "title");
    expect(title?.lines.length).toBeLessThanOrEqual(2);
    expect(title?.lines.every((l) => measureFor("title", title.size)(l) <= 936)).toBe(true);
  });
  it("drops the optional description before shrinking the title when space is tight", () => {
    const tight = layoutCaption({
      ...base,
      maxHeight: 190,
      texts: { title: "A title", detail: "", description: "A long description text that needs room. ".repeat(6) },
    });
    expect(tight.blocks.find((b) => b.role === "title")?.size).toBe(STORY_FORMATS.story.type.titleMax);
    expect(tight.height).toBeLessThanOrEqual(190);
  });
  it("pads the plaque style", () => {
    const layout = layoutCaption({ ...base, style: "plaque", texts: { title: "Short", detail: "", description: "" } });
    expect(layout.padding).toBeGreaterThan(0);
    expect(layout.height).toBeGreaterThan(layout.contentHeight);
    expect(layout.width).toBeLessThanOrEqual(936);
  });
});
