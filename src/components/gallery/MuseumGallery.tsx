"use client";

import { AnimatePresence, motion } from "motion/react";
import { ChevronLeft, ChevronRight, Gauge, Languages, List } from "lucide-react";
import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { hallStopIndex } from "@/lib/gallery/layout";
import { LOW_SCALES, lowerTier, scaledQuality, tierForPreference, type GovernorAction, type QualityPreference, type QualityTier } from "@/lib/gallery/quality";
import { useI18n } from "@/lib/i18n/provider";
import { sceneMood } from "@/lib/gallery/scene-look";
import type { ViewerMuseum } from "@/lib/viewer-model";
import { readPreference, useDeviceProfile, writePreference } from "./device";
import { GalleryCanvas } from "./GalleryCanvas";
import { isPerfDebug } from "./perf-store";
import { PerfGovernor } from "./PerfGovernor";
import { useLoadProgress } from "./use-load-progress";
import { buildGalleryModel } from "./GalleryScene";
import { PhotoExportButton } from "./export/PhotoExportButton";
import { LoadingScreen } from "./LoadingScreen";
import { WebglFallback } from "./WebglFallback";
import { useCanvasFonts } from "./use-canvas-fonts";
import { glass, glassHover } from "./ui";

type Props = { museum: ViewerMuseum };

// Diagnostics (?debug=perf) are separate chunks: visitors never download them.
const PerfOverlay = lazy(() => import("./PerfOverlay"));
const PerfProbe = lazy(() => import("./PerfProbe"));

const noopSubscribe = () => () => {};

const READY_FALLBACK_MS = 14000;
const MIN_LOADING_MS = 900;

/** Full-viewport immersive museum: a 3D gallery on rails with minimal floating controls. */
export function MuseumGallery({ museum }: Props) {
  const { t, locale, setLocale } = useI18n();
  const device = useDeviceProfile();
  const fonts = useCanvasFonts(museum.theme.fontPairing, museum.title);
  const model = useMemo(() => buildGalleryModel(museum), [museum]);
  const { layout, zones } = model;
  const mood = sceneMood(museum.theme.preset);

  const [stopIndex, setStopIndex] = useState(layout.firstArtworkStop);
  const [zoomed, setZoomed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [released, setReleased] = useState(false);
  const [compiledTier, setCompiledTier] = useState<QualityTier | null>(null);
  const [menuQuality, setMenuQuality] = useState(false);
  const [preference, setPreference] = useState<QualityPreference>(() => (typeof window === "undefined" ? "auto" : readPreference()));
  const [governed, setGoverned] = useState<{ tier: QualityTier | null; step: number }>({ tier: null, step: 0 });
  const perfDebug = useSyncExternalStore(noopSubscribe, isPerfDebug, () => false);
  const progress = useLoadProgress();
  const startedAt = useRef<number | null>(null);

  // Tier: the URL override wins, then the visitor's choice, then what the governor has lowered it to.
  const tier: QualityTier | null = device
    ? device.forced
      ? device.tier
      : preference !== "auto"
        ? tierForPreference(preference, device.tier)
        : (governed.tier ?? device.tier)
    : null;
  const scaleStep = tier === "low" ? governed.step : 0;
  const quality = useMemo(() => (tier ? scaledQuality(tier, LOW_SCALES[scaleStep] ?? 1) : null), [tier, scaleStep]);
  const compiled = compiledTier !== null && compiledTier === tier;
  const governorOn = Boolean(device && !device.forced && preference === "auto" && released);
  // Development only: ?motion=full lets automated browsers that report reduced motion preview the animations.
  const forceMotion = process.env.NODE_ENV !== "production" && typeof window !== "undefined" && new URLSearchParams(window.location.search).get("motion") === "full";
  const reducedMotion = (device?.reducedMotion ?? false) && !forceMotion;
  const lastStop = layout.stops.length - 1;

  // Release the intro dolly when the first photos are in and the minimum loading time has passed.
  const sceneReady = Boolean(device?.webgl && fonts && quality);
  const loaded = sceneReady && compiled && progress.total > 0 && progress.progress >= 100 && !progress.active;
  useEffect(() => {
    if (!sceneReady || released) return;
    if (startedAt.current === null) startedAt.current = performance.now();
    const elapsed = performance.now() - startedAt.current;
    const wait = loaded ? Math.max(0, MIN_LOADING_MS - elapsed) : Math.max(0, READY_FALLBACK_MS - elapsed);
    const timer = window.setTimeout(() => setReleased(true), wait + 250);
    return () => window.clearTimeout(timer);
  }, [sceneReady, loaded, released]);

  const markCompiled = useCallback(() => setCompiledTier(tier), [tier]);

  const onGovernor = useCallback(
    (action: GovernorAction) => {
      if (action === "tier-down") setGoverned((g) => ({ ...g, tier: lowerTier(g.tier ?? device?.tier ?? "low") }));
      else if (action === "scale-down") setGoverned((g) => ({ ...g, step: g.step + 1 }));
    },
    [device],
  );

  const choosePreference = useCallback((value: QualityPreference) => {
    setPreference(value);
    writePreference(value);
    setGoverned({ tier: null, step: 0 });
    setMenuQuality(false);
  }, []);

  const goTo = useCallback(
    (index: number) => {
      setStopIndex(Math.min(Math.max(index, 0), lastStop));
      setZoomed(false);
      setMenuOpen(false);
    },
    [lastStop],
  );
  const next = useCallback(() => goTo(stopIndex + 1), [goTo, stopIndex]);
  const prev = useCallback(() => goTo(stopIndex - 1), [goTo, stopIndex]);

  const selectArtwork = useCallback(
    (artworkIndex: number) => {
      const target = layout.stops.findIndex((stop) => stop.kind === "artwork" && stop.artworkIndex === artworkIndex);
      if (target < 0) return;
      if (target === stopIndex) setZoomed((value) => !value);
      else goTo(target);
    },
    [layout.stops, stopIndex, goTo],
  );

  useEffect(() => {
    if (!released) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (document.querySelector("dialog[open]")) return;
      if (event.key === "ArrowRight") {
        event.preventDefault();
        next();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        prev();
      } else if (event.key === "Escape") {
        setZoomed(false);
        setMenuOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [released, next, prev]);

  const stop = layout.stops[stopIndex];
  const zone = stop ? zones[stop.zoneIndex] : null;
  const zoneName = zone ? (zone.kind === "other" ? t("viewer.other") : zone.name) : "";
  const artwork = stop?.kind === "artwork" ? layout.artworks[stop.artworkIndex] : null;
  const caption = artwork ? artwork.title : zoneName;
  const announcement = !stop ? "" : artwork ? t("viewer.nowViewing", { title: artwork.title }) : t("viewer.nowAtHall", { name: zoneName });
  const viewerArtwork = artwork && zone ? zone.artworks[artwork.indexInZone] : null;

  if (layout.stops.length === 0) {
    return (
      <main className="flex h-dvh items-center justify-center bg-canvas px-6 text-center text-fg">
        <p className="font-display text-2xl">{t("viewer.empty")}</p>
      </main>
    );
  }

  if (device && !device.webgl) return <WebglFallback museum={museum} />;

  return (
    <div className="relative h-dvh w-full touch-pan-y overflow-hidden select-none" style={{ background: mood.background }} data-testid="museum-gallery">
      {device && quality && fonts ? (
        <GalleryCanvas
          key={quality.tier}
          model={model}
          museumTitle={museum.title}
          preset={museum.theme.preset}
          accent={museum.theme.accent}
          fonts={fonts}
          quality={quality}
          otherLabel={t("viewer.other")}
          stopIndex={stopIndex}
          zoomed={zoomed}
          reducedMotion={reducedMotion}
          hold={!released}
          frameloop={compiled ? "demand" : "never"}
          onCompiled={markCompiled}
          onSelectArtwork={selectArtwork}
          onPointerMissed={() => setZoomed(false)}
          label={t("viewer.sceneLabel", { name: museum.title })}
          telemetry={process.env.NODE_ENV !== "production" ? exposeTelemetry : undefined}
          extras={
            <>
              <PerfGovernor tier={quality.tier} scaleStep={scaleStep} enabled={governorOn} onAction={onGovernor} />
              {perfDebug ? (
                <Suspense fallback={null}>
                  <PerfProbe tier={quality.tier} scale={LOW_SCALES[scaleStep] ?? 1} />
                </Suspense>
              ) : null}
            </>
          }
        />
      ) : null}

      <h1 className="sr-only">{museum.title}</h1>
      <p className="sr-only" aria-live="polite" role="status">
        {released ? announcement : ""}
      </p>

      {released ? (
        <>
          <button
            type="button"
            onClick={prev}
            disabled={stopIndex <= 0}
            aria-label={t("viewer.previous")}
            className={`absolute top-1/2 left-3 z-10 -translate-y-1/2 sm:left-6 ${glass} ${glassHover} size-12 sm:size-16 disabled:pointer-events-none disabled:opacity-0`}
          >
            <ChevronLeft aria-hidden className="size-7 sm:size-9" strokeWidth={1.5} />
          </button>
          <button
            type="button"
            onClick={next}
            disabled={stopIndex >= lastStop}
            aria-label={t("viewer.next")}
            className={`absolute top-1/2 right-3 z-10 -translate-y-1/2 sm:right-6 ${glass} ${glassHover} size-12 sm:size-16 disabled:pointer-events-none disabled:opacity-0`}
          >
            <ChevronRight aria-hidden className="size-7 sm:size-9" strokeWidth={1.5} />
          </button>

          <div className="absolute top-3 left-3 z-20 sm:top-6 sm:left-6">
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-expanded={menuOpen}
              aria-controls="hall-menu"
              aria-label={t("viewer.hallsAria")}
              className={`${glass} ${glassHover} h-11 gap-2 px-4 text-sm tracking-wide`}
            >
              <List aria-hidden className="size-4" />
              <span>{t("viewer.halls")}</span>
            </button>
            <AnimatePresence>
              {menuOpen ? (
                <>
                  <button type="button" aria-label={t("viewer.hallsClose")} tabIndex={-1} className="fixed inset-0 z-0 cursor-default" onClick={() => setMenuOpen(false)} />
                  <motion.ul
                    id="hall-menu"
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.18 }}
                    className="relative mt-2 flex min-w-52 flex-col rounded-3xl bg-black/40 p-1.5 text-white shadow-2xl ring-1 ring-white/20 backdrop-blur-xl"
                  >
                    {zones.map((item, index) => {
                      const target = hallStopIndex(layout, index);
                      const current = stop?.zoneIndex === index;
                      return (
                        <li key={item.id}>
                          <button
                            type="button"
                            aria-current={current ? "true" : undefined}
                            onClick={() => goTo(target)}
                            className="flex min-h-11 w-full items-center justify-between gap-6 rounded-2xl px-4 text-left text-sm tracking-wide transition hover:bg-white/15 aria-[current=true]:bg-white/15"
                          >
                            <span className="font-display text-base">{item.kind === "other" ? t("viewer.other") : item.name}</span>
                            <span className="text-xs text-white/65">{item.artworks.length}</span>
                          </button>
                        </li>
                      );
                    })}
                  </motion.ul>
                </>
              ) : null}
            </AnimatePresence>
          </div>

          <div className="absolute top-3 right-3 z-10 flex items-center gap-2 sm:top-6 sm:right-6">
            {viewerArtwork && museum.theme.overrides.allowVisitorExport ? (
              <PhotoExportButton museum={museum} artworkId={viewerArtwork.id} className={`${glass} ${glassHover} size-11`} />
            ) : null}
            <button
              type="button"
              onClick={() => setLocale(locale === "es" ? "en" : "es")}
              aria-label={locale === "es" ? t("viewer.switchToEnglish") : t("viewer.switchToSpanish")}
              className={`${glass} ${glassHover} h-11 gap-1.5 px-3.5 text-xs font-medium tracking-[0.18em]`}
            >
              <Languages aria-hidden className="size-4" />
              <span>{locale === "es" ? "ES" : "EN"}</span>
            </button>
          </div>

          <AnimatePresence mode="wait">
            <motion.p
              key={stop?.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.45, delay: 0.25 }}
              className="pointer-events-none absolute inset-x-16 bottom-5 z-10 truncate text-center font-display text-base tracking-wide text-white [text-shadow:0_1px_14px_rgba(0,0,0,0.65)] sm:bottom-8 sm:text-xl"
            >
              {caption}
            </motion.p>
          </AnimatePresence>
        </>
      ) : null}

      {released ? (
        <QualityControl
          open={menuQuality}
          onToggle={() => setMenuQuality((value) => !value)}
          value={preference}
          onChange={choosePreference}
        />
      ) : null}
      {perfDebug ? (
        <Suspense fallback={null}>
          <PerfOverlay />
        </Suspense>
      ) : null}

      <LoadingScreen title={museum.title} tagline={museum.tagline} visible={!released} progress={progress.progress} loading={t("viewer.loading")} accent={museum.theme.accent} />
    </div>
  );
}

function exposeTelemetry(sample: { x: number; z: number; t: number }) {
  (window as unknown as { __galleryCamera?: typeof sample }).__galleryCamera = sample;
}

function QualityControl({ open, onToggle, value, onChange }: { open: boolean; onToggle: () => void; value: QualityPreference; onChange: (value: QualityPreference) => void }) {
  const { t } = useI18n();
  const options: { id: QualityPreference; label: string }[] = [
    { id: "auto", label: t("viewer.qualityAuto") },
    { id: "high", label: t("viewer.qualityHigh") },
    { id: "low", label: t("viewer.qualityLow") },
  ];
  return (
    <div className="absolute right-3 bottom-3 z-20 flex flex-col items-end gap-2 sm:right-6 sm:bottom-6">
      {open ? (
        <div role="radiogroup" aria-label={t("viewer.quality")} className="flex flex-col gap-1 rounded-3xl bg-black/45 p-1.5 text-white shadow-2xl ring-1 ring-white/20 backdrop-blur-xl">
          {options.map((option) => (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={value === option.id}
              onClick={() => onChange(option.id)}
              className="min-h-9 rounded-2xl px-4 text-left text-sm tracking-wide transition hover:bg-white/15 aria-checked:bg-white/20"
            >
              {option.label}
            </button>
          ))}
          <p className="max-w-44 px-3 pt-1 pb-1.5 text-[11px] leading-4 text-white/65">{t("viewer.qualityHint")}</p>
        </div>
      ) : null}
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-label={t("viewer.quality")}
        className={`${glass} ${glassHover} size-10 opacity-70 hover:opacity-100`}
      >
        <Gauge aria-hidden className="size-4" />
      </button>
    </div>
  );
}
