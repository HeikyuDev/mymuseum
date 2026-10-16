import { describe, expect, it } from "vitest";
import { aspectRatioOf, fitWithin, titleFromFileName, validateImageFile } from "./images";

describe("fitWithin", () => {
  it("keeps images that already fit", () => {
    expect(fitWithin(1200, 800)).toEqual({ width: 1200, height: 800, scaled: false });
  });

  it("scales the long side down to the limit", () => {
    expect(fitWithin(4800, 3200)).toEqual({ width: 2400, height: 1600, scaled: true });
    expect(fitWithin(3000, 6000)).toEqual({ width: 1200, height: 2400, scaled: true });
  });
});

describe("aspectRatioOf", () => {
  it("rounds to four decimals", () => {
    expect(aspectRatioOf(1600, 900)).toBe(1.7778);
  });
});

describe("validateImageFile", () => {
  it("accepts supported types under 10 MB", () => {
    expect(validateImageFile({ type: "image/webp", size: 1000 })).toBeNull();
  });
  it("rejects unsupported types, oversized and empty files", () => {
    expect(validateImageFile({ type: "image/gif", size: 1000 })).not.toBeNull();
    expect(validateImageFile({ type: "image/png", size: 10 * 1024 * 1024 + 1 })).not.toBeNull();
    expect(validateImageFile({ type: "image/png", size: 0 })).not.toBeNull();
  });
});

describe("titleFromFileName", () => {
  it("humanizes file names", () => {
    expect(titleFromFileName("sunset_over-sea.JPG")).toBe("sunset over sea");
    expect(titleFromFileName(".png")).toBe("Untitled");
    expect(titleFromFileName(".png", "Sin título")).toBe("Sin título");
  });
});
