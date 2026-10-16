"use client";

import { useReducedMotion } from "motion/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { HallScene } from "@/components/viewer/HallScene";
import { MuseumExperience } from "@/components/viewer/MuseumExperience";
import type { ResolvedHallStyle } from "@/lib/hall-style";
import type { ResolvedMuseumTheme } from "@/lib/theme";
import type { ViewerArtwork, ViewerHall, ViewerMuseum } from "@/lib/viewer-model";
import { btnSecondary } from "./ui";
import { sampleViewerArtworks } from "./sample-art";

type HallPreviewProps = {
  theme: ResolvedMuseumTheme;
  name: string;
  style: ResolvedHallStyle;
  /** Real artworks of the hall; samples are used when the hall is empty. */
  artworks: ViewerArtwork[];
};

/**
 * Live hall preview: the real HallScene fed with unsaved form state, contained
 * and non-navigating (no neighbouring doors, details or hall switching).
 */
export function HallPreview({ theme, name, style, artworks }: HallPreviewProps) {
  const reduced = useReducedMotion() ?? false;
  const usingSamples = artworks.length === 0;
  const shown = useMemo(
    () => (usingSamples ? sampleViewerArtworks(style.defaultFrameStyle) : artworks),
    [usingSamples, artworks, style.defaultFrameStyle],
  );
  const [requestedSlot, setSlot] = useState(0);
  const slot = Math.min(requestedSlot, shown.length - 1);

  const hall: ViewerHall = { id: "preview", name, description: null, style, coverUrl: null, artworks: shown };

  return (
    <figure className="m-0 flex flex-col gap-2">
      <div
        className="relative h-[300px] overflow-hidden rounded-theme border border-line bg-canvas sm:h-[360px]"
        style={theme.cssVars}
        role="img"
        aria-label={`Live preview of ${name || "the hall"}`}
      >
        <HallScene
          hall={hall}
          slot={slot}
          prevHall={null}
          nextHall={null}
          reduced={reduced}
          spring={theme.spring}
          onSelect={setSlot}
          onEnter={() => {}}
          onOpen={() => {}}
        />
      </div>
      <figcaption className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted">{usingSamples ? "Showing sample artworks." : "Live preview with your artworks."}</span>
        <span className="flex gap-1">
          <button type="button" className={`${btnSecondary} !min-h-9 !px-2`} disabled={slot <= 0} onClick={() => setSlot(slot - 1)} aria-label="Previous artwork in preview">
            <ChevronLeft aria-hidden className="size-4" />
          </button>
          <button type="button" className={`${btnSecondary} !min-h-9 !px-2`} disabled={slot >= shown.length - 1} onClick={() => setSlot(slot + 1)} aria-label="Next artwork in preview">
            <ChevronRight aria-hidden className="size-4" />
          </button>
        </span>
      </figcaption>
    </figure>
  );
}

/** Live museum preview: the real MuseumExperience in embedded mode. */
export function MuseumPreview({ museum }: { museum: ViewerMuseum }) {
  return (
    <div
      className="relative h-[460px] overflow-hidden rounded-theme border border-line bg-canvas text-fg sm:h-[540px]"
      style={museum.theme.cssVars}
    >
      <MuseumExperience museum={museum} embedded />
    </div>
  );
}
