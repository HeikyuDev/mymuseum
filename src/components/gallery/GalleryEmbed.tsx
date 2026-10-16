"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { sceneMood } from "@/lib/gallery/scene-look";
import { useI18n } from "@/lib/i18n/provider";
import type { ViewerMuseum } from "@/lib/viewer-model";
import { qualityFor, useDeviceProfile } from "./device";
import { GalleryCanvas } from "./GalleryCanvas";
import { buildGalleryModel } from "./GalleryScene";
import { useCanvasFonts } from "./use-canvas-fonts";

type Props = {
  museum: Pick<ViewerMuseum, "title" | "theme" | "halls" | "otherArtworks">;
  /** Index into the layout's stops (hall entrances and artworks, in walking order). */
  stopIndex: number;
  label: string;
  className?: string;
};

/**
 * Non-interactive embedded variant of the museum scene for the admin live
 * previews: smaller canvas, light quality tier, driven entirely by props (so
 * unsaved form state shows instantly) and paused while offscreen.
 */
export function GalleryEmbed({ museum, stopIndex, label, className = "" }: Props) {
  const { t } = useI18n();
  const device = useDeviceProfile(true);
  const fonts = useCanvasFonts(museum.theme.fontPairing, museum.title);
  const model = useMemo(() => buildGalleryModel(museum), [museum]);
  const mood = sceneMood(museum.theme.preset);
  const hostRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);
  const [compiled, setCompiled] = useState(false);
  const markCompiled = useCallback(() => setCompiled(true), []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.01 });
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  const safeStop = Math.min(Math.max(stopIndex, 0), Math.max(model.layout.stops.length - 1, 0));

  return (
    <div ref={hostRef} className={`relative h-full w-full overflow-hidden ${className}`} style={{ background: mood.background }}>
      {device?.webgl && fonts && model.layout.stops.length > 0 ? (
        <GalleryCanvas
          model={model}
          museumTitle={museum.title}
          preset={museum.theme.preset}
          accent={museum.theme.accent}
          fonts={fonts}
          quality={qualityFor(device)}
          otherLabel={t("viewer.other")}
          stopIndex={safeStop}
          reducedMotion={device.reducedMotion}
          interactive={false}
          frameloop={visible && compiled ? "demand" : "never"}
          onCompiled={markCompiled}
          label={label}
        />
      ) : null}
    </div>
  );
}
