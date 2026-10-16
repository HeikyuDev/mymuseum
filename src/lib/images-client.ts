import {
  MAX_UPLOAD_BYTES,
  OUTPUT_QUALITY,
  THUMB_MAX_SIDE,
  THUMB_QUALITY,
  aspectRatioOf,
  extensionFor,
  fitWithin,
  validateImageFile,
} from "@/lib/images";

export type PreparedImage = {
  blob: Blob;
  contentType: string;
  extension: string;
  width: number;
  height: number;
  aspectRatio: number;
  /** 640px WebP copy for the 3D viewer, or null when the browser cannot encode one. */
  thumb: Blob | null;
};

function canvasToBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, OUTPUT_QUALITY));
}

/** Small WebP copy of the image (best effort: null when anything fails). */
async function makeThumb(bitmap: ImageBitmap): Promise<Blob | null> {
  try {
    const target = fitWithin(bitmap.width, bitmap.height, THUMB_MAX_SIDE);
    const canvas = document.createElement("canvas");
    canvas.width = target.width;
    canvas.height = target.height;
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, target.width, target.height);
    context.imageSmoothingQuality = "high";
    context.drawImage(bitmap, 0, 0, target.width, target.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", THUMB_QUALITY));
    return blob && blob.type === "image/webp" ? blob : null;
  } catch {
    return null;
  }
}

/**
 * Validates and prepares a file for upload (browser only). Images whose long
 * side exceeds 2400px are redrawn on a canvas and re-encoded as WebP (JPEG when
 * the browser cannot encode WebP) at quality 0.85. Images that already fit are
 * uploaded untouched. Throws an Error whose message is a code (see translateCode).
 */
export async function prepareImage(file: File): Promise<PreparedImage> {
  const problem = validateImageFile(file);
  if (problem) throw new Error(problem);

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error("img.unreadable");
  }

  try {
    const thumb = await makeThumb(bitmap);
    const target = fitWithin(bitmap.width, bitmap.height);
    if (!target.scaled) {
      return {
        blob: file,
        contentType: file.type,
        extension: extensionFor(file.type) ?? "jpg",
        width: bitmap.width,
        height: bitmap.height,
        aspectRatio: aspectRatioOf(bitmap.width, bitmap.height),
        thumb,
      };
    }

    const canvas = document.createElement("canvas");
    canvas.width = target.width;
    canvas.height = target.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("img.browser");
    context.imageSmoothingQuality = "high";
    context.drawImage(bitmap, 0, 0, target.width, target.height);

    let blob = await canvasToBlob(canvas, "image/webp");
    if (!blob || blob.type !== "image/webp") {
      // Browsers without a WebP encoder return PNG; use JPEG on a white backdrop instead.
      context.globalCompositeOperation = "destination-over";
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, target.width, target.height);
      blob = await canvasToBlob(canvas, "image/jpeg");
    }
    if (!blob) throw new Error("img.processing");
    if (blob.size > MAX_UPLOAD_BYTES) throw new Error("img.stillTooLarge");

    return {
      blob,
      contentType: blob.type,
      extension: extensionFor(blob.type) ?? "jpg",
      width: target.width,
      height: target.height,
      aspectRatio: aspectRatioOf(target.width, target.height),
      thumb,
    };
  } finally {
    bitmap.close();
  }
}
