import { describe, expect, it } from "vitest";
import { supersampleLadder } from "./limits";

describe("supersampleLadder", () => {
  it("tries the requested factor first and falls back to smaller ones", () => {
    expect(supersampleLadder(1.5, 1080, 1920, 1, 16384)).toEqual([1.5, 1.25, 1]);
    expect(supersampleLadder(1, 1080, 1920, 1, 16384)).toEqual([1]);
  });

  it("drops factors whose render would exceed the GPU limit", () => {
    // 1920 * 1.5 = 2880 > 2048, 1920 * 1.25 = 2400 > 2048, 1920 fits
    expect(supersampleLadder(1.5, 1080, 1920, 1, 2048)).toEqual([1]);
  });

  it("is empty when even 1x does not fit, so the caller can report it", () => {
    expect(supersampleLadder(1.5, 1080, 1920, 1, 1024)).toEqual([]);
  });
});
