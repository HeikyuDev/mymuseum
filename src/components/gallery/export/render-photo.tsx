import { createElement } from "react";
import { ACESFilmicToneMapping, PCFSoftShadowMap, SRGBColorSpace } from "three";
import { loadCanvasFonts, resolveCanvasFonts } from "@/lib/fonts-client";
import { QUALITY } from "@/lib/gallery/quality";
import { lightingPreset } from "@/lib/gallery/scene-look";
import { composePhoto } from "@/lib/photo/compose";
import { PHOTO_FORMATS, type PhotoFormatId } from "@/lib/photo/formats";
import type { ViewerMuseum } from "@/lib/viewer-model";
import type { LightingPreset } from "@/types/database";
import { buildGalleryModel, GalleryScene, focusArtworkOf } from "../GalleryScene";
import { finishPhoto } from "./finish";

export type PhotoRequest = {
  museum: ViewerMuseum;
  artworkId: string;
  format: PhotoFormatId;
  /** Output width relative to the format (1 = 1080px wide). Previews use less. */
  outputScale: number;
  /** Internal render multiplier for anti-aliasing; falls back automatically when memory is short. */
  supersample: number;
  lighting: LightingPreset | null;
  vignette: boolean;
  grain: boolean;
  watermark: boolean;
  otherLabel: string;
  signal?: AbortSignal;
};

export type PhotoErrorCode = "webgl" | "photo" | "aborted" | "unknown";

export class PhotoRenderError extends Error {
  constructor(
    readonly code: PhotoErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "PhotoRenderError";
  }
}

const SETTLE_TIMEOUT_MS = 20000;

const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function renderOnce(request: PhotoRequest, supersample: number): Promise<HTMLCanvasElement> {
  const { createRoot } = await import("@react-three/fiber");
  const { museum, artworkId, format: formatId } = request;
  const format = PHOTO_FORMATS[formatId];

  const fonts = resolveCanvasFonts(museum.theme.fontPairing);
  await loadCanvasFonts(fonts, museum.title);

  const base = buildGalleryModel(museum);
  const model = request.lighting
    ? { ...base, looks: base.looks.map((look) => ({ ...look, lighting: lightingPreset(request.lighting!) })) }
    : base;
  const placement = model.layout.artworks.find((item) => item.id === artworkId);
  const stopIndex = model.layout.stops.findIndex((stop) => stop.kind === "artwork" && stop.artworkIndex === placement?.index);
  if (!placement || stopIndex < 0) throw new PhotoRenderError("photo", "Artwork not found in the museum.");

  // Compose: the frame and its placard form the subject; the frame itself is what sits in the middle.
  const plaqueExtent = placement.y - placement.outerH / 2 - (placement.plaque.y - placement.plaque.h / 2);
  const subject = {
    width: placement.outerW,
    height: placement.outerH + plaqueExtent,
    focusY: placement.y - plaqueExtent * 0.3,
  };
  const composition = composePhoto(format, subject);

  const quality = QUALITY.export;
  const renderW = Math.round(format.width * request.outputScale * supersample);
  const renderH = Math.round(format.height * request.outputScale * supersample);
  const canvas = document.createElement("canvas");
  canvas.width = renderW;
  canvas.height = renderH;

  const root = createRoot(canvas);
  const cleanup: { gl: (() => void) | null } = { gl: null };
  try {
    await root.configure({
      gl: { antialias: true, preserveDrawingBuffer: true, alpha: false, powerPreference: "high-performance" },
      dpr: 1,
      frameloop: "never",
      shadows: { type: PCFSoftShadowMap },
      size: { width: renderW, height: renderH, top: 0, left: 0 },
      camera: { fov: composition.fov, near: 0.1, far: 90, position: [placement.x, composition.cameraY, composition.distance] },
      onCreated: ({ gl }) => {
        gl.toneMapping = ACESFilmicToneMapping;
        gl.outputColorSpace = SRGBColorSpace;
        cleanup.gl = () => gl.forceContextLoss();
      },
    });
  } catch {
    throw new PhotoRenderError("webgl", "WebGL is not available.");
  }

  try {
    const expected = new Set<number>();
    const focus = focusArtworkOf(model.layout, stopIndex);
    model.layout.artworks.forEach((item) => {
      if (Math.abs(item.index - focus) <= quality.loadRadius) expected.add(item.index);
    });
    let targetFailed = false;
    let resolveSettled: () => void = () => {};
    const settled = new Promise<void>((resolve) => {
      resolveSettled = resolve;
    });
    const done = new Set<number>();
    const onPhotoSettled = (index: number, ok: boolean) => {
      done.add(index);
      if (!ok && index === placement.index) targetFailed = true;
      if ([...expected].every((item) => done.has(item))) resolveSettled();
    };

    const store = root.render(
      createElement(GalleryScene, {
        model,
        museumTitle: museum.title,
        preset: museum.theme.preset,
        accent: museum.theme.accent,
        fonts,
        quality,
        otherLabel: request.otherLabel,
        stopIndex,
        snapshot: true,
        reducedMotion: true,
        fixedCamera: {
          position: [placement.x, composition.cameraY, composition.distance],
          target: [placement.x, composition.cameraY, 0],
          fov: composition.fov,
          ndcShiftY: composition.ndcShiftY,
        },
        onPhotoSettled,
      }),
    );

    await Promise.race([settled, sleep(SETTLE_TIMEOUT_MS)]);
    if (request.signal?.aborted) throw new PhotoRenderError("aborted", "Cancelled.");
    if (targetFailed || !done.has(placement.index)) throw new PhotoRenderError("photo", "The artwork image could not be loaded.");

    // Let React commit textures and effects, then render two settled frames
    // (the first compiles shaders and warms the floor reflection).
    await nextFrame();
    await sleep(60);
    const state = store.getState();
    // Compile in parallel so the dialog never freezes while shaders build.
    await state.gl.compileAsync(state.scene, state.camera).catch(() => undefined);
    state.advance(performance.now() / 1000, true);
    await nextFrame();
    state.advance(performance.now() / 1000 + 0.05, true);

    const out = document.createElement("canvas");
    out.width = Math.round(format.width * request.outputScale);
    out.height = Math.round(format.height * request.outputScale);
    const ctx = out.getContext("2d");
    if (!ctx) throw new PhotoRenderError("unknown", "Canvas 2D is not available.");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(canvas, 0, 0, out.width, out.height);
    finishPhoto(
      out,
      {
        vignette: request.vignette,
        grain: request.grain,
        watermark: request.watermark ? museum.title : null,
        fontFamily: fonts.body,
        watermarkBottom: (format.height - format.safe.bottom) * request.outputScale,
      },
      request.outputScale,
    );
    return out;
  } finally {
    root.unmount();
    // Let the reconciler release its GPU resources before the context is dropped.
    await sleep(120);
    try {
      cleanup.gl?.();
    } catch {
      // The context may already be gone; nothing left to free.
    }
    canvas.width = 1;
    canvas.height = 1;
  }
}

/**
 * Renders a real photograph of the 3D museum: the same scene the visitor walks
 * through, seen from a photographer's camera standing at the artwork's stop.
 * Falls back to lower supersampling when the device runs out of memory.
 */
export async function renderMuseumPhoto(request: PhotoRequest): Promise<HTMLCanvasElement> {
  const ladder = [request.supersample, 1.25, 1].filter((value, index, all) => value <= request.supersample && all.indexOf(value) === index);
  let lastError: unknown = null;
  for (const supersample of ladder) {
    try {
      return await renderOnce(request, supersample);
    } catch (error) {
      lastError = error;
      if (error instanceof PhotoRenderError && error.code !== "unknown" && error.code !== "webgl") throw error;
    }
  }
  if (lastError instanceof PhotoRenderError) throw lastError;
  throw new PhotoRenderError("unknown", lastError instanceof Error ? lastError.message : "Rendering failed.");
}

export function canvasToBlob(canvas: HTMLCanvasElement, jpeg: boolean): Promise<Blob> {
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("The browser could not create the image."))),
        jpeg ? "image/jpeg" : "image/png",
        jpeg ? 0.92 : undefined,
      );
    } catch {
      reject(new Error("The image could not be exported."));
    }
  });
}
