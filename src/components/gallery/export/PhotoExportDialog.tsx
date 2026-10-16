"use client";

import { Check, Download, Share2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { LIGHTING_PRESETS } from "@/lib/hall-style";
import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n";
import { buildFilename } from "@/lib/photo/filename";
import { PHOTO_FORMAT_IDS, PHOTO_FORMATS, isFormatId, type PhotoFormatId } from "@/lib/photo/formats";
import type { ViewerMuseum } from "@/lib/viewer-model";
import type { LightingPreset } from "@/types/database";
import { FieldRow, Segmented, SwitchField, inputCls } from "./controls";
import { PhotoRenderError, canvasToBlob, renderMuseumPhoto } from "./render-photo";

export type PhotoDialogProps = {
  /** "visitor": format only. "admin": a few real scene choices as well. */
  mode: "visitor" | "admin";
  museum: ViewerMuseum;
  artworkId: string;
  /** CSS variables of the surrounding theme (the dialog is portaled to <body>). */
  themeVars?: CSSProperties;
  onClose: () => void;
};

type Options = {
  format: PhotoFormatId;
  lighting: LightingPreset | "auto";
  vignette: boolean;
  grain: boolean;
  watermark: boolean;
  jpeg: boolean;
};

const DEFAULTS: Options = { format: "story", lighting: "auto", vignette: true, grain: true, watermark: true, jpeg: false };
const STORAGE_KEY = "mymuseum:photo-export:v1";
const PREVIEW_SCALE = 0.4;

const FORMAT_LABEL: Record<PhotoFormatId, MessageKey> = {
  story: "export.formatStory",
  post: "export.formatPost",
  square: "export.formatSquare",
};
const LIGHTING_LABEL: Record<LightingPreset, MessageKey> = {
  warm: "export.lightingWarm",
  cold: "export.lightingCold",
  dramatic: "export.lightingDramatic",
  soft: "export.lightingSoft",
};

function readStored(mode: PhotoDialogProps["mode"]): Options {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<Options>) : {};
    const format = isFormatId(parsed.format) ? parsed.format : DEFAULTS.format;
    if (mode === "visitor") return { ...DEFAULTS, format };
    return {
      format,
      lighting: parsed.lighting && (LIGHTING_PRESETS as readonly string[]).includes(parsed.lighting) ? parsed.lighting : "auto",
      vignette: typeof parsed.vignette === "boolean" ? parsed.vignette : DEFAULTS.vignette,
      grain: typeof parsed.grain === "boolean" ? parsed.grain : DEFAULTS.grain,
      watermark: typeof parsed.watermark === "boolean" ? parsed.watermark : DEFAULTS.watermark,
      jpeg: typeof parsed.jpeg === "boolean" ? parsed.jpeg : DEFAULTS.jpeg,
    };
  } catch {
    return DEFAULTS;
  }
}

function canShareFile(file: File): boolean {
  try {
    return typeof navigator !== "undefined" && typeof navigator.canShare === "function" && navigator.canShare({ files: [file] });
  } catch {
    return false;
  }
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export default function PhotoExportDialog({ mode, museum, artworkId, themeVars, onClose }: PhotoDialogProps) {
  const { t } = useI18n();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const onCloseRef = useRef(onClose);
  const admin = mode === "admin";
  const artwork = useMemo(() => [...museum.halls.flatMap((hall) => hall.artworks), ...museum.otherArtworks].find((item) => item.id === artworkId), [museum, artworkId]);

  const [options, setOptions] = useState<Options>(() => readStored(mode));
  const [preview, setPreview] = useState<{ url: string; key: string } | null>(null);
  const [status, setStatus] = useState<"rendering" | "ready" | "error">("rendering");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState<"share" | "download" | null>(null);
  const [canShare, setCanShare] = useState(false);
  const patch = <K extends keyof Options>(key: K, value: Options[K]) => setOptions((current) => ({ ...current, [key]: value }));

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(options));
    } catch {
      // Storage can be unavailable (private mode); the dialog works without it.
    }
  }, [options]);

  // Native modal dialog: focus trap, Escape and inert background come from the platform.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const stop = (event: KeyboardEvent) => event.stopPropagation();
    dialog.addEventListener("keydown", stop);
    const handleClose = () => {
      if (!dialog.open) onCloseRef.current();
    };
    dialog.addEventListener("close", handleClose);
    setCanShare(canShareFile(new File([""], "share.png", { type: "image/png" })));
    return () => {
      dialog.removeEventListener("keydown", stop);
      dialog.removeEventListener("close", handleClose);
      document.body.style.overflow = previousOverflow;
      if (dialog.open) dialog.close();
    };
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 4500);
    return () => clearTimeout(timer);
  }, [notice]);

  const request = useCallback(
    (outputScale: number, supersample: number, signal?: AbortSignal) =>
      renderMuseumPhoto({
        museum,
        artworkId,
        format: options.format,
        outputScale,
        supersample,
        lighting: options.lighting === "auto" ? null : options.lighting,
        vignette: options.vignette,
        grain: options.grain,
        watermark: options.watermark,
        otherLabel: t("viewer.other"),
        signal,
      }),
    [museum, artworkId, options, t],
  );

  // Live preview: a real (small) render of the scene, debounced and serialized.
  const queue = useRef<Promise<void>>(Promise.resolve());
  const previewUrl = useRef<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setStatus("rendering");
      queue.current = queue.current.then(async () => {
        if (controller.signal.aborted) return;
        try {
          const canvas = await request(PREVIEW_SCALE, 1, controller.signal);
          const blob = await canvasToBlob(canvas, true);
          if (controller.signal.aborted) return;
          const url = URL.createObjectURL(blob);
          if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
          previewUrl.current = url;
          setPreview({ url, key: options.format });
          setStatus("ready");
          setError(null);
        } catch (cause) {
          if (controller.signal.aborted) return;
          setStatus("error");
          setError(cause instanceof PhotoRenderError && cause.code === "webgl" ? t("export.errorWebgl") : cause instanceof PhotoRenderError && cause.code === "photo" ? t("export.errorPhoto") : t("export.error"));
        }
      });
    }, 220);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [request, options.format, t]);

  useEffect(
    () => () => {
      if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    },
    [],
  );

  const makeFile = useCallback(async () => {
    const canvas = await request(1, 1.5);
    const blob = await canvasToBlob(canvas, options.jpeg);
    const filename = buildFilename({
      museumSlug: museum.slug,
      artworkTitle: artwork?.title ?? "artwork",
      format: options.format,
      extension: options.jpeg ? "jpg" : "png",
    });
    return { blob, filename };
  }, [request, options.jpeg, options.format, museum.slug, artwork?.title]);

  async function onDownload() {
    setBusy("download");
    setNotice(null);
    try {
      const { blob, filename } = await makeFile();
      downloadBlob(blob, filename);
      setNotice({ kind: "ok", text: t("export.saved") });
    } catch {
      setNotice({ kind: "error", text: t("export.error") });
    } finally {
      setBusy(null);
    }
  }

  async function onShare() {
    setBusy("share");
    setNotice(null);
    try {
      const { blob, filename } = await makeFile();
      const file = new File([blob], filename, { type: blob.type });
      if (!canShareFile(file)) {
        downloadBlob(blob, filename);
        setNotice({ kind: "ok", text: t("export.shareFallback") });
        return;
      }
      try {
        await navigator.share({ files: [file], title: artwork?.title });
        setNotice({ kind: "ok", text: t("export.shared") });
      } catch (cause) {
        const name = cause instanceof DOMException ? cause.name : "";
        if (name === "AbortError") return;
        setNotice({ kind: "error", text: name === "NotAllowedError" ? t("export.shareRetry") : t("export.shareFailed") });
      }
    } catch {
      setNotice({ kind: "error", text: t("export.error") });
    } finally {
      setBusy(null);
    }
  }

  const format = PHOTO_FORMATS[options.format];
  const formatOptions = useMemo(() => PHOTO_FORMAT_IDS.map((id) => ({ value: id, label: t(FORMAT_LABEL[id]) })), [t]);
  const disabled = status === "error" || busy !== null;

  return createPortal(
    <dialog
      ref={dialogRef}
      aria-labelledby="photo-dialog-title"
      style={themeVars}
      className="m-0 h-dvh max-h-none w-dvw max-w-none overflow-hidden bg-raised p-0 text-fg backdrop:bg-black/70 sm:m-auto sm:h-[min(52rem,94dvh)] sm:w-[min(62rem,94vw)] sm:rounded-3xl sm:border sm:border-line sm:shadow-2xl"
    >
      <div className="flex h-full flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-6">
          <h2 id="photo-dialog-title" className="font-display text-xl font-semibold">
            {admin ? t("export.adminTitle") : t("export.title")}
          </h2>
          <button type="button" onClick={() => dialogRef.current?.close()} aria-label={t("export.close")} className="inline-flex size-11 items-center justify-center rounded-full border border-line bg-surface hover:bg-line">
            <X aria-hidden className="size-5" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto md:grid md:grid-cols-[minmax(0,1fr)_21rem] md:overflow-hidden">
          <div className="sticky top-0 z-10 flex h-[44dvh] items-center justify-center bg-surface p-3 md:static md:h-auto md:p-6">
            {status === "error" && !preview ? (
              <p role="alert" className="max-w-sm text-center text-base">
                {error}
              </p>
            ) : (
              <div className="relative flex max-h-full max-w-full items-center justify-center">
                {preview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={preview.url}
                    alt={t("export.previewAlt", { title: artwork?.title ?? "", museum: museum.title })}
                    className="h-auto max-h-[calc(44dvh-1.5rem)] w-auto max-w-full rounded-sm bg-canvas shadow-xl md:max-h-[calc(min(52rem,94dvh)-12rem)]"
                    style={{ aspectRatio: `${format.width} / ${format.height}` }}
                  />
                ) : (
                  <div className="rounded-sm bg-canvas shadow-xl" style={{ aspectRatio: `${format.width} / ${format.height}`, height: "min(60dvh, 30rem)" }} />
                )}
                {status === "rendering" ? (
                  <span role="status" className="absolute right-2 bottom-2 rounded-full bg-black/60 px-3 py-1 text-xs font-medium text-white">
                    {t("export.rendering")}
                  </span>
                ) : null}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-4 p-4 sm:p-6 md:overflow-y-auto">
            <Segmented legend={t("export.format")} value={options.format} options={formatOptions} onChange={(value: PhotoFormatId) => patch("format", value)} />
            {admin ? (
              <>
                <FieldRow label={t("export.lighting")} htmlFor="photo-lighting">
                  <select id="photo-lighting" value={options.lighting} onChange={(event) => patch("lighting", event.target.value as Options["lighting"])} className={inputCls}>
                    <option value="auto">{t("export.lightingAuto")}</option>
                    {LIGHTING_PRESETS.map((preset) => (
                      <option key={preset} value={preset}>
                        {t(LIGHTING_LABEL[preset])}
                      </option>
                    ))}
                  </select>
                </FieldRow>
                <SwitchField label={t("export.vignette")} checked={options.vignette} onChange={(value) => patch("vignette", value)} />
                <SwitchField label={t("export.grain")} checked={options.grain} onChange={(value) => patch("grain", value)} />
                <SwitchField label={t("export.watermark")} description={t("export.watermarkHint")} checked={options.watermark} onChange={(value) => patch("watermark", value)} />
                <SwitchField label={t("export.jpeg")} checked={options.jpeg} onChange={(value) => patch("jpeg", value)} />
                <button type="button" onClick={() => setOptions({ ...DEFAULTS, format: options.format })} className="min-h-11 self-start rounded-theme px-3 text-sm font-medium text-fg underline underline-offset-4 hover:bg-surface">
                  {t("export.reset")}
                </button>
              </>
            ) : (
              <p className="text-sm text-muted">{t("export.intro")}</p>
            )}
          </div>
        </div>

        <footer className="border-t border-line bg-raised px-4 py-3 sm:px-6">
          <div className="min-h-6 text-sm" aria-live="polite" role="status">
            {notice ? (
              <p className={`flex items-center gap-1.5 ${notice.kind === "error" ? "text-red-600" : "text-fg"}`}>
                {notice.kind === "ok" ? <Check aria-hidden className="size-4" /> : null}
                {notice.text}
              </p>
            ) : (
              <p className="text-muted">
                {format.width} x {format.height}px
              </p>
            )}
          </div>
          <div className="mt-2 flex gap-3">
            {canShare ? (
              <button type="button" onClick={onShare} disabled={disabled} className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-theme bg-accent px-5 text-base font-semibold text-on-accent transition hover:brightness-95 disabled:pointer-events-none disabled:opacity-50">
                <Share2 aria-hidden className="size-5" />
                {busy === "share" ? t("export.preparing") : t("export.share")}
              </button>
            ) : null}
            <button
              type="button"
              onClick={onDownload}
              disabled={disabled}
              className={`inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-theme px-5 text-base font-semibold transition disabled:pointer-events-none disabled:opacity-50 ${canShare ? "border border-line bg-surface text-fg hover:bg-line" : "bg-accent text-on-accent hover:brightness-95"}`}
            >
              <Download aria-hidden className="size-5" />
              {busy === "download" ? t("export.preparing") : t("export.download")}
            </button>
          </div>
        </footer>
      </div>
    </dialog>,
    document.body,
  );
}
