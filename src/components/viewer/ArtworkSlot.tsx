"use client";

import { motion, useTransform, type MotionValue } from "motion/react";
import { useState } from "react";
import type { ViewerArtwork } from "@/lib/museum-data";
import type { Lighting } from "./scenery";
import { ArtworkFrame, computeFrame } from "./ArtworkFrame";

const DEFAULT_RATIO = 4 / 3;

type Props = {
  artwork: ViewerArtwork;
  index: number;
  isActive: boolean;
  /** Distance in px between slot centers. */
  spacing: number;
  camera: MotionValue<number>;
  maxW: number;
  maxH: number;
  centerY: number;
  wallTop: number;
  lighting: Lighting;
  nearActive: boolean;
  onActivate: (index: number) => void;
  onOpen: () => void;
};

/** One framed artwork hanging on the wall strip. Focus (scale, blur, dim) follows the camera. */
export function ArtworkSlot({
  artwork,
  index,
  isActive,
  spacing,
  camera,
  maxW,
  maxH,
  centerY,
  wallTop,
  lighting,
  nearActive,
  onActivate,
  onOpen,
}: Props) {
  const [loadedRatio, setLoadedRatio] = useState<number | null>(null);
  const ratio = artwork.aspect ?? loadedRatio ?? DEFAULT_RATIO;
  const metrics = computeFrame(ratio, maxW, maxH, artwork.frameStyle, artwork.mat);

  const distance = useTransform(camera, (v) => Math.min(Math.abs(v - index * spacing) / spacing, 1.4));
  const scale = useTransform(distance, [0, 1, 1.4], [1, 0.88, 0.84]);
  const opacity = useTransform(distance, [0, 1, 1.4], [1, 0.6, 0.45]);
  const filter = useTransform(distance, (d) => {
    const k = Math.min(d, 1);
    return `blur(${(k * 3).toFixed(2)}px) brightness(${(1 - k * 0.22).toFixed(3)})`;
  });
  const coneOpacity = useTransform(distance, [0, 0.8], [1, 0]);

  const coneHeight = centerY - metrics.h / 2 - wallTop;

  return (
    <div className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: index * spacing, top: centerY }}>
    <motion.div style={{ scale, opacity, filter }}>
      {/* Ceiling spotlight cone and wall glow */}
      <motion.div aria-hidden className="pointer-events-none absolute left-1/2" style={{ opacity: coneOpacity }}>
        <div
          style={{
            position: "absolute",
            width: metrics.w * 1.7,
            height: coneHeight + metrics.h * 0.5,
            left: -(metrics.w * 1.7) / 2,
            top: -coneHeight,
            background: `linear-gradient(to bottom, rgba(${lighting.tint}, ${lighting.cone}), rgba(${lighting.tint}, 0))`,
            clipPath: "polygon(42% 0, 58% 0, 100% 100%, 0 100%)",
            filter: "blur(6px)",
          }}
        />
        <div
          style={{
            position: "absolute",
            width: metrics.w * 2,
            height: metrics.h * 1.6,
            left: -metrics.w,
            top: -metrics.h * 0.3,
            background: `radial-gradient(ellipse at center, rgba(${lighting.tint}, ${lighting.cone * 0.7}), rgba(${lighting.tint}, 0) 68%)`,
          }}
        />
      </motion.div>

      <button
        type="button"
        onClick={() => (isActive ? onOpen() : onActivate(index))}
        aria-label={isActive ? `View details for ${artwork.title}` : `Go to ${artwork.title}`}
        className="relative block cursor-pointer rounded-sm focus-visible:outline-offset-8"
      >
        <ArtworkFrame artwork={artwork} metrics={metrics} eager={nearActive} onLoadRatio={setLoadedRatio} />
      </button>
    </motion.div>
    </div>
  );
}
