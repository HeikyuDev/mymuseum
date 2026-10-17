import { describe, expect, it } from "vitest";
import { readImageSize } from "./image-size";

function buffer(bytes: number[]): ArrayBuffer {
  const out = new Uint8Array(Math.max(bytes.length, 40));
  out.set(bytes);
  return out.buffer;
}

describe("readImageSize", () => {
  it("reads a JPEG frame header after other segments", () => {
    const exif = [0xff, 0xe1, 0x00, 0x06, 0, 0, 0, 0];
    const sof = [0xff, 0xc0, 0x00, 0x11, 0x08, 0x03, 0xe8, 0x09, 0x60, 0x03];
    expect(readImageSize(buffer([0xff, 0xd8, ...exif, ...sof]))).toEqual({ width: 2400, height: 1000 });
  });

  it("reads a PNG header", () => {
    const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 2, 0x58, 0, 0, 1, 0x2c];
    expect(readImageSize(buffer(png))).toEqual({ width: 600, height: 300 });
  });

  it("reads lossy, lossless and extended WebP headers", () => {
    const riff = [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50];
    const lossy = [...riff, 0x56, 0x50, 0x38, 0x20, 0, 0, 0, 0, 0, 0, 0, 0x9d, 0x01, 0x2a, 0x80, 0x02, 0xe0, 0x01];
    expect(readImageSize(buffer(lossy))).toEqual({ width: 640, height: 480 });
    const extended = [...riff, 0x56, 0x50, 0x38, 0x58, 0, 0, 0, 0, 0, 0, 0, 0, 0x7f, 0x02, 0, 0xdf, 0x01, 0];
    expect(readImageSize(buffer(extended))).toEqual({ width: 640, height: 480 });
  });

  it("returns null for unknown or truncated data", () => {
    expect(readImageSize(buffer([1, 2, 3]))).toBeNull();
    expect(readImageSize(buffer(new Array(40).fill(7)))).toBeNull();
  });
});
