/* eslint-disable @next/next/no-img-element */
"use client";

import { ArrowRight } from "lucide-react";
import type { ViewerMuseum } from "@/lib/museum-data";
import { floorLayer, wallLayer } from "./scenery";

type Props = {
  museum: ViewerMuseum;
  onEnterHall: (index: number) => void;
};

export function Landing({ museum, onEnterHall }: Props) {
  return (
    <div className="h-full overflow-y-auto">
      <div
        className="mx-auto flex min-h-full w-full max-w-6xl flex-col px-5 sm:px-8"
        style={{ paddingBlock: "calc(2.5rem * var(--v-density))" }}
      >
        <header className="mx-auto max-w-3xl text-center" style={{ paddingBlock: "calc(2.5rem * var(--v-density))" }}>
          <p className="text-sm font-medium tracking-[0.25em] text-accent-text uppercase">Virtual museum</p>
          <h1 className="mt-4 font-display text-5xl leading-[1.05] font-semibold tracking-tight text-balance sm:text-6xl">
            {museum.title}
          </h1>
          <div aria-hidden className="mx-auto mt-6 h-px w-24 bg-accent" />
          {museum.tagline ? <p className="mt-6 text-xl text-muted text-balance">{museum.tagline}</p> : null}
          {museum.description ? (
            <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-muted">{museum.description}</p>
          ) : null}
        </header>

        <section aria-labelledby="halls-heading" className="mt-6 pb-10">
          <h2 id="halls-heading" className="mb-5 text-sm font-semibold tracking-[0.2em] text-muted uppercase">
            Choose a hall
          </h2>
          {museum.halls.length === 0 ? (
            <p className="rounded-theme border border-line bg-raised p-8 text-center text-muted">
              This museum does not have any halls yet. Please check back soon.
            </p>
          ) : (
            <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {museum.halls.map((hall, index) => {
                const count = hall.artworks.length;
                const wall = wallLayer(hall.style.wallStyle, hall.style.wallColor);
                const floor = floorLayer(hall.style.floorStyle);
                return (
                  <li key={hall.id}>
                    <button
                      type="button"
                      onClick={() => onEnterHall(index)}
                      aria-label={`Enter ${hall.name}, ${count} ${count === 1 ? "artwork" : "artworks"}`}
                      className="group flex h-full w-full cursor-pointer flex-col overflow-hidden rounded-theme border border-line bg-raised text-left shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl"
                    >
                      <div className="relative aspect-[4/3] w-full overflow-hidden" style={wall}>
                        <div className="absolute inset-x-0 bottom-0 h-1/4" style={floor} aria-hidden />
                        {hall.coverUrl ? (
                          <img
                            src={hall.coverUrl}
                            alt=""
                            loading="lazy"
                            className="absolute top-[12%] left-1/2 h-[56%] w-auto max-w-[80%] -translate-x-1/2 object-cover shadow-[6px_10px_18px_rgba(0,0,0,0.35)] ring-[5px] ring-white transition duration-500 group-hover:scale-105"
                          />
                        ) : null}
                        <div
                          aria-hidden
                          className="absolute inset-0"
                          style={{ background: "radial-gradient(ellipse at 50% 40%, transparent 55%, rgba(0,0,0,.25))" }}
                        />
                      </div>
                      <div className="flex flex-1 flex-col gap-1 p-5">
                        {hall.id === museum.defaultHallId ? (
                          <span className="w-fit rounded-full bg-accent px-2.5 py-0.5 text-xs font-semibold text-on-accent">
                            Start here
                          </span>
                        ) : null}
                        <h3 className="font-display text-2xl font-semibold">{hall.name}</h3>
                        {hall.description ? (
                          <p className="line-clamp-2 text-sm text-muted">{hall.description}</p>
                        ) : null}
                        <div className="mt-auto flex items-center justify-between pt-4">
                          <span className="text-sm text-muted">
                            {count} {count === 1 ? "artwork" : "artworks"}
                          </span>
                          <span className="inline-flex items-center gap-1 text-base font-semibold text-accent-text">
                            Enter
                            <ArrowRight aria-hidden className="size-4 transition group-hover:translate-x-1" />
                          </span>
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
