"use client";

import { AnimatePresence, motion } from "motion/react";

type Props = {
  title: string;
  tagline: string | null;
  visible: boolean;
  progress: number;
  loading: string;
  accent: string;
};

/** Museum-quality loading curtain: the name, a hairline progress bar, then a soft fade. */
export function LoadingScreen({ title, tagline, visible, progress, loading, accent }: Props) {
  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          key="curtain"
          className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-canvas px-8 text-center text-fg"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.1, ease: "easeInOut" }}
          role="status"
          aria-live="polite"
        >
          <h2 className="max-w-3xl font-display text-4xl leading-tight font-semibold tracking-wide sm:text-6xl">{title}</h2>
          {tagline ? <p className="max-w-xl text-base tracking-wide text-muted sm:text-lg">{tagline}</p> : null}
          <div className="mt-4 flex w-56 flex-col items-center gap-3">
            <div className="h-px w-full overflow-hidden bg-line">
              <div className="h-full origin-left transition-transform duration-500 ease-out" style={{ background: accent, transform: `scaleX(${Math.max(0.04, Math.min(1, progress / 100))})` }} />
            </div>
            <p className="text-xs tracking-[0.28em] text-muted uppercase">{loading}</p>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
