/* eslint-disable @next/next/no-img-element */
"use client";

import { useI18n } from "@/lib/i18n/provider";
import type { ViewerMuseum } from "@/lib/viewer-model";

/** Non-interactive notice plus a plain list of the museum's artworks, for browsers without WebGL. */
export function WebglFallback({ museum }: { museum: ViewerMuseum }) {
  const { t } = useI18n();
  const groups = [
    ...museum.halls.map((hall) => ({ id: hall.id, name: hall.name, artworks: hall.artworks })),
    ...(museum.otherArtworks.length > 0 ? [{ id: "other", name: t("viewer.other"), artworks: museum.otherArtworks }] : []),
  ].filter((group) => group.artworks.length > 0);

  return (
    <main className="min-h-dvh bg-canvas px-6 py-14 text-fg">
      <div className="mx-auto flex max-w-3xl flex-col gap-8">
        <header className="flex flex-col gap-3 text-center">
          <h1 className="font-display text-4xl font-semibold">{museum.title}</h1>
          <p className="text-lg font-semibold">{t("viewer.webglTitle")}</p>
          <p className="text-muted">{t("viewer.webglBody")}</p>
        </header>
        <section aria-label={t("viewer.galleryList")} className="flex flex-col gap-8">
          {groups.map((group) => (
            <div key={group.id} className="flex flex-col gap-3">
              <h2 className="font-display text-2xl">{group.name}</h2>
              <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                {group.artworks.map((artwork) => (
                  <li key={artwork.id} className="flex flex-col gap-2">
                    <img src={artwork.imageUrl} alt={artwork.title} loading="lazy" className="aspect-square w-full rounded-sm object-cover" />
                    <span className="text-sm">{artwork.title}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
