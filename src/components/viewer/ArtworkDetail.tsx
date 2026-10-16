/* eslint-disable @next/next/no-img-element */
"use client";

import { motion } from "motion/react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useEffect, useRef } from "react";
import type { ViewerArtwork } from "@/lib/museum-data";
import { btnGhost, btnIcon } from "./ui";

type Props = {
  artwork: ViewerArtwork;
  position: number;
  total: number;
  reduced: boolean;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
};

const FOCUSABLE = 'button, [href], [tabindex]:not([tabindex="-1"])';

export function ArtworkDetail({ artwork, position, total, reduced, onPrev, onNext, onClose }: Props) {
  const panelRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    return () => previous?.focus?.();
  }, []);

  // Keep keyboard focus inside the dialog while it is open.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || !panelRef.current) return;
      const items = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const meta = [artwork.author, artwork.year].filter(Boolean).join(" · ");

  return (
    <motion.div
      className="absolute inset-0 z-30 flex items-end justify-center bg-canvas/60 backdrop-blur-sm sm:items-stretch sm:justify-end"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="artwork-detail-title"
        className="flex max-h-[88dvh] w-full flex-col overflow-hidden rounded-t-3xl border border-line bg-raised text-fg shadow-2xl sm:max-h-none sm:w-[26rem] sm:rounded-none sm:rounded-l-3xl"
        initial={reduced ? { opacity: 0 } : { y: 48, x: 0, opacity: 0 }}
        animate={{ y: 0, x: 0, opacity: 1 }}
        exit={reduced ? { opacity: 0 } : { y: 48, opacity: 0 }}
        transition={{ type: "spring", stiffness: 220, damping: 28 }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 p-4">
          <p className="text-sm text-muted">
            Artwork {position} of {total}
          </p>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Close details" className={btnIcon}>
            <X aria-hidden className="size-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-4">
          <div className="overflow-hidden rounded-theme bg-surface">
            <img src={artwork.imageUrl} alt={artwork.title} className="mx-auto max-h-64 w-full object-contain" />
          </div>
          <h2 id="artwork-detail-title" className="mt-5 font-display text-3xl leading-tight font-semibold">
            {artwork.title}
          </h2>
          {meta ? <p className="mt-1 text-base text-muted">{meta}</p> : null}
          {artwork.description ? (
            <p className="mt-4 text-base leading-relaxed whitespace-pre-line">{artwork.description}</p>
          ) : (
            <p className="mt-4 text-base text-muted">No description yet.</p>
          )}
        </div>

        <div className="flex gap-3 border-t border-line p-4">
          <button type="button" onClick={onPrev} disabled={position <= 1} className={`${btnGhost} flex-1`}>
            <ChevronLeft aria-hidden className="size-5" />
            Previous
          </button>
          <button type="button" onClick={onNext} disabled={position >= total} className={`${btnGhost} flex-1`}>
            Next
            <ChevronRight aria-hidden className="size-5" />
          </button>
        </div>
      </motion.aside>
    </motion.div>
  );
}
