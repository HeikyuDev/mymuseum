"use client";

import { ArrowDown, ArrowUp, Eye, EyeOff, Palette, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createHall, deleteHall, reorderHalls, setHallVisible } from "@/app/studio/actions/halls";
import { btnDanger, btnIconSm, btnPrimary, btnSecondary, cardClass, EmptyState, Field, inputClass, Spinner } from "@/components/ui/panel";
import { useI18n } from "@/lib/i18n/provider";

type HallItem = { id: string; name: string; description: string | null; isVisible: boolean; artworkCount: number };

export function HallsManager({ halls: initial }: { halls: HallItem[] }) {
  const { t } = useI18n();
  const router = useRouter();
  const [halls, setHalls] = useState(initial);
  const [syncedFrom, setSyncedFrom] = useState(initial);
  const [name, setName] = useState("");
  const [creating, startCreate] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  // Adopt fresh server data after router.refresh().
  if (initial !== syncedFrom) {
    setSyncedFrom(initial);
    setHalls(initial);
  }

  const countLabel = (count: number) => (count === 1 ? t("cat.artworksOne", { count }) : t("cat.artworksOther", { count }));

  function create(event: React.FormEvent) {
    event.preventDefault();
    const value = name.trim();
    if (!value) return;
    startCreate(async () => {
      const result = await createHall({ name: value });
      if (!result.ok) {
        toast.error(result.fieldErrors?.name ?? result.error);
        return;
      }
      setName("");
      toast.success(t("cat.created"));
      router.push(`/studio/halls/${result.data.id}`);
    });
  }

  async function move(index: number, delta: -1 | 1) {
    const target = index + delta;
    if (target < 0 || target >= halls.length) return;
    const previous = halls;
    const next = [...halls];
    [next[index], next[target]] = [next[target], next[index]];
    setHalls(next);
    const result = await reorderHalls(next.map((hall) => hall.id));
    if (!result.ok) {
      setHalls(previous);
      toast.error(result.error);
    } else {
      router.refresh();
    }
  }

  async function toggleVisible(hall: HallItem) {
    setHalls((current) => current.map((item) => (item.id === hall.id ? { ...item, isVisible: !hall.isVisible } : item)));
    const result = await setHallVisible(hall.id, !hall.isVisible);
    if (!result.ok) {
      setHalls((current) => current.map((item) => (item.id === hall.id ? { ...item, isVisible: hall.isVisible } : item)));
      toast.error(result.error);
    } else {
      router.refresh();
    }
  }

  async function remove(hall: HallItem) {
    const detail =
      hall.artworkCount === 0
        ? ""
        : hall.artworkCount === 1
          ? t("cat.confirmDeleteArtworksOne")
          : t("cat.confirmDeleteArtworksOther", { count: hall.artworkCount });
    if (!window.confirm(`${t("cat.confirmDelete", { name: hall.name })}${detail}`)) return;
    setBusyId(hall.id);
    const result = await deleteHall(hall.id);
    setBusyId(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(t("cat.deleted"));
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={create} className={`${cardClass} flex flex-col gap-3 p-4 sm:flex-row sm:items-end`}>
        <div className="flex-1">
          <Field id="new-hall" label={t("cat.new")}>
            <input
              id="new-hall"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={80}
              placeholder={t("cat.placeholder")}
              className={inputClass}
            />
          </Field>
        </div>
        <button type="submit" disabled={creating || !name.trim()} className={btnPrimary}>
          {creating ? <Spinner /> : <Plus aria-hidden className="size-4" />}
          {t("cat.add")}
        </button>
      </form>

      {halls.length === 0 ? (
        <EmptyState title={t("cat.emptyTitle")} description={t("cat.emptyBody")} />
      ) : (
        <ol className="flex flex-col gap-3">
          {halls.map((hall, index) => (
            <li key={hall.id} className={`${cardClass} flex flex-wrap items-center gap-3 p-3 sm:p-4`}>
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface text-sm font-semibold" aria-hidden>
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <Link href={`/studio/halls/${hall.id}`} className="block truncate font-display text-lg font-semibold hover:underline">
                  {hall.name}
                </Link>
                <p className="text-sm text-muted">
                  {countLabel(hall.artworkCount)}
                  {hall.isVisible ? "" : ` · ${t("cat.hiddenNote")}`}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <button type="button" className={btnIconSm} onClick={() => move(index, -1)} disabled={index === 0} aria-label={t("cat.moveUp", { name: hall.name })}>
                  <ArrowUp aria-hidden className="size-4" />
                </button>
                <button type="button" className={btnIconSm} onClick={() => move(index, 1)} disabled={index === halls.length - 1} aria-label={t("cat.moveDown", { name: hall.name })}>
                  <ArrowDown aria-hidden className="size-4" />
                </button>
                <button
                  type="button"
                  className={btnIconSm}
                  onClick={() => toggleVisible(hall)}
                  aria-pressed={hall.isVisible}
                  aria-label={hall.isVisible ? t("cat.hide", { name: hall.name }) : t("cat.show", { name: hall.name })}
                  title={hall.isVisible ? t("cat.visibleTitle") : t("cat.hiddenTitle")}
                >
                  {hall.isVisible ? <Eye aria-hidden className="size-4" /> : <EyeOff aria-hidden className="size-4" />}
                </button>
                <Link href={`/studio/halls/${hall.id}`} className={`${btnSecondary} !min-h-9`}>
                  <Palette aria-hidden className="size-4" />
                  {t("common.edit")}
                </Link>
                <button type="button" className={`${btnDanger} !min-h-9 !px-2.5`} onClick={() => remove(hall)} disabled={busyId === hall.id} aria-label={t("cat.deleteAria", { name: hall.name })}>
                  {busyId === hall.id ? <Spinner /> : <Trash2 aria-hidden className="size-4" />}
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
