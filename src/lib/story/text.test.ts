import { describe, expect, it } from "vitest";
import { ellipsize, fitText, normalizeText, trackedWidth, wrapLines } from "./text";

// Every character is 10px wide.
const mono = (s: string) => s.length * 10;
const monoAt = (size: number) => (s: string) => s.length * size;

describe("wrapLines", () => {
  it("wraps on word boundaries", () => {
    expect(wrapLines("one two three four", 100, mono, 5).lines).toEqual(["one two", "three four"]);
  });
  it("ellipsizes the last line when over the limit", () => {
    const result = wrapLines("alpha beta gamma delta epsilon zeta", 100, mono, 2);
    expect(result.truncated).toBe(true);
    expect(result.lines).toHaveLength(2);
    expect(result.lines[1].endsWith("…")).toBe(true);
    expect(mono(result.lines[1])).toBeLessThanOrEqual(100);
  });
  it("breaks words longer than the line", () => {
    const result = wrapLines("supercalifragilistic", 80, mono, 5);
    expect(result.lines.every((line) => mono(line) <= 80)).toBe(true);
    expect(result.lines.join("")).toBe("supercalifragilistic");
  });
  it("handles empty text and zero lines", () => {
    expect(wrapLines("   ", 100, mono, 2)).toEqual({ lines: [], truncated: false });
    expect(wrapLines("abc", 100, mono, 0).truncated).toBe(true);
  });
  it("collapses whitespace and newlines", () => {
    expect(normalizeText(" a \n\n b\t c ")).toBe("a b c");
  });
});

describe("ellipsize", () => {
  it("leaves short text alone", () => expect(ellipsize("hello", 100, mono)).toBe("hello"));
  it("never overflows", () => expect(mono(ellipsize("hello world again", 70, mono))).toBeLessThanOrEqual(70));
});

describe("fitText", () => {
  it("uses the largest size that fits", () => {
    const r = fitText({ text: "hello world", maxWidth: 200, maxLines: 1, minSize: 10, maxSize: 30, measureAt: monoAt });
    // 11 chars * size <= 200 means size <= 18; steps of 2 from 30.
    expect(r.size).toBe(18);
    expect(r.truncated).toBe(false);
  });
  it("wraps to a second line when allowed", () => {
    const r = fitText({ text: "hello wonderful world", maxWidth: 200, maxLines: 2, minSize: 10, maxSize: 30, measureAt: monoAt });
    expect(r.lines.length).toBeLessThanOrEqual(2);
    expect(r.truncated).toBe(false);
  });
  it("truncates at the minimum size instead of overflowing", () => {
    const r = fitText({ text: `${"x".repeat(200)} tail`, maxWidth: 100, maxLines: 2, minSize: 10, maxSize: 20, measureAt: monoAt });
    expect(r.size).toBe(10);
    expect(r.truncated).toBe(true);
    expect(r.lines.every((line) => line.length * 10 <= 100)).toBe(true);
  });
});

describe("trackedWidth", () => {
  it("adds tracking between characters only", () => {
    expect(trackedWidth("abc", 4, mono)).toBe(38);
    expect(trackedWidth("", 4, mono)).toBe(0);
  });
});
