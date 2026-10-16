"use client";

import { ArrowDown, ArrowUp, Eye, EyeOff, Palette, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createHall, deleteHall, reorderHalls, setHallVisible } from "@/app/admin/actions/halls";
import { btnDanger, btnIconSm, btnPrimary, btnSecondary, cardClass, EmptyState, Field, inputClass, Spinner } from "@/components/admin/ui";

type HallItem = { id: string; name: string; description: string | null; isVisible: boolean; artworkCount: number };

export function HallsManager({ halls: initial }: { halls: HallItem[] }) {
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
      toast.success("Hall created");
      router.push(`/admin/halls/${result.data.id}`);
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
    const detail = hall.artworkCount
      ? ` Its ${hall.artworkCount} artwork${hall.artworkCount === 1 ? "" : "s"} will stay in your museum as unassigned.`
      : "";
    if (!window.confirm(`Delete the hall "${hall.name}"?${detail}`)) return;
    setBusyId(hall.id);
    const result = await deleteHall(hall.id);
    setBusyId(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Hall deleted");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={create} className={`${cardClass} flex flex-col gap-3 p-4 sm:flex-row sm:items-end`}>
        <div className="flex-1">
          <Field id="new-hall" label="New hall">
            <input
              id="new-hall"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={80}
              placeholder="e.g. Impressionists"
              className={inputClass}
            />
          </Field>
        </div>
        <button type="submit" disabled={creating || !name.trim()} className={btnPrimary}>
          {creating ? <Spinner /> : <Plus aria-hidden className="size-4" />}
          Add hall
        </button>
      </form>

      {halls.length === 0 ? (
        <EmptyState title="No halls yet" description="Create your first hall above, then fill it with artworks." />
      ) : (
        <ol className="flex flex-col gap-3">
          {halls.map((hall, index) => (
            <li key={hall.id} className={`${cardClass} flex flex-wrap items-center gap-3 p-3 sm:p-4`}>
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface text-sm font-semibold" aria-hidden>
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <Link href={`/admin/halls/${hall.id}`} className="block truncate font-display text-lg font-semibold hover:underline">
                  {hall.name}
                </Link>
                <p className="text-sm text-muted">
                  {hall.artworkCount} {hall.artworkCount === 1 ? "artwork" : "artworks"}
                  {hall.isVisible ? "" : " · Hidden from visitors"}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <button type="button" className={btnIconSm} onClick={() => move(index, -1)} disabled={index === 0} aria-label={`Move ${hall.name} up`}>
                  <ArrowUp aria-hidden className="size-4" />
                </button>
                <button type="button" className={btnIconSm} onClick={() => move(index, 1)} disabled={index === halls.length - 1} aria-label={`Move ${hall.name} down`}>
                  <ArrowDown aria-hidden className="size-4" />
                </button>
                <button
                  type="button"
                  className={btnIconSm}
                  onClick={() => toggleVisible(hall)}
                  aria-pressed={hall.isVisible}
                  aria-label={hall.isVisible ? `Hide ${hall.name}` : `Show ${hall.name}`}
                  title={hall.isVisible ? "Visible to visitors" : "Hidden from visitors"}
                >
                  {hall.isVisible ? <Eye aria-hidden className="size-4" /> : <EyeOff aria-hidden className="size-4" />}
                </button>
                <Link href={`/admin/halls/${hall.id}`} className={`${btnSecondary} !min-h-9`}>
                  <Palette aria-hidden className="size-4" />
                  Edit
                </Link>
                <button type="button" className={`${btnDanger} !min-h-9 !px-2.5`} onClick={() => remove(hall)} disabled={busyId === hall.id} aria-label={`Delete ${hall.name}`}>
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
