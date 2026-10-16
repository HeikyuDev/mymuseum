/* eslint-disable @next/next/no-img-element */
"use client";

import { AnimatePresence, motion, useReducedMotion, type Variants } from "motion/react";
import { ArrowLeft, ChevronDown, ChevronLeft, ChevronRight, DoorOpen, Info } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ViewerMuseum } from "@/lib/museum-data";
import { ArtworkDetail } from "./ArtworkDetail";
import { ExportStoryButton } from "./ExportStoryButton";
import { HallScene } from "./HallScene";
import { Landing } from "./Landing";
import { btnGhost, btnPrimary } from "./ui";

// Walking through a doorway: the old hall dollies forward and brightens while
// the new hall emerges from the light. Both overlap, so there is never a cut.
const hallVariants: Variants = {
  enter: { opacity: 0, scale: 0.86, filter: "blur(10px) brightness(1.5)" },
  center: {
    opacity: 1,
    scale: 1,
    filter: "blur(0px) brightness(1)",
    transition: { duration: 0.95, ease: [0.22, 0.8, 0.3, 1] },
  },
  exit: {
    opacity: 0,
    scale: 1.55,
    filter: "blur(8px) brightness(1.7)",
    transition: { duration: 0.85, ease: [0.5, 0, 0.8, 0.4] },
  },
};
const fadeVariants: Variants = {
  enter: { opacity: 0 },
  center: { opacity: 1, transition: { duration: 0.25 } },
  exit: { opacity: 0, transition: { duration: 0.2 } },
};
const TRANSITION_LOCK_MS = 950;

type View = "landing" | "hall";

export function MuseumExperience({ museum }: { museum: ViewerMuseum }) {
  const reduced = useReducedMotion() ?? false;
  const [view, setView] = useState<View>("landing");
  const [hallIndex, setHallIndex] = useState(0);
  const [slot, setSlot] = useState(0);
  const [detailOpen, setDetailOpen] = useState(false);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const lockRef = useRef(false);
  const lockTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const halls = museum.halls;
  const hall = halls[hallIndex];
  const prevHall = halls[hallIndex - 1] ?? null;
  const nextHall = halls[hallIndex + 1] ?? null;
  const n = hall?.artworks.length ?? 0;
  const minSlot = prevHall && n > 0 ? -1 : 0;
  const maxSlot = nextHall && n > 0 ? n : n - 1;

  useEffect(() => () => {
    if (lockTimer.current) clearTimeout(lockTimer.current);
  }, []);

  const enterHall = useCallback(
    (index: number, from: "start" | "end" = "start") => {
      if (lockRef.current || !halls[index]) return;
      lockRef.current = true;
      lockTimer.current = setTimeout(() => {
        lockRef.current = false;
      }, TRANSITION_LOCK_MS);
      const count = halls[index].artworks.length;
      setHallIndex(index);
      setSlot(from === "end" ? Math.max(count - 1, 0) : 0);
      setDetailOpen(false);
      setSwitcherOpen(false);
      setView("hall");
    },
    [halls],
  );

  const goNext = useCallback(() => {
    if (slot === n && nextHall) enterHall(hallIndex + 1, "start");
    else if (slot < maxSlot) setSlot(slot + 1);
  }, [slot, n, nextHall, hallIndex, maxSlot, enterHall]);

  const goPrev = useCallback(() => {
    if (slot === -1 && prevHall) enterHall(hallIndex - 1, "end");
    else if (slot > minSlot) setSlot(slot - 1);
  }, [slot, prevHall, hallIndex, minSlot, enterHall]);

  const enterDoor = useCallback(
    (direction: 1 | -1) => (direction === 1 ? enterHall(hallIndex + 1, "start") : enterHall(hallIndex - 1, "end")),
    [enterHall, hallIndex],
  );

  // Keyboard: arrows move along the wall, Escape closes overlays.
  useEffect(() => {
    if (view !== "hall") return;
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (event.key === "ArrowRight") {
        event.preventDefault();
        goNext();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        goPrev();
      } else if (event.key === "Escape") {
        if (detailOpen) setDetailOpen(false);
        else if (switcherOpen) setSwitcherOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [view, goNext, goPrev, detailOpen, switcherOpen]);

  const variants = reduced ? fadeVariants : hallVariants;
  const active = slot >= 0 && slot < n ? hall.artworks[slot] : null;
  const atPrevDoor = slot === -1 && !!prevHall;
  const atNextDoor = slot === n && n > 0 && !!nextHall;

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-canvas text-fg">
      <AnimatePresence initial={false}>
        {view === "landing" ? (
          <motion.div
            key="landing"
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: reduced ? 1 : 1.04 }}
            transition={{ duration: 0.5 }}
          >
            <Landing museum={museum} onEnterHall={(index) => enterHall(index)} />
          </motion.div>
        ) : (
          <motion.div
            key="hall-view"
            className="absolute inset-0 flex flex-col"
            initial={{ opacity: 0, scale: reduced ? 1 : 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
          >
            <header className="relative z-20 flex items-center gap-3 border-b border-line bg-raised/90 px-3 py-2 backdrop-blur sm:px-5">
              <button type="button" onClick={() => setView("landing")} className={btnGhost} aria-label="Back to museum entrance">
                <ArrowLeft aria-hidden className="size-5" />
                <span className="hidden sm:inline">Entrance</span>
              </button>
              <div className="min-w-0 flex-1 text-center">
                <p className="truncate text-xs tracking-[0.2em] text-muted uppercase">{museum.title}</p>
                <h1 className="truncate font-display text-xl font-semibold sm:text-2xl">{hall?.name}</h1>
              </div>
              <div className="relative">
                <button
                  type="button"
                  className={btnGhost}
                  aria-expanded={switcherOpen}
                  aria-haspopup="true"
                  aria-controls="hall-switcher"
                  onClick={() => setSwitcherOpen((open) => !open)}
                >
                  <DoorOpen aria-hidden className="size-5" />
                  <span className="hidden sm:inline">Halls</span>
                  <ChevronDown aria-hidden className="size-4" />
                </button>
                {switcherOpen ? (
                  <>
                    <button
                      type="button"
                      aria-label="Close hall list"
                      tabIndex={-1}
                      className="fixed inset-0 z-10 cursor-default"
                      onClick={() => setSwitcherOpen(false)}
                    />
                    <ul
                      id="hall-switcher"
                      className="absolute top-full right-0 z-20 mt-2 w-64 overflow-hidden rounded-theme border border-line bg-raised p-1 shadow-xl"
                    >
                      {halls.map((item, index) => (
                        <li key={item.id}>
                          <button
                            type="button"
                            aria-current={index === hallIndex ? "true" : undefined}
                            onClick={() => (index === hallIndex ? setSwitcherOpen(false) : enterHall(index))}
                            className="flex min-h-12 w-full items-center justify-between gap-3 rounded-theme px-3 text-left hover:bg-surface aria-[current=true]:bg-surface aria-[current=true]:font-semibold"
                          >
                            <span className="truncate">{item.name}</span>
                            <span className="text-sm text-muted">{item.artworks.length}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : null}
              </div>
            </header>

            <div className="relative min-h-0 flex-1">
              <AnimatePresence initial={false}>
                <motion.div
                  key={hall.id}
                  className="absolute inset-0"
                  variants={variants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                >
                  {n > 0 ? (
                    <HallScene
                      hall={hall}
                      slot={slot}
                      prevHall={prevHall}
                      nextHall={nextHall}
                      reduced={reduced}
                      spring={museum.theme.spring}
                      onSelect={setSlot}
                      onEnter={enterDoor}
                      onOpen={() => setDetailOpen(true)}
                    />
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center gap-4 bg-surface px-6 text-center">
                      <h2 className="font-display text-3xl font-semibold">This hall is empty</h2>
                      <p className="max-w-sm text-muted">No artworks are on display here yet. Try another hall.</p>
                      <div className="flex flex-wrap justify-center gap-3">
                        {prevHall ? (
                          <button type="button" className={btnGhost} onClick={() => enterHall(hallIndex - 1, "end")}>
                            {prevHall.name}
                          </button>
                        ) : null}
                        {nextHall ? (
                          <button type="button" className={btnPrimary} onClick={() => enterHall(hallIndex + 1)}>
                            {nextHall.name}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>

              <AnimatePresence>
                {detailOpen && active ? (
                  <ArtworkDetail
                    key="detail"
                    artwork={active}
                    position={slot + 1}
                    total={n}
                    reduced={reduced}
                    onPrev={() => setSlot((s) => Math.max(s - 1, 0))}
                    onNext={() => setSlot((s) => Math.min(s + 1, n - 1))}
                    onClose={() => setDetailOpen(false)}
                  />
                ) : null}
              </AnimatePresence>
            </div>

            {n > 0 ? (
              <footer className="relative z-20 border-t border-line bg-raised/95 backdrop-blur">
                <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 px-3 pt-3 pb-3 sm:px-5">
                  <div className="min-h-14 text-center" aria-live="polite">
                    {active ? (
                      <>
                        <h2 className="truncate font-display text-xl font-semibold sm:text-2xl">{active.title}</h2>
                        <p className="truncate text-sm text-muted">
                          {[active.author, active.year].filter(Boolean).join(" · ") || "Unknown artist"}
                        </p>
                      </>
                    ) : (
                      <>
                        <h2 className="truncate font-display text-xl font-semibold sm:text-2xl">
                          Doorway to {(atPrevDoor ? prevHall : nextHall)?.name}
                        </h2>
                        <p className="text-sm text-muted">Press the button to walk through.</p>
                      </>
                    )}
                  </div>

                  <div className="flex items-center gap-2 sm:gap-3">
                    <button
                      type="button"
                      onClick={goPrev}
                      disabled={slot <= minSlot}
                      aria-label={atPrevDoor ? `Enter ${prevHall?.name}` : "Previous artwork"}
                      className={`${btnGhost} flex-1`}
                    >
                      <ChevronLeft aria-hidden className="size-5" />
                      {atPrevDoor ? "Enter" : "Previous"}
                    </button>
                    {active ? (
                      <button type="button" onClick={() => setDetailOpen(true)} className={`${btnPrimary} flex-[1.4]`}>
                        <Info aria-hidden className="size-5" />
                        Details
                      </button>
                    ) : null}
                    <ExportStoryButton museumSlug={museum.slug} hallId={hall.id} artworkId={active?.id} />
                    <button
                      type="button"
                      onClick={goNext}
                      disabled={slot >= maxSlot && !atNextDoor}
                      aria-label={atNextDoor ? `Enter ${nextHall?.name}` : "Next artwork"}
                      className={`${btnGhost} flex-1`}
                    >
                      {atNextDoor ? "Enter" : "Next"}
                      <ChevronRight aria-hidden className="size-5" />
                    </button>
                  </div>

                  <ThumbnailStrip hall={hall} slot={slot} reduced={reduced} onSelect={setSlot} />
                </div>
              </footer>
            ) : null}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ThumbnailStrip({
  hall,
  slot,
  reduced,
  onSelect,
}: {
  hall: ViewerMuseum["halls"][number];
  slot: number;
  reduced: boolean;
  onSelect: (slot: number) => void;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    refs.current[slot]?.scrollIntoView({ inline: "center", block: "nearest", behavior: reduced ? "auto" : "smooth" });
  }, [slot, reduced]);

  return (
    <nav aria-label="Artwork index">
      <ul className="flex gap-2 overflow-x-auto py-1">
        {hall.artworks.map((artwork, index) => (
          <li key={artwork.id} className="shrink-0">
            <button
              ref={(node) => {
                refs.current[index] = node;
              }}
              type="button"
              onClick={() => onSelect(index)}
              aria-label={`Go to ${artwork.title}`}
              aria-current={index === slot ? "true" : undefined}
              className="block size-14 overflow-hidden rounded-theme border border-line opacity-70 transition hover:opacity-100 aria-[current=true]:scale-105 aria-[current=true]:opacity-100 aria-[current=true]:ring-2 aria-[current=true]:ring-accent sm:size-16"
            >
              <img src={artwork.imageUrl} alt="" loading="lazy" className="size-full object-cover" />
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
