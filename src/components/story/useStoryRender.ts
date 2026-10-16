"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import type { PhotoStats } from "@/lib/story/color";
import {
  PhotoLoadError,
  canvasToBlob,
  loadPhoto,
  loadStoryFonts,
  resolveStoryFonts,
  type LoadedPhoto,
} from "@/lib/story/client";
import { buildFilename } from "@/lib/story/filename";
import { resolveStoryPlan, type StoryArtworkInfo, type StoryHallInfo, type StoryMuseumInfo, type StoryStyleOptions } from "@/lib/story/plan";
import type { CaptionTexts } from "@/lib/story/layout";
import { RenderCancelled, renderStory, type StoryFonts } from "@/lib/story/render";
import { createCanvas } from "@/lib/story/draw/util";

const PREVIEW_SCALE = 0.42;
const PREVIEW_DEBOUNCE_MS = 160;
const EXPORT_PREPARE_MS = 700;

type Args = {
  previewRef: RefObject<HTMLCanvasElement | null>;
  artwork: StoryArtworkInfo;
  museum: StoryMuseumInfo;
  halls: StoryHallInfo[];
  hallId: string | null;
  options: StoryStyleOptions;
  texts: CaptionTexts;
};

export type RenderStatus = "loading" | "ready" | "error";
export type ExportFile = { blob: Blob; filename: string };

/**
 * Loads the photo and fonts once, keeps a live preview in sync with the
 * options (debounced, small scale) and prepares the full-resolution file in the
 * background so Share/Download can answer a tap immediately.
 */
export function useStoryRender({ previewRef, artwork, museum, halls, hallId, options, texts }: Args) {
  const [status, setStatus] = useState<RenderStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const [exportReady, setExportReady] = useState(false);
  const [rendering, setRendering] = useState(false);
  const loaded = useRef<LoadedPhoto | null>(null);
  const fontsRef = useRef<StoryFonts | null>(null);
  const [stats, setStats] = useState<PhotoStats | null>(null);
  const previewToken = useRef(0);
  const exportToken = useRef(0);
  const cache = useRef<{ key: string; file: ExportFile } | null>(null);
  const pending = useRef<{ key: string; promise: Promise<ExportFile> } | null>(null);

  // 1. Photo and fonts, once.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const fonts = resolveStoryFonts(museum.fontPairing);
        const [photo] = await Promise.all([loadPhoto(artwork.imageUrl), loadStoryFonts(fonts, `${texts.title} ${museum.title}`)]);
        if (!alive) return;
        loaded.current = photo;
        fontsRef.current = fonts;
        setStats(photo.stats);
        setStatus("ready");
      } catch (cause) {
        if (!alive) return;
        setError(cause instanceof PhotoLoadError ? cause.message : "Could not prepare the image. Please try again.");
        setStatus("error");
      }
    })();
    return () => {
      alive = false;
    };
    // Intentionally once per dialog: later text edits re-render, they do not reload the photo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artwork.imageUrl, museum.fontPairing]);

  const plan = useMemo(
    () => resolveStoryPlan({ options, texts, artwork, halls, hallId, museum, stats }),
    [options, texts, artwork, halls, hallId, museum, stats],
  );
  const planKey = useMemo(() => `${JSON.stringify(plan)}|${options.jpeg ? "jpg" : "png"}`, [plan, options.jpeg]);

  const renderFull = useCallback(
    async (key: string, isCancelled?: () => boolean): Promise<ExportFile> => {
      const photo = loaded.current;
      const fonts = fontsRef.current;
      if (!photo || !fonts) throw new Error("The image is still loading.");
      const canvas = createCanvas(10, 10);
      await renderStory({ canvas, plan, photo: photo.photo, fonts, scale: 1, isCancelled });
      const blob = await canvasToBlob(canvas, options.jpeg);
      const file: ExportFile = {
        blob,
        filename: buildFilename({
          museumSlug: museum.slug,
          artworkTitle: texts.title || artwork.title,
          format: options.format,
          extension: options.jpeg ? "jpg" : "png",
        }),
      };
      cache.current = { key, file };
      return file;
    },
    [plan, options.jpeg, options.format, museum.slug, texts.title, artwork.title],
  );

  // 2. Live preview and background preparation of the export.
  useEffect(() => {
    if (status !== "ready") return;
    const canvas = previewRef.current;
    const photo = loaded.current;
    const fonts = fontsRef.current;
    if (!canvas || !photo || !fonts) return;

    const token = ++previewToken.current;
    exportToken.current += 1;
    const exportId = exportToken.current;
    setExportReady(cache.current?.key === planKey);
    let prepareTimer: ReturnType<typeof setTimeout> | undefined;

    const timer = setTimeout(async () => {
      setRendering(true);
      try {
        await renderStory({ canvas, plan, photo: photo.photo, fonts, scale: PREVIEW_SCALE, isCancelled: () => token !== previewToken.current });
        setError(null);
        if (cache.current?.key !== planKey) {
          prepareTimer = setTimeout(() => {
            if (exportId !== exportToken.current) return;
            const promise = renderFull(planKey, () => exportId !== exportToken.current);
            pending.current = { key: planKey, promise };
            promise
              .then(() => exportId === exportToken.current && setExportReady(true))
              .catch(() => undefined)
              .finally(() => {
                if (pending.current?.promise === promise) pending.current = null;
              });
          }, EXPORT_PREPARE_MS);
        } else {
          setExportReady(true);
        }
      } catch (cause) {
        if (cause instanceof RenderCancelled) return;
        setError("The preview could not be drawn. Please try another format or reload.");
      } finally {
        if (token === previewToken.current) setRendering(false);
      }
    }, PREVIEW_DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      if (prepareTimer) clearTimeout(prepareTimer);
    };
  }, [status, plan, planKey, previewRef, renderFull]);

  // Cancel background work when the dialog closes.
  useEffect(
    () => () => {
      previewToken.current += 1;
      exportToken.current += 1;
    },
    [],
  );

  /** The full-resolution file for the current options (prepared already, or rendered now). */
  const getFile = useCallback(async (): Promise<{ file: ExportFile; wasReady: boolean }> => {
    if (cache.current?.key === planKey) return { file: cache.current.file, wasReady: true };
    if (pending.current?.key === planKey) return { file: await pending.current.promise, wasReady: false };
    exportToken.current += 1; // stop the background job; this one is explicit
    const id = exportToken.current;
    const promise = renderFull(planKey, () => id !== exportToken.current);
    pending.current = { key: planKey, promise };
    try {
      return { file: await promise, wasReady: false };
    } finally {
      if (pending.current?.promise === promise) pending.current = null;
    }
  }, [planKey, renderFull]);

  return { status, error, exportReady, rendering, getFile, plan };
}
