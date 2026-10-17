// Reads the pixel size of a JPEG, PNG or WebP from its first bytes, so a photo can be decoded straight to
// its target size. `createImageBitmap(bitmap, { resize })` runs synchronously on the main thread (about 50 ms
// for a 2400 px photo on a phone), while `createImageBitmap(blob, { resize })` decodes and resizes in the
// background. Only the second form needs to know the size up front.

export type ImageSize = { width: number; height: number };

const u16 = (v: DataView, o: number) => v.getUint16(o, false);

function jpeg(v: DataView): ImageSize | null {
  let o = 2;
  while (o + 9 < v.byteLength) {
    if (v.getUint8(o) !== 0xff) {
      o += 1;
      continue;
    }
    const marker = v.getUint8(o + 1);
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      o += 2;
      continue;
    }
    if (marker === 0xff) {
      o += 1;
      continue;
    }
    const length = u16(v, o + 2);
    const isFrame = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isFrame) return { height: u16(v, o + 5), width: u16(v, o + 7) };
    o += 2 + length;
  }
  return null;
}

function png(v: DataView): ImageSize | null {
  if (v.byteLength < 24) return null;
  return { width: v.getUint32(16, false), height: v.getUint32(20, false) };
}

function webp(v: DataView): ImageSize | null {
  if (v.byteLength < 30) return null;
  const tag = String.fromCharCode(v.getUint8(12), v.getUint8(13), v.getUint8(14), v.getUint8(15));
  if (tag === "VP8 ") return { width: v.getUint16(26, true) & 0x3fff, height: v.getUint16(28, true) & 0x3fff };
  if (tag === "VP8L") {
    const bits = v.getUint32(21, true);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  if (tag === "VP8X") {
    const w = v.getUint8(24) | (v.getUint8(25) << 8) | (v.getUint8(26) << 16);
    const h = v.getUint8(27) | (v.getUint8(28) << 8) | (v.getUint8(29) << 16);
    return { width: w + 1, height: h + 1 };
  }
  return null;
}

/** Pixel size from the header bytes, or null when the format is unknown or truncated. */
export function readImageSize(bytes: ArrayBuffer): ImageSize | null {
  const v = new DataView(bytes);
  if (v.byteLength < 12) return null;
  try {
    if (v.getUint16(0, false) === 0xffd8) return jpeg(v);
    if (v.getUint32(0, false) === 0x89504e47) return png(v);
    if (v.getUint32(0, false) === 0x52494646 && v.getUint32(8, false) === 0x57454250) return webp(v);
  } catch {
    return null;
  }
  return null;
}
