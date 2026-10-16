import { describe, expect, it } from "vitest";
import { composePhoto, rowOfWallHeight } from "./compose";
import { PHOTO_FORMATS, PHOTO_FORMAT_IDS, isFormatId } from "./formats";

const subject = { width: 1.7, height: 1.4, focusY: 1.45 };

describe("PHOTO_FORMATS", () => {
  it("uses the standard sizes and story safe zones", () => {
    expect(PHOTO_FORMATS.story).toMatchObject({ width: 1080, height: 1920, safe: { top: 250, bottom: 340 } });
    expect(PHOTO_FORMATS.post).toMatchObject({ width: 1080, height: 1350 });
    expect(PHOTO_FORMATS.square).toMatchObject({ width: 1080, height: 1080 });
    expect(isFormatId("story")).toBe(true);
    expect(isFormatId("nope")).toBe(false);
  });
});

describe("composePhoto", () => {
  it.each(PHOTO_FORMAT_IDS)("centres the subject inside the safe area (%s)", (id) => {
    const format = PHOTO_FORMATS[id];
    const composition = composePhoto(format, subject);
    const row = rowOfWallHeight(format, composition, subject.focusY);
    expect(row).toBeCloseTo(composition.focusRow, 4);
    const top = rowOfWallHeight(format, composition, subject.focusY + subject.height / 2);
    const bottom = rowOfWallHeight(format, composition, subject.focusY - subject.height / 2);
    expect(top).toBeGreaterThanOrEqual(format.safe.top - 1e-6);
    expect(bottom).toBeLessThanOrEqual(format.height - format.safe.bottom + 1e-6);
  });

  it("keeps the subject within the side margins for very wide panoramas", () => {
    const format = PHOTO_FORMATS.story;
    const wide = { width: 2.6, height: 0.7, focusY: 1.5 };
    const composition = composePhoto(format, wide);
    expect(wide.width * composition.pixelsPerMeter).toBeLessThanOrEqual(format.width - 2 * format.safe.side);
  });

  it("backs away further for bigger subjects", () => {
    const small = composePhoto(PHOTO_FORMATS.post, { width: 0.8, height: 0.8, focusY: 1.5 });
    const big = composePhoto(PHOTO_FORMATS.post, { width: 2.4, height: 1.6, focusY: 1.5 });
    expect(big.distance).toBeGreaterThan(small.distance);
  });

  it("shows a strip of floor below the subject without pitching the camera", () => {
    const format = PHOTO_FORMATS.post;
    const composition = composePhoto(format, subject);
    const floorRow = rowOfWallHeight(format, composition, 0);
    expect(floorRow).toBeLessThan(format.height);
  });
});
