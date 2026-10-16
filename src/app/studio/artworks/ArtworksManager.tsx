/* eslint-disable @next/next/no-img-element */
"use client";

import { ArrowLeft, ArrowRight, EyeOff, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { deleteArtworks, moveArtworksToHall, reorderArtworks } from "@/app/studio/actions/artworks";
import { PhotoExportButton } from "@/components/gallery/export/PhotoExportButton";
import { btnDanger, btnIconSm, btnSecondary, cardClass, EmptyState, Spinner } from "@/components/ui/panel";
import { useI18n } from "@/lib/i18n/provider";
import type { ViewerMuseum } from "@/lib/viewer-model";
import { UploadPanel } from "./UploadPanel";

type ArtworkItem = { id: string; title: string; hallId: string | null; imageUrl: string | null; isActive: boolean };
type HallItem = { id: string; name: string };

type Props = { museumId: string; halls: HallItem[]; artworks: ArtworkItem[]; viewerMuseum: ViewerMuseum };

const ALL = "all";
const NONE = "none";

export function ArtworksManager({ museumId, halls, artworks: initial, viewerMuseum }: Props) {
  const { t } = useI18n();
  const router = useRouter();
  const [artworks, setArtworks] = useState(initial);
  const [syncedFrom, setSyncedFrom] = useState(initial);
  const [filter, setFilter] = useState<string>(ALL);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [uploadHall, setUploadHall] = useState<string | null>(halls[0]?.id ?? null);
  const [moveTarget, setMoveTarget] = useState<string>("");
  const [busy, setBusy] = useState(false);

  // Adopt fresh server data after router.refresh().
  if (initial !== syncedFrom) {
    setSyncedFrom(initial);
    setArtworks(initial);
  }

  const hallName = (id: string | null) => halls.find((hall) => hall.id === id)?.name ?? t("art.unassigned");
  const visible = artworks.filter((artwork) => (filter === ALL ? true : filter === NONE ? !artwork.hallId : artwork.hallId === filter));
  const reorderable = filter !== ALL;
  const selectedVisible = visible.filter((artwork) => selected.has(artwork.id));

  const countFor = (key: string) =>
    artworks.filter((artwork) => (key === ALL ? true : key === NONE ? !artwork.hallId : artwork.hallId === key)).length;

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function bulkDelete() {
    const ids = selectedVisible.map((artwork) => artwork.id);
    if (ids.length === 0) return;
    const question = ids.length === 1 ? t("art.confirmDeleteOne") : t("art.confirmDeleteOther", { count: ids.length });
    if (!window.confirm(question)) return;
    setBusy(true);
    const result = await deleteArtworks(ids);
    setBusy(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setArtworks((current) => current.filter((artwork) => !ids.includes(artwork.id)));
    setSelected(new Set());
    toast.success(t("art.deletedCount", { count: result.data.deleted }));
    router.refresh();
  }

  async function bulkMove() {
    const ids = selectedVisible.map((artwork) => artwork.id);
    if (ids.length === 0) return;
    const target = moveTarget === NONE ? null : moveTarget;
    if (moveTarget === "") return;
    setBusy(true);
    const result = await moveArtworksToHall(ids, target);
    setBusy(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setArtworks((current) => current.map((artwork) => (ids.includes(artwork.id) ? { ...artwork, hallId: target } : artwork)));
    setSelected(new Set());
    setMoveTarget("");
    toast.success(t("art.movedTo", { name: hallName(target) }));
    router.refresh();
  }

  async function move(id: string, delta: -1 | 1) {
    const index = visible.findIndex((artwork) => artwork.id === id);
    const target = index + delta;
    if (index < 0 || target < 0 || target >= visible.length) return;
    const ordered = [...visible];
    [ordered[index], ordered[target]] = [ordered[target], ordered[index]];

    const previous = artworks;
    // Re-slot the reordered group into the positions the group occupied.
    const slots = artworks.map((artwork, i) => ({ artwork, i })).filter(({ artwork }) => visible.some((v) => v.id === artwork.id));
    const next = [...artworks];
    slots.forEach(({ i }, position) => {
      next[i] = ordered[position];
    });
    setArtworks(next);

    const result = await reorderArtworks(filter === NONE ? null : filter, ordered.map((artwork) => artwork.id));
    if (!result.ok) {
      setArtworks(previous);
      toast.error(result.error);
    } else {
      router.refresh();
    }
  }

  const filters = [
    { key: ALL, label: t("art.all") },
    { key: NONE, label: t("art.unassigned") },
    ...halls.map((hall) => ({ key: hall.id, label: hall.name })),
  ];

  return (
    <div className="flex flex-col gap-6">
      <UploadPanel
        museumId={museumId}
        halls={halls}
        hallId={uploadHall}
        onHallChange={setUploadHall}
        onFinished={() => router.refresh()}
      />

      <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t("art.filterAria")}>
        {filters.map((item) => (
          <button
            key={item.key}
            type="button"
            aria-pressed={filter === item.key}
            onClick={() => {
              setFilter(item.key);
              setSelected(new Set());
            }}
            className="min-h-9 rounded-full border border-line bg-raised px-3.5 text-sm font-medium transition hover:bg-surface aria-pressed:border-accent aria-pressed:bg-accent aria-pressed:text-on-accent"
          >
            {item.label} <span className="opacity-70">{countFor(item.key)}</span>
          </button>
        ))}
      </div>

      {selectedVisible.length > 0 ? (
        <div className={`${cardClass} sticky top-16 z-20 flex flex-wrap items-center gap-2 p-3`} role="region" aria-label={t("art.bulkAria")}>
          <span className="mr-auto text-sm font-medium">
            {selectedVisible.length === 1 ? t("art.selectedOne", { count: 1 }) : t("art.selectedOther", { count: selectedVisible.length })}
          </span>
          <label htmlFor="bulk-hall" className="sr-only">
            {t("art.moveSelectedTo")}
          </label>
          <select id="bulk-hall" value={moveTarget} onChange={(event) => setMoveTarget(event.target.value)} className="min-h-10 rounded-theme border border-line bg-raised px-2 text-sm">
            <option value="">{t("art.moveToCategory")}</option>
            <option value={NONE}>{t("art.unassigned")}</option>
            {halls.map((hall) => (
              <option key={hall.id} value={hall.id}>
                {hall.name}
              </option>
            ))}
          </select>
          <button type="button" className={btnSecondary} onClick={bulkMove} disabled={busy || !moveTarget}>
            {t("art.move")}
          </button>
          <button type="button" className={btnDanger} onClick={bulkDelete} disabled={busy}>
            {busy ? <Spinner /> : <Trash2 aria-hidden className="size-4" />}
            {t("common.delete")}
          </button>
          <button type="button" className={btnSecondary} onClick={() => setSelected(new Set())}>
            {t("art.clear")}
          </button>
        </div>
      ) : visible.length > 0 ? (
        <button type="button" className="self-start text-sm font-medium text-accent-text underline-offset-4 hover:underline" onClick={() => setSelected(new Set(visible.map((artwork) => artwork.id)))}>
          {t("art.selectAll", { count: visible.length })}
        </button>
      ) : null}

      {visible.length === 0 ? (
        <EmptyState
          title={artworks.length === 0 ? t("art.emptyTitle") : t("art.nothingTitle")}
          description={artworks.length === 0 ? t("art.emptyBody") : t("art.nothingBody")}
        />
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {visible.map((artwork, index) => (
            <li key={artwork.id} className={`${cardClass} relative flex flex-col overflow-hidden ${selected.has(artwork.id) ? "ring-2 ring-accent" : ""}`}>
              <div className="relative aspect-square bg-surface">
                {artwork.imageUrl ? (
                  <img src={artwork.imageUrl} alt={artwork.title} loading="lazy" className="size-full object-cover" />
                ) : (
                  <div className="flex size-full items-center justify-center text-sm text-muted">{t("art.noImage")}</div>
                )}
                <label className="absolute top-2 left-2 flex size-8 cursor-pointer items-center justify-center rounded-theme bg-raised/90 shadow">
                  <input type="checkbox" checked={selected.has(artwork.id)} onChange={() => toggle(artwork.id)} aria-label={t("art.selectAria", { title: artwork.title })} className="size-4 accent-[var(--v-accent)]" />
                </label>
                {!artwork.isActive ? (
                  <span className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-full bg-raised/90 px-2 py-0.5 text-xs font-medium shadow">
                    <EyeOff aria-hidden className="size-3" /> {t("art.hidden")}
                  </span>
                ) : null}
              </div>
              <div className="flex flex-1 flex-col gap-2 p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{artwork.title}</p>
                  <p className="truncate text-xs text-muted">{hallName(artwork.hallId)}</p>
                </div>
                <div className="mt-auto flex items-center gap-1.5">
                  <Link href={`/studio/artworks/${artwork.id}`} className={`${btnSecondary} !min-h-9 flex-1 !px-2`}>
                    <Pencil aria-hidden className="size-3.5" />
                    {t("common.edit")}
                  </Link>
                  {artwork.imageUrl ? (
                    <PhotoExportButton
                      mode="admin"
                      museum={viewerMuseum}
                      artworkId={artwork.id}
                      ariaLabel={t("art.exportAria", { title: artwork.title })}
                      className={`${btnIconSm} [&>svg]:size-4`}
                    />
                  ) : null}
                  {reorderable ? (
                    <>
                      <button type="button" className={btnIconSm} disabled={index === 0} onClick={() => move(artwork.id, -1)} aria-label={t("art.earlier", { title: artwork.title })}>
                        <ArrowLeft aria-hidden className="size-4" />
                      </button>
                      <button type="button" className={btnIconSm} disabled={index === visible.length - 1} onClick={() => move(artwork.id, 1)} aria-label={t("art.later", { title: artwork.title })}>
                        <ArrowRight aria-hidden className="size-4" />
                      </button>
                    </>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      {reorderable && visible.length > 1 ? <p className="text-sm text-muted">{t("art.reorderHint")}</p> : null}
    </div>
  );
}
