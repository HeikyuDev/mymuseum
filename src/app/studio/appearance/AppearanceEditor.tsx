/* eslint-disable @next/next/no-img-element */
"use client";

import { ImagePlus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { updateAppearance } from "@/app/studio/actions/museum";
import { ColorField, OptionGroup, Toggle, fontOptions, themePresetOptions } from "@/components/studio/pickers";
import { MuseumPreview } from "@/components/studio/previews";
import { SaveBar } from "@/components/studio/SaveBar";
import { btnSecondary, cardClass, Field, inputClass, Spinner } from "@/components/ui/panel";
import { useUnsavedGuard } from "@/hooks/useUnsavedGuard";
import { translateCode, type MessageKey } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n/provider";
import { ACCEPTED_IMAGE_TYPES } from "@/lib/images";
import { prepareImage } from "@/lib/images-client";
import { removeFromArtworks, uploadToArtworks } from "@/lib/storage-upload";
import { getArtworkPublicUrl } from "@/lib/supabase/storage";
import { FONT_PAIRING_STACKS, THEME_OVERRIDE_OPTIONS, THEME_PRESETS, resolveOverrides, type ThemeOverrides } from "@/lib/theme";
import { buildViewerMuseum } from "@/lib/viewer-model";
import type { ArtworkRow, FontPairing, HallRow, MuseumRow, ThemePreset } from "@/types/database";

type Draft = {
  theme_preset: ThemePreset;
  accent_color: string;
  font_pairing: FontPairing;
  theme_overrides: ThemeOverrides;
  default_hall_id: string;
  cover_image_path: string | null;
};

type ChoiceKey = keyof typeof THEME_OVERRIDE_OPTIONS;

const OVERRIDE_KEYS = {
  radius: { legend: "ap.corners", hint: "ap.cornersHint", sharp: "ap.sharp", soft: "ap.soft", round: "ap.round" },
  density: { legend: "ap.spacing", hint: "ap.spacingHint", compact: "ap.compact", comfortable: "ap.comfortable", spacious: "ap.spacious" },
  motion: { legend: "ap.motion", hint: "ap.motionHint", calm: "ap.calm", normal: "ap.normal", lively: "ap.lively" },
} as const satisfies Record<ChoiceKey, Record<string, MessageKey>>;

function draftFrom(museum: MuseumRow): Draft {
  return {
    theme_preset: museum.theme_preset,
    accent_color: museum.accent_color,
    font_pairing: museum.font_pairing,
    theme_overrides: resolveOverrides(museum.theme_overrides),
    default_hall_id: museum.default_hall_id ?? "",
    cover_image_path: museum.cover_image_path,
  };
}

export function AppearanceEditor({ museum, halls, artworks }: { museum: MuseumRow; halls: HallRow[]; artworks: ArtworkRow[] }) {
  const { t } = useI18n();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [saved, setSaved] = useState(() => draftFrom(museum));
  const [draft, setDraft] = useState(saved);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  // Cover files uploaded in this session and not yet saved; removed on replace/discard.
  const [sessionCovers, setSessionCovers] = useState<string[]>([]);

  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  useUnsavedGuard(dirty);
  const patch = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((current) => ({ ...current, [key]: value }));

  // The preview is the real museum experience fed by the unsaved draft.
  const preview = useMemo(
    () =>
      buildViewerMuseum({
        museum: { ...museum, ...draft, theme_overrides: draft.theme_overrides },
        halls: halls.filter((hall) => hall.is_visible),
        artworks,
      }),
    [museum, draft, halls, artworks],
  );

  async function onCoverPicked(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      const prepared = await prepareImage(file);
      const path = `${museum.id}/cover-${crypto.randomUUID()}.${prepared.extension}`;
      await uploadToArtworks(path, prepared.blob, prepared.contentType, () => {});
      const replaced = sessionCovers.filter((p) => p !== draft.cover_image_path);
      if (draft.cover_image_path && sessionCovers.includes(draft.cover_image_path)) await removeFromArtworks([draft.cover_image_path]);
      setSessionCovers([...replaced, path]);
      patch("cover_image_path", path);
    } catch (error) {
      toast.error(error instanceof Error ? translateCode(t, error.message) : t("ap.coverFailed"));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function discard() {
    await removeFromArtworks(sessionCovers.filter((path) => path !== saved.cover_image_path));
    setSessionCovers([]);
    setDraft(saved);
  }

  function save() {
    startTransition(async () => {
      // The default language is edited in Settings and stays as stored.
      const { radius, density, motion, allowVisitorExport } = draft.theme_overrides;
      const overrides = { radius, density, motion, allowVisitorExport };
      const result = await updateAppearance({ ...draft, theme_overrides: overrides, default_hall_id: draft.default_hall_id || null });
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        toast.error(result.error);
        return;
      }
      setErrors({});
      setSaved(draft);
      setSessionCovers([]);
      toast.success(t("ap.saved"));
      router.refresh();
    });
  }

  const presets = Object.keys(THEME_PRESETS) as ThemePreset[];
  const fonts = Object.keys(FONT_PAIRING_STACKS) as FontPairing[];

  const overrideGroup = <K extends ChoiceKey>(key: K) => (
    <OptionGroup
      legend={t(OVERRIDE_KEYS[key].legend)}
      hint={t(OVERRIDE_KEYS[key].hint)}
      name={`override-${key}`}
      value={draft.theme_overrides[key] as string}
      onChange={(value) => patch("theme_overrides", { ...draft.theme_overrides, [key]: value })}
      columns="grid-cols-3"
      options={THEME_OVERRIDE_OPTIONS[key].map((value) => ({
        value: value as string,
        label: t((OVERRIDE_KEYS[key] as Record<string, MessageKey>)[value as string]),
        preview: (
          <span className="flex h-full items-center justify-center bg-surface">
            <OverrideSample kind={key} value={value as string} />
          </span>
        ),
      }))}
    />
  );

  return (
    <>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,30rem)]">
        <div className="order-2 flex min-w-0 flex-col gap-6 xl:order-1">
          <section className={`${cardClass} flex flex-col gap-5 p-5`} aria-labelledby="look">
            <h2 id="look" className="font-display text-lg font-semibold">{t("ap.look")}</h2>
            <OptionGroup legend={t("ap.theme")} hint={t("ap.themeHint")} name="theme-preset" value={draft.theme_preset} options={themePresetOptions(t, presets, draft.accent_color)} onChange={(value) => patch("theme_preset", value)} columns="grid-cols-2 sm:grid-cols-3" />
            <p className="-mb-3 text-sm text-muted">{t("ap.accentHint")}</p>
            <ColorField id="accent" label={t("ap.accent")} value={draft.accent_color} fallback="#c9a227" onChange={(value) => patch("accent_color", value ?? "#c9a227")} />
            {errors.accent_color ? <p role="alert" className="text-sm text-red-700">{errors.accent_color}</p> : null}
            <OptionGroup legend={t("ap.fonts")} hint={t("ap.fontsHint")} name="font-pairing" value={draft.font_pairing} options={fontOptions(t, fonts)} onChange={(value) => patch("font_pairing", value)} columns="grid-cols-2 sm:grid-cols-4" />
          </section>

          <section className={`${cardClass} flex flex-col gap-5 p-5`} aria-labelledby="fine-tune">
            <h2 id="fine-tune" className="font-display text-lg font-semibold">{t("ap.fine")}</h2>
            {overrideGroup("radius")}
            {overrideGroup("density")}
            {overrideGroup("motion")}
          </section>

          <section className={`${cardClass} flex flex-col gap-4 p-5`} aria-labelledby="sharing">
            <h2 id="sharing" className="font-display text-lg font-semibold">{t("ap.sharing")}</h2>
            <Toggle
              id="allow-visitor-export"
              label={t("ap.visitorExport")}
              description={t("ap.visitorExportDesc")}
              checked={draft.theme_overrides.allowVisitorExport}
              onChange={(value) => patch("theme_overrides", { ...draft.theme_overrides, allowVisitorExport: value })}
            />
          </section>

          <section className={`${cardClass} flex flex-col gap-4 p-5`} aria-labelledby="entrance">
            <h2 id="entrance" className="font-display text-lg font-semibold">{t("ap.entrance")}</h2>
            <div>
              <p className="mb-1.5 text-sm font-medium">{t("ap.cover")}</p>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex h-24 w-40 items-center justify-center overflow-hidden rounded-theme border border-line bg-surface">
                  {draft.cover_image_path ? (
                    <img src={getArtworkPublicUrl(draft.cover_image_path)} alt={t("ap.coverAlt")} className="size-full object-cover" />
                  ) : (
                    <span className="px-2 text-center text-xs text-muted">{t("ap.coverAuto")}</span>
                  )}
                </div>
                <input ref={fileRef} id="cover-input" type="file" accept={ACCEPTED_IMAGE_TYPES.join(",")} className="peer sr-only" disabled={uploading} onChange={(event) => void onCoverPicked(event.target.files?.[0])} />
                <label htmlFor="cover-input" className={`${btnSecondary} cursor-pointer peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent`}>
                  {uploading ? <Spinner /> : <ImagePlus aria-hidden className="size-4" />}
                  {draft.cover_image_path ? t("ap.replace") : t("ap.upload")}
                </label>
                {draft.cover_image_path ? (
                  <button type="button" className={btnSecondary} onClick={() => patch("cover_image_path", null)}>
                    <Trash2 aria-hidden className="size-4" />
                    {t("ap.remove")}
                  </button>
                ) : null}
              </div>
              {errors.cover_image_path ? <p role="alert" className="mt-1 text-sm text-red-700">{errors.cover_image_path}</p> : null}
            </div>
            <Field id="default-hall" label={t("ap.startCategory")} hint={t("ap.startCategoryHint")} error={errors.default_hall_id}>
              <select id="default-hall" value={draft.default_hall_id} onChange={(event) => patch("default_hall_id", event.target.value)} aria-describedby="default-hall-note" className={inputClass}>
                <option value="">{t("ap.firstCategory")}</option>
                {halls.map((hall) => (
                  <option key={hall.id} value={hall.id}>
                    {hall.name}
                  </option>
                ))}
              </select>
            </Field>
          </section>
        </div>

        <aside className="order-1 min-w-0 xl:order-2" aria-label={t("ap.preview")}>
          <div className="xl:sticky xl:top-20">
            <h2 className="mb-2 font-display text-lg font-semibold">{t("ap.preview")}</h2>
            <MuseumPreview museum={preview} />
            <p className="mt-2 text-xs text-muted">{t("ap.previewNote")}</p>
          </div>
        </aside>
      </div>

      <SaveBar dirty={dirty} pending={pending} onSave={save} onDiscard={() => void discard()} saveLabel={t("ap.save")} />
    </>
  );
}

/** Tiny visual for the override pickers. */
function OverrideSample({ kind, value }: { kind: ChoiceKey; value: string }) {
  if (kind === "radius") {
    const radius = value === "sharp" ? 2 : value === "soft" ? 8 : 18;
    return <span className="block h-8 w-12 border-2 border-fg/60 bg-raised" style={{ borderRadius: radius }} />;
  }
  if (kind === "density") {
    const gap = value === "compact" ? 2 : value === "comfortable" ? 5 : 9;
    return (
      <span className="flex flex-col" style={{ gap }}>
        {[0, 1, 2].map((i) => (
          <span key={i} className="block h-1.5 w-10 rounded-full bg-fg/60" />
        ))}
      </span>
    );
  }
  const bars = value === "calm" ? 1 : value === "normal" ? 2 : 3;
  return (
    <span className="flex items-end gap-1" aria-hidden>
      {Array.from({ length: bars }, (_, i) => (
        <span key={i} className="block w-2 rounded-full bg-fg/60" style={{ height: 8 + i * 8 }} />
      ))}
    </span>
  );
}
