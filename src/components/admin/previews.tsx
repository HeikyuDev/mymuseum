"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { GalleryEmbed } from "@/components/gallery/GalleryEmbed";
import { buildLayout } from "@/lib/gallery/layout";
import { galleryZones, toLayoutZones } from "@/lib/gallery/zones";
import type { ResolvedHallStyle } from "@/lib/hall-style";
import { useI18n } from "@/lib/i18n/provider";
import type { ResolvedMuseumTheme } from "@/lib/theme";
import type { ViewerArtwork, ViewerMuseum } from "@/lib/viewer-model";
import { btnSecondary } from "./ui";
import { sampleViewerArtworks } from "./sample-art";

type HallPreviewProps = {
  theme: ResolvedMuseumTheme;
  name: string;
  style: ResolvedHallStyle;
  /** Real artworks of the hall; samples are used when the hall is empty. */
  artworks: ViewerArtwork[];
};

function StepButtons({ index, count, onChange }: { index: number; count: number; onChange: (index: number) => void }) {
  const { t } = useI18n();
  return (
    <span className="flex gap-1">
      <button type="button" className={`${btnSecondary} !min-h-9 !px-2`} disabled={index <= 0} onClick={() => onChange(index - 1)} aria-label={t("viewer.previous")}>
        <ChevronLeft aria-hidden className="size-4" />
      </button>
      <button type="button" className={`${btnSecondary} !min-h-9 !px-2`} disabled={index >= count - 1} onClick={() => onChange(index + 1)} aria-label={t("viewer.next")}>
        <ChevronRight aria-hidden className="size-4" />
      </button>
    </span>
  );
}

/**
 * Live hall preview: the real 3D scene (embedded variant) fed with unsaved form
 * state. Only the previous/next buttons below navigate it.
 */
export function HallPreview({ theme, name, style, artworks }: HallPreviewProps) {
  const { t } = useI18n();
  const usingSamples = artworks.length === 0;
  const shown = useMemo(() => (usingSamples ? sampleViewerArtworks(style.defaultFrameStyle) : artworks), [usingSamples, artworks, style.defaultFrameStyle]);
  const [requestedSlot, setSlot] = useState(0);
  const slot = Math.min(requestedSlot, shown.length - 1);

  const museum = useMemo(
    () => ({
      title: name || "Hall",
      theme,
      halls: [{ id: "preview", name: name || "Hall", description: null, style, coverUrl: null, artworks: shown }],
      otherArtworks: [],
    }),
    [name, theme, style, shown],
  );

  return (
    <figure className="m-0 flex flex-col gap-2">
      <div className="relative h-[300px] overflow-hidden rounded-theme border border-line bg-canvas sm:h-[360px]" style={theme.cssVars}>
        {/* stop 0 is the hall entrance; artworks follow */}
        <GalleryEmbed museum={museum} stopIndex={slot + 1} label={t("viewer.preview")} />
      </div>
      <figcaption className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted">{usingSamples ? t("viewer.previewSamples") : t("viewer.previewReal")}</span>
        <StepButtons index={slot} count={shown.length} onChange={setSlot} />
      </figcaption>
    </figure>
  );
}

/** Live museum preview: the whole 3D museum, embedded and driven by the unsaved appearance. */
export function MuseumPreview({ museum }: { museum: ViewerMuseum }) {
  const { t } = useI18n();
  const layout = useMemo(() => buildLayout(toLayoutZones(galleryZones(museum))), [museum]);
  const [requested, setStop] = useState<number | null>(null);
  const stop = Math.min(requested ?? layout.firstArtworkStop, Math.max(layout.stops.length - 1, 0));

  return (
    <figure className="m-0 flex flex-col gap-2">
      <div className="relative h-[420px] overflow-hidden rounded-theme border border-line bg-canvas text-fg sm:h-[500px]" style={museum.theme.cssVars}>
        <GalleryEmbed museum={museum} stopIndex={stop} label={t("viewer.preview")} />
      </div>
      <figcaption className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted">{t("viewer.previewReal")}</span>
        <StepButtons index={stop} count={layout.stops.length} onChange={setStop} />
      </figcaption>
    </figure>
  );
}
