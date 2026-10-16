import {
  MAX_UPLOAD_BYTES,
  OUTPUT_QUALITY,
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
};

function canvasToBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, OUTPUT_QUALITY));
}

/**
 * Validates and prepares a file for upload (browser only). Images whose long
 * side exceeds 2400px are redrawn on a canvas and re-encoded as WebP (JPEG when
 * the browser cannot encode WebP) at quality 0.85. Images that already fit are
 * uploaded untouched. Throws an Error with a user facing message.
 */
export async function prepareImage(file: File): Promise<PreparedImage> {
  const problem = validateImageFile(file);
  if (problem) throw new Error(problem);

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error("This image could not be read. It may be corrupted.");
  }

  try {
    const target = fitWithin(bitmap.width, bitmap.height);
    if (!target.scaled) {
      return {
        blob: file,
        contentType: file.type,
        extension: extensionFor(file.type) ?? "jpg",
        width: bitmap.width,
        height: bitmap.height,
        aspectRatio: aspectRatioOf(bitmap.width, bitmap.height),
      };
    }

    const canvas = document.createElement("canvas");
    canvas.width = target.width;
    canvas.height = target.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Your browser cannot process images.");
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
    if (!blob) throw new Error("This image could not be processed.");
    if (blob.size > MAX_UPLOAD_BYTES) throw new Error("This image is still larger than 10 MB after resizing.");

    return {
      blob,
      contentType: blob.type,
      extension: extensionFor(blob.type) ?? "jpg",
      width: target.width,
      height: target.height,
      aspectRatio: aspectRatioOf(target.width, target.height),
    };
  } finally {
    bitmap.close();
  }
}
