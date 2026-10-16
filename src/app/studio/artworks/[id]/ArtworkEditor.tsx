"use client";

import { ArrowLeft, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteArtworks, updateArtwork } from "@/app/studio/actions/artworks";
import { ColorField, OptionGroup, Toggle, frameOptions, type Option } from "@/components/studio/pickers";
import { SaveBar } from "@/components/studio/SaveBar";
import { btnDanger, btnSecondary, cardClass, Field, inputClass, Spinner, textareaClass } from "@/components/ui/panel";
import { PhotoExportButton } from "@/components/gallery/export/PhotoExportButton";
import { ArtworkFrame, computeFrame } from "@/components/viewer/ArtworkFrame";
import { wallLayer } from "@/components/viewer/scenery";
import { useUnsavedGuard } from "@/hooks/useUnsavedGuard";
import { useI18n } from "@/lib/i18n/provider";
import { FRAME_STYLES, resolveHallStyle } from "@/lib/hall-style";
import { resolveFrameStyle, type ViewerArtwork, type ViewerMuseum } from "@/lib/viewer-model";
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

export function ArtworkEditor({ artwork, imageUrl, halls, viewerMuseum }: { artwork: ArtworkRow; imageUrl: string | null; halls: HallRow[]; viewerMuseum: ViewerMuseum }) {
  const { t } = useI18n();
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

  // The export reflects the unsaved edits: same museum, this one artwork with the draft values.
  const exportMuseum = (() => {
    const apply = (item: ViewerArtwork): ViewerArtwork =>
      item.id === artwork.id
        ? { ...item, title: draft.title || item.title, frameStyle: effectiveFrame, frameColor: draft.frame_color, mat: draft.mat, matColor: draft.mat_color }
        : item;
    return {
      ...viewerMuseum,
      halls: viewerMuseum.halls.map((item) => ({ ...item, artworks: item.artworks.map(apply) })),
      otherArtworks: viewerMuseum.otherArtworks.map(apply),
    };
  })();

  const options: Option<FrameChoice>[] = [
    { ...frameOptions(t, [hallStyle.defaultFrameStyle], draft.frame_color, draft.mat, draft.mat_color)[0], value: "inherit", label: t("art.frameDefault") },
    ...frameOptions(t, FRAME_STYLES, draft.frame_color, draft.mat, draft.mat_color),
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
      toast.success(t("art.saved"));
      router.refresh();
    });
  }

  async function remove() {
    if (!window.confirm(t("art.confirmDeleteThis", { title: saved.title }))) return;
    setDeleting(true);
    const result = await deleteArtworks([artwork.id]);
    if (!result.ok) {
      setDeleting(false);
      toast.error(result.error);
      return;
    }
    toast.success(t("art.deleted"));
    router.push("/studio/artworks");
    router.refresh();
  }

  return (
    <>
      <div className="mb-5">
        <Link href="/studio/artworks" className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-fg">
          <ArrowLeft aria-hidden className="size-4" />
          {t("art.back")}
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">{saved.title}</h1>
          {imageUrl ? (
            <PhotoExportButton mode="admin" museum={exportMuseum} artworkId={artwork.id} className={btnSecondary}>
              {t("art.exportButton")}
            </PhotoExportButton>
          ) : null}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
        <div className="order-2 flex min-w-0 flex-col gap-6 lg:order-1">
          <section className={`${cardClass} flex flex-col gap-4 p-5`} aria-labelledby="details">
            <h2 id="details" className="font-display text-lg font-semibold">{t("art.details")}</h2>
            <Field id="art-title" label={t("art.fieldTitle")} error={errors.title}>
              <input id="art-title" value={draft.title} maxLength={160} onChange={(event) => patch("title", event.target.value)} aria-describedby="art-title-note" aria-invalid={errors.title ? true : undefined} className={inputClass} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_8rem]">
              <Field id="art-author" label={t("art.fieldAuthor")} error={errors.author_name}>
                <input id="art-author" value={draft.author_name} maxLength={120} onChange={(event) => patch("author_name", event.target.value)} aria-describedby="art-author-note" className={inputClass} />
              </Field>
              <Field id="art-year" label={t("art.fieldYear")} error={errors.year}>
                <input id="art-year" inputMode="numeric" value={draft.year} onChange={(event) => patch("year", event.target.value.replace(/[^0-9]/g, "").slice(0, 4))} aria-describedby="art-year-note" className={inputClass} />
              </Field>
            </div>
            <Field id="art-description" label={t("art.fieldDescription")} error={errors.description} hint={`${draft.description.length}/2000`}>
              <textarea id="art-description" value={draft.description} maxLength={2000} onChange={(event) => patch("description", event.target.value)} aria-describedby="art-description-note" className={textareaClass} />
            </Field>
            <Field id="art-hall" label={t("art.fieldCategory")} error={errors.hall_id}>
              <select id="art-hall" value={draft.hall_id} onChange={(event) => patch("hall_id", event.target.value)} aria-describedby="art-hall-note" className={inputClass}>
                <option value="">{t("art.unassignedOption")}</option>
                {halls.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field id="art-order" label={t("art.position")} hint={t("art.positionHint")} error={errors.sort_order}>
              <input id="art-order" type="number" min={0} value={draft.sort_order} onChange={(event) => patch("sort_order", Math.max(0, Math.trunc(Number(event.target.value) || 0)))} aria-describedby="art-order-note" className={`${inputClass} max-w-32`} />
            </Field>
            <Toggle id="art-active" label={t("art.show")} description={t("art.showDesc")} checked={draft.is_active} onChange={(value) => patch("is_active", value)} />
          </section>

          <section className={`${cardClass} flex flex-col gap-5 p-5`} aria-labelledby="frame">
            <h2 id="frame" className="font-display text-lg font-semibold">{t("art.frame")}</h2>
            <OptionGroup
              legend={t("art.frameStyle")}
              name="art-frame"
              value={draft.frame}
              options={options}
              onChange={(value) => patch("frame", value)}
              hint={t("art.frameHint")}
            />
            <ColorField id="frame-color" label={t("art.frameColor")} value={draft.frame_color} fallback="#6b4423" clearLabel={t("art.useStyleDefault")} onChange={(value) => patch("frame_color", value)} />
            <Toggle id="art-mat" label={t("art.mat")} description={t("art.matDesc")} checked={draft.mat} onChange={(value) => patch("mat", value)} />
            {draft.mat ? <ColorField id="mat-color" label={t("art.matColor")} value={draft.mat_color} fallback="#f4f0e6" clearLabel={t("art.useDefault")} onChange={(value) => patch("mat_color", value)} /> : null}
          </section>

          <div>
            <button type="button" onClick={remove} disabled={deleting} className={btnDanger}>
              {deleting ? <Spinner /> : <Trash2 aria-hidden className="size-4" />}
              {t("art.deleteButton")}
            </button>
          </div>
        </div>

        <aside className="order-1 min-w-0 lg:order-2" aria-label={t("art.preview")}>
          <div className="lg:sticky lg:top-20">
            <h2 className="mb-2 font-display text-lg font-semibold">{t("art.preview")}</h2>
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
                <p className="text-sm text-muted">{t("art.noImage")}</p>
              )}
            </div>
            <p className="mt-2 text-xs text-muted">{hall ? t("art.shownOn", { name: hall.name }) : t("art.shownDefault")}</p>
          </div>
        </aside>
      </div>

      <SaveBar dirty={dirty} pending={pending} onSave={save} onDiscard={() => setDraft(saved)} saveLabel={t("art.save")} />
    </>
  );
}
