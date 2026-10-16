"use client";

import { Check, Download, Share2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { FRAME_STYLES, LIGHTING_PRESETS } from "@/lib/hall-style";
import { canShareFile, downloadBlob } from "@/lib/story/client";
import { STORY_FORMATS, STORY_FORMAT_IDS, type StoryFormatId } from "@/lib/story/formats";
import {
  CAPTION_STYLES,
  DEFAULT_STYLE_OPTIONS,
  WALL_PRESETS,
  defaultCaptionTexts,
  parseStoredOptions,
  type StoryArtworkInfo,
  type StoryHallInfo,
  type StoryMuseumInfo,
  type StoryStyleOptions,
} from "@/lib/story/plan";
import { FieldRow, OptionalColor, Section, Segmented, SelectField, SwitchField, inputCls } from "./controls";
import { useStoryRender } from "./useStoryRender";

export type StoryDialogProps = {
  /** "visitor" is fully automatic (format only); "admin" exposes text and style controls. */
  mode: "visitor" | "admin";
  museum: StoryMuseumInfo;
  artwork: StoryArtworkInfo & { description?: string | null };
  halls: StoryHallInfo[];
  hallId: string | null;
  /** CSS variables of the surrounding theme (the dialog is portaled to <body>). */
  themeVars?: CSSProperties;
  onClose: () => void;
};

const STORAGE_KEY = "mymuseum:story-export:v1";
const FORMAT_KEY = "mymuseum:story-format:v1";

function readStored(mode: StoryDialogProps["mode"], halls: StoryHallInfo[]): StoryStyleOptions {
  try {
    if (mode === "visitor") {
      const format = window.localStorage.getItem(FORMAT_KEY);
      return parseStoredOptions({ format });
    }
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const options = parseStoredOptions(raw ? JSON.parse(raw) : null);
    // A remembered hall that no longer exists falls back to Auto.
    if (options.scene.startsWith("hall:") && !halls.some((hall) => `hall:${hall.id}` === options.scene)) {
      return { ...options, scene: "auto" };
    }
    return options;
  } catch {
    return { ...DEFAULT_STYLE_OPTIONS };
  }
}

function writeStored(mode: StoryDialogProps["mode"], options: StoryStyleOptions) {
  try {
    if (mode === "visitor") window.localStorage.setItem(FORMAT_KEY, options.format);
    else window.localStorage.setItem(STORAGE_KEY, JSON.stringify(options));
  } catch {
    // Storage can be unavailable (private mode); the dialog works without it.
  }
}

const FRAME_LABELS: Record<string, string> = {
  minimal: "Thin gallery",
  wood: "Wood",
  gold: "Gold",
  metallic: "Metallic",
  canvas_wrap: "Canvas wrap",
  black_gallery: "Black gallery",
  vintage_ornate: "Vintage ornate",
  floating_glass: "Floating glass",
};
const CAPTION_LABELS = { elegant: "Elegant", plaque: "Museum plaque", handwritten: "Handwritten" } as const;
const titleCase = (value: string) => value.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

export default function StoryExportDialog({ mode, museum, artwork, halls, hallId, themeVars, onClose }: StoryDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);
  const admin = mode === "admin";

  const [options, setOptions] = useState<StoryStyleOptions>(() => readStored(mode, halls));
  const [texts, setTexts] = useState(() => ({
    ...defaultCaptionTexts(artwork),
    // The description is never shown unless the owner opts in here.
    description: "",
  }));
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState<"share" | "download" | null>(null);
  const [canShare, setCanShare] = useState(false);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });
  const patch = <K extends keyof StoryStyleOptions>(key: K, value: StoryStyleOptions[K]) => setOptions((current) => ({ ...current, [key]: value }));

  const { status, error, exportReady, rendering, getFile } = useStoryRender({ previewRef, artwork, museum, halls, hallId, options, texts });

  useEffect(() => writeStored(mode, options), [mode, options]);

  // Native modal dialog: focus trap, Escape and inert background come from the platform.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Keep arrow keys and Escape from reaching the viewer's global shortcuts.
    const stop = (event: KeyboardEvent) => event.stopPropagation();
    dialog.addEventListener("keydown", stop);
    // Only user-initiated closes (Escape, Close button) notify the parent; the cleanup below must not.
    // A stale "close" event queued by a strict-mode remount arrives while the dialog is open again: ignore it.
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
    const timer = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  const format = STORY_FORMATS[options.format];
  const formatOptions = useMemo(() => STORY_FORMAT_IDS.map((id) => ({ value: id, label: `${STORY_FORMATS[id].label} ${STORY_FORMATS[id].ratio}` })), []);
  const disabled = status !== "ready" || busy !== null;

  async function onDownload() {
    setBusy("download");
    setNotice(null);
    try {
      const { file } = await getFile();
      downloadBlob(file.blob, file.filename);
      setNotice({ kind: "ok", text: "Image saved to your device." });
    } catch (cause) {
      setNotice({ kind: "error", text: cause instanceof Error ? cause.message : "Could not create the image." });
    } finally {
      setBusy(null);
    }
  }

  async function onShare() {
    setBusy("share");
    setNotice(null);
    try {
      const { file, wasReady } = await getFile();
      const shareable = new File([file.blob], file.filename, { type: file.blob.type });
      if (!canShareFile(shareable)) {
        downloadBlob(file.blob, file.filename);
        setNotice({ kind: "ok", text: "Sharing is not available here, so the image was saved instead." });
        return;
      }
      try {
        await navigator.share({ files: [shareable], title: texts.title || artwork.title });
        setNotice({ kind: "ok", text: "Shared." });
      } catch (cause) {
        const name = cause instanceof DOMException ? cause.name : "";
        if (name === "AbortError") return; // closed the share sheet
        if (name === "NotAllowedError" && !wasReady) {
          setNotice({ kind: "ok", text: "Your image is ready. Tap Share again." });
        } else {
          setNotice({ kind: "error", text: "Sharing failed. Try Download instead." });
        }
      }
    } catch (cause) {
      setNotice({ kind: "error", text: cause instanceof Error ? cause.message : "Could not create the image." });
    } finally {
      setBusy(null);
    }
  }

  const wallPresetOptions = WALL_PRESETS.map((style) => (
    <option key={style} value={`wall:${style}`}>
      {titleCase(style)}
    </option>
  ));

  const controls = (
    <div className="flex flex-col gap-4">
      <Segmented legend="Format" value={options.format} options={formatOptions} onChange={(value: StoryFormatId) => patch("format", value)} />

      {admin ? (
        <>
          <Section title="Text" defaultOpen>
            <FieldRow label="Title" htmlFor="story-title" hint="Starts as the artwork title. Change it for this image only.">
              <input id="story-title" value={texts.title} maxLength={160} onChange={(event) => setTexts((t) => ({ ...t, title: event.target.value }))} className={inputCls} />
            </FieldRow>
            <FieldRow label="Small detail line" htmlFor="story-detail" hint="A discreet line under the title, like the year. Leave empty to hide it.">
              <input id="story-detail" value={texts.detail} maxLength={60} onChange={(event) => setTexts((t) => ({ ...t, detail: event.target.value }))} className={inputCls} />
            </FieldRow>
            <FieldRow label="Description (optional)" htmlFor="story-desc" hint="Not shown unless you write something here.">
              <textarea id="story-desc" value={texts.description} maxLength={300} onChange={(event) => setTexts((t) => ({ ...t, description: event.target.value }))} className={`${inputCls} min-h-24 py-2.5`} />
            </FieldRow>
            <SelectField label="Caption style" value={options.captionStyle} onChange={(value) => patch("captionStyle", value)}>
              <option value="auto">Auto</option>
              {CAPTION_STYLES.map((style) => (
                <option key={style} value={style}>
                  {CAPTION_LABELS[style]}
                </option>
              ))}
            </SelectField>
            <SelectField label="Text color" value={options.textTone} onChange={(value) => patch("textTone", value)}>
              <option value="auto">Auto (best contrast)</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </SelectField>
            <SwitchField label="Museum name" description="A small watermark at the bottom." checked={options.watermark} onChange={(value) => patch("watermark", value)} />
          </Section>

          <Section title="Scene">
            <SelectField label="Wall and lighting" value={options.scene} onChange={(value) => patch("scene", value)}>
              <option value="auto">Auto (this artwork&apos;s hall)</option>
              {halls.length > 0 ? (
                <optgroup label="Your halls">
                  {halls.map((hall) => (
                    <option key={hall.id} value={`hall:${hall.id}`}>
                      {hall.name}
                    </option>
                  ))}
                </optgroup>
              ) : null}
              <optgroup label="Wall presets">{wallPresetOptions}</optgroup>
            </SelectField>
            <SwitchField label="Show floor and decoration" description="A low angle with the floor, carpet and props." checked={options.showFloor} onChange={(value) => patch("showFloor", value)} />
            <SelectField label="Wall tint" value={options.wallTint} onChange={(value) => patch("wallTint", value)}>
              <option value="auto">Auto</option>
              <option value="none">None</option>
              <option value="photo">Match the photo</option>
              <option value="custom">Custom color</option>
            </SelectField>
            {options.wallTint === "custom" ? <OptionalColor label="Tint color" value={options.wallTintColor} fallback="#c9a227" onChange={(value) => patch("wallTintColor", value ?? DEFAULT_STYLE_OPTIONS.wallTintColor)} /> : null}
            <SelectField label="Lighting" value={options.lighting} onChange={(value) => patch("lighting", value)}>
              <option value="auto">Auto (hall lighting)</option>
              {LIGHTING_PRESETS.map((preset) => (
                <option key={preset} value={preset}>
                  {titleCase(preset)}
                </option>
              ))}
            </SelectField>
            <SwitchField label="Spotlight on the artwork" checked={options.spotlight} onChange={(value) => patch("spotlight", value)} />
            <SwitchField label="Vignette" checked={options.vignette} onChange={(value) => patch("vignette", value)} />
            <SwitchField label="Film grain" checked={options.grain} onChange={(value) => patch("grain", value)} />
          </Section>

          <Section title="Frame">
            <SelectField label="Frame style" value={options.frame} onChange={(value) => patch("frame", value)}>
              <option value="auto">Auto (artwork frame)</option>
              {FRAME_STYLES.map((style) => (
                <option key={style} value={style}>
                  {FRAME_LABELS[style]}
                </option>
              ))}
            </SelectField>
            <OptionalColor label="Frame color" value={options.frameColor} fallback="#6b4423" onChange={(value) => patch("frameColor", value)} />
            <SelectField label="Mat (passe-partout)" value={options.mat} onChange={(value) => patch("mat", value)}>
              <option value="auto">Auto (wide mat for photos)</option>
              <option value="on">On</option>
              <option value="off">Off</option>
            </SelectField>
            <OptionalColor label="Mat color" value={options.matColor} fallback="#f4f0e6" onChange={(value) => patch("matColor", value)} />
          </Section>

          <SwitchField label="Smaller file (JPEG)" description="JPEG at quality 92 instead of PNG." checked={options.jpeg} onChange={(value) => patch("jpeg", value)} />
          <button
            type="button"
            onClick={() => {
              setOptions({ ...DEFAULT_STYLE_OPTIONS, format: options.format });
              setTexts({ ...defaultCaptionTexts(artwork), description: "" });
            }}
            className="min-h-11 self-start rounded-theme px-3 text-sm font-medium text-fg underline underline-offset-4 hover:bg-surface"
          >
            Reset everything to Auto
          </button>
        </>
      ) : (
        <p className="text-sm text-muted">A museum-styled picture of this artwork, ready to save or share.</p>
      )}
    </div>
  );

  return createPortal(
    <dialog
      ref={dialogRef}
      aria-labelledby="story-dialog-title"
      style={themeVars}
      className="m-0 h-dvh max-h-none w-dvw max-w-none overflow-hidden bg-raised p-0 text-fg backdrop:bg-black/70 sm:m-auto sm:h-[min(54rem,94dvh)] sm:w-[min(66rem,94vw)] sm:rounded-3xl sm:border sm:border-line sm:shadow-2xl"
    >
      <div className="flex h-full flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-6">
          <h2 id="story-dialog-title" className="font-display text-xl font-semibold">
            {admin ? "Export as image" : "Download image"}
          </h2>
          <button type="button" onClick={() => dialogRef.current?.close()} aria-label="Close" className="inline-flex size-11 items-center justify-center rounded-full border border-line bg-surface hover:bg-line">
            <X aria-hidden className="size-5" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto md:grid md:grid-cols-[minmax(0,1fr)_23rem] md:overflow-hidden">
          <div className="sticky top-0 z-10 flex h-[42dvh] items-center justify-center bg-surface p-3 md:static md:h-auto md:p-6">
            {status === "error" ? (
              <p role="alert" className="max-w-sm text-center text-base">
                {error}
              </p>
            ) : (
              <div className="relative flex max-w-full items-center justify-center">
                <canvas
                  ref={previewRef}
                  role="img"
                  aria-label={`Preview of ${texts.title || artwork.title} in ${museum.title}`}
                  className="h-auto w-auto max-w-full rounded-sm bg-canvas shadow-xl max-h-[calc(42dvh-1.5rem)] md:max-h-[calc(min(54rem,94dvh)-14rem)]"
                  style={{ aspectRatio: `${format.width} / ${format.height}` }}
                />
                {status === "loading" || rendering ? (
                  <span role="status" className="absolute right-2 bottom-2 rounded-full bg-black/60 px-3 py-1 text-xs font-medium text-white">
                    {status === "loading" ? "Loading photo" : "Updating"}
                  </span>
                ) : null}
              </div>
            )}
          </div>
          <div className="p-4 sm:p-6 md:overflow-y-auto">{controls}</div>
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
                {format.width} x {format.height}px {status === "ready" && !exportReady ? "· preparing full size" : ""}
              </p>
            )}
          </div>
          <div className="mt-2 flex gap-3">
            {canShare ? (
              <button type="button" onClick={onShare} disabled={disabled} className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-theme bg-accent px-5 text-base font-semibold text-on-accent transition hover:brightness-95 disabled:pointer-events-none disabled:opacity-50">
                <Share2 aria-hidden className="size-5" />
                {busy === "share" ? "Preparing" : "Share"}
              </button>
            ) : null}
            <button
              type="button"
              onClick={onDownload}
              disabled={disabled}
              className={`inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-theme px-5 text-base font-semibold transition disabled:pointer-events-none disabled:opacity-50 ${canShare ? "border border-line bg-surface text-fg hover:bg-line" : "bg-accent text-on-accent hover:brightness-95"}`}
            >
              <Download aria-hidden className="size-5" />
              {busy === "download" ? "Preparing" : "Download"}
            </button>
          </div>
        </footer>
      </div>
    </dialog>,
    document.body,
  );
}
