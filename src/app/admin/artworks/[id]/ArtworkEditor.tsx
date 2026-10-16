"use client";

import { ArrowLeft, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteArtworks, updateArtwork } from "@/app/admin/actions/artworks";
import { ColorField, OptionGroup, Toggle, frameOptions, type Option } from "@/components/admin/pickers";
import { SaveBar } from "@/components/admin/SaveBar";
import { ADMIN_THEME } from "@/lib/admin/theme";
import { storyHallsFromRows } from "@/lib/story/adapters";
import type { StoryMuseumInfo } from "@/lib/story/plan";
import { btnDanger, btnSecondary, cardClass, Field, inputClass, Spinner, textareaClass } from "@/components/admin/ui";
import { StoryExportButton } from "@/components/story/StoryExportButton";
import { ArtworkFrame, computeFrame } from "@/components/viewer/ArtworkFrame";
import { wallLayer } from "@/components/viewer/scenery";
import { useUnsavedGuard } from "@/hooks/useUnsavedGuard";
import { FRAME_STYLES, resolveHallStyle } from "@/lib/hall-style";
import { resolveFrameStyle } from "@/lib/viewer-model";
import type { ArtworkRow, FrameStyle, HallRow } from "@/types/database";

type FrameChoice = FrameStyle | "inherit";

type Draft = {
  title: string;
  author_name: string;
  year: string;
  description: string;
  hall_id: string;
  frame: FrameChoice;
  frame_color: string | null;
  mat: boolean;
  mat_color: string | null;
  is_active: boolean;
  sort_order: number;
};

function draftFrom(artwork: ArtworkRow): Draft {
  return {
    title: artwork.title,
    author_name: artwork.author_name ?? "",
    year: artwork.year === null ? "" : String(artwork.year),
    description: artwork.description ?? "",
    hall_id: artwork.hall_id ?? "",
    frame: artwork.frame_style ?? "inherit",
    frame_color: artwork.frame_color,
    mat: artwork.mat,
    mat_color: artwork.mat_color,
    is_active: artwork.is_active,
    sort_order: artwork.sort_order,
  };
}

export function ArtworkEditor({ artwork, imageUrl, halls, storyMuseum }: { artwork: ArtworkRow; imageUrl: string | null; halls: HallRow[]; storyMuseum: StoryMuseumInfo }) {
  const router = useRouter();
  const [saved, setSaved] = useState(() => draftFrom(artwork));
  const [draft, setDraft] = useState(saved);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loadedRatio, setLoadedRatio] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();
  const [deleting, setDeleting] = useState(false);

  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  useUnsavedGuard(dirty && !deleting);
  const patch = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((current) => ({ ...current, [key]: value }));

  const hall = halls.find((item) => item.id === draft.hall_id) ?? null;
  const hallStyle = resolveHallStyle(hall ?? {});
  const effectiveFrame = resolveFrameStyle(draft.frame === "inherit" ? null : draft.frame, hallStyle.defaultFrameStyle);
  const ratio = (artwork.aspect_ratio ? Number(artwork.aspect_ratio) : null) ?? loadedRatio ?? 4 / 3;
  const metrics = computeFrame(ratio, 300, 240, effectiveFrame, draft.mat);

  const options: Option<FrameChoice>[] = [
    { ...frameOptions([hallStyle.defaultFrameStyle], draft.frame_color, draft.mat, draft.mat_color)[0], value: "inherit", label: "Hall default" },
    ...frameOptions(FRAME_STYLES, draft.frame_color, draft.mat, draft.mat_color),
  ];

  function save() {
    startTransition(async () => {
      const result = await updateArtwork(artwork.id, {
        title: draft.title,
        author_name: draft.author_name,
        year: draft.year === "" ? null : Number(draft.year),
        description: draft.description,
        hall_id: draft.hall_id || null,
        frame_style: draft.frame === "inherit" ? null : draft.frame,
        frame_color: draft.frame_color,
        mat: draft.mat,
        mat_color: draft.mat_color,
        is_active: draft.is_active,
        sort_order: draft.sort_order,
      });
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        toast.error(result.error);
        return;
      }
      setErrors({});
      setSaved(draft);
      toast.success("Artwork saved");
      router.refresh();
    });
  }

  async function remove() {
    if (!window.confirm(`Delete "${saved.title}" and its image file? This cannot be undone.`)) return;
    setDeleting(true);
    const result = await deleteArtworks([artwork.id]);
    if (!result.ok) {
      setDeleting(false);
      toast.error(result.error);
      return;
    }
    toast.success("Artwork deleted");
    router.push("/admin/artworks");
    router.refresh();
  }

  return (
    <>
      <div className="mb-5">
        <Link href="/admin/artworks" className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-fg">
          <ArrowLeft aria-hidden className="size-4" />
          All artworks
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">{saved.title}</h1>
          {imageUrl ? (
            <StoryExportButton
              mode="admin"
              museum={storyMuseum}
              artwork={{
                title: draft.title || saved.title,
                year: draft.year === "" ? null : Number(draft.year),
                imageUrl,
                aspect: ratio,
                frameStyle: effectiveFrame,
                frameColor: draft.frame_color,
                mat: draft.mat,
                matColor: draft.mat_color,
              }}
              halls={storyHallsFromRows(halls)}
              hallId={draft.hall_id || null}
              themeVars={ADMIN_THEME.cssVars}
              className={btnSecondary}
            >
              Export as image
            </StoryExportButton>
          ) : null}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
        <div className="order-2 flex min-w-0 flex-col gap-6 lg:order-1">
          <section className={`${cardClass} flex flex-col gap-4 p-5`} aria-labelledby="details">
            <h2 id="details" className="font-display text-lg font-semibold">Details</h2>
            <Field id="art-title" label="Title" error={errors.title}>
              <input id="art-title" value={draft.title} maxLength={160} onChange={(event) => patch("title", event.target.value)} aria-describedby="art-title-note" aria-invalid={errors.title ? true : undefined} className={inputClass} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_8rem]">
              <Field id="art-author" label="Author" error={errors.author_name}>
                <input id="art-author" value={draft.author_name} maxLength={120} onChange={(event) => patch("author_name", event.target.value)} aria-describedby="art-author-note" className={inputClass} />
              </Field>
              <Field id="art-year" label="Year" error={errors.year}>
                <input id="art-year" inputMode="numeric" value={draft.year} onChange={(event) => patch("year", event.target.value.replace(/[^0-9]/g, "").slice(0, 4))} aria-describedby="art-year-note" className={inputClass} />
              </Field>
            </div>
            <Field id="art-description" label="Description" error={errors.description} hint={`${draft.description.length}/2000`}>
              <textarea id="art-description" value={draft.description} maxLength={2000} onChange={(event) => patch("description", event.target.value)} aria-describedby="art-description-note" className={textareaClass} />
            </Field>
            <Field id="art-hall" label="Hall" error={errors.hall_id}>
              <select id="art-hall" value={draft.hall_id} onChange={(event) => patch("hall_id", event.target.value)} aria-describedby="art-hall-note" className={inputClass}>
                <option value="">Unassigned (not shown to visitors)</option>
                {halls.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field id="art-order" label="Position in hall" hint="Lower numbers appear first." error={errors.sort_order}>
              <input id="art-order" type="number" min={0} value={draft.sort_order} onChange={(event) => patch("sort_order", Math.max(0, Math.trunc(Number(event.target.value) || 0)))} aria-describedby="art-order-note" className={`${inputClass} max-w-32`} />
            </Field>
            <Toggle id="art-active" label="Show in the museum" description="Turn off to hide this artwork without deleting it." checked={draft.is_active} onChange={(value) => patch("is_active", value)} />
          </section>

          <section className={`${cardClass} flex flex-col gap-5 p-5`} aria-labelledby="frame">
            <h2 id="frame" className="font-display text-lg font-semibold">Frame</h2>
            <OptionGroup
              legend="Frame style"
              name="art-frame"
              value={draft.frame}
              options={options}
              onChange={(value) => patch("frame", value)}
              hint="Hall default follows the frame chosen for the hall."
            />
            <ColorField id="frame-color" label="Frame color" value={draft.frame_color} fallback="#6b4423" clearLabel="Use style default" onChange={(value) => patch("frame_color", value)} />
            <Toggle id="art-mat" label="Mat (passe-partout)" description="A card border between the frame and the picture." checked={draft.mat} onChange={(value) => patch("mat", value)} />
            {draft.mat ? <ColorField id="mat-color" label="Mat color" value={draft.mat_color} fallback="#f4f0e6" clearLabel="Use default" onChange={(value) => patch("mat_color", value)} /> : null}
          </section>

          <div>
            <button type="button" onClick={remove} disabled={deleting} className={btnDanger}>
              {deleting ? <Spinner /> : <Trash2 aria-hidden className="size-4" />}
              Delete artwork
            </button>
          </div>
        </div>

        <aside className="order-1 min-w-0 lg:order-2" aria-label="Preview">
          <div className="lg:sticky lg:top-20">
            <h2 className="mb-2 font-display text-lg font-semibold">Preview</h2>
            <div className="flex h-[300px] items-center justify-center overflow-hidden rounded-theme border border-line" style={wallLayer(hallStyle.wallStyle, hallStyle.wallColor)}>
              {imageUrl ? (
                <ArtworkFrame
                  artwork={{
                    id: artwork.id,
                    title: draft.title,
                    description: null,
                    author: null,
                    year: null,
                    imageUrl,
                    aspect: ratio,
                    frameStyle: effectiveFrame,
                    frameColor: draft.frame_color,
                    mat: draft.mat,
                    matColor: draft.mat_color,
                  }}
                  metrics={metrics}
                  eager
                  onLoadRatio={setLoadedRatio}
                />
              ) : (
                <p className="text-sm text-muted">No image</p>
              )}
            </div>
            <p className="mt-2 text-xs text-muted">Shown on {hall ? `the wall of ${hall.name}` : "a default wall"}.</p>
          </div>
        </aside>
      </div>

      <SaveBar dirty={dirty} pending={pending} onSave={save} onDiscard={() => setDraft(saved)} saveLabel="Save artwork" />
    </>
  );
}
