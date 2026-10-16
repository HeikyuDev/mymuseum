"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { updateHall } from "@/app/studio/actions/halls";
import {
  ColorField,
  OptionGroup,
  Toggle,
  decorationOptions,
  floorOptions,
  frameOptions,
  lightingOptions,
  wallOptions,
} from "@/components/studio/pickers";
import { HallPreview } from "@/components/studio/previews";
import { SaveBar } from "@/components/studio/SaveBar";
import { cardClass, Field, inputClass, textareaClass } from "@/components/ui/panel";
import {
  DECOR_IDS,
  FLOOR_DECORATIONS,
  FLOOR_STYLES,
  FRAME_STYLES,
  LIGHTING_PRESETS,
  WALL_STYLES,
  resolveHallStyle,
  type DecorId,
} from "@/lib/hall-style";
import { useUnsavedGuard } from "@/hooks/useUnsavedGuard";
import { resolveMuseumTheme } from "@/lib/theme";
import { buildViewerMuseum } from "@/lib/viewer-model";
import type {
  ArtworkRow,
  FloorDecoration,
  FloorStyle,
  FrameStyle,
  HallRow,
  Json,
  LightingPreset,
  MuseumRow,
  WallStyle,
} from "@/types/database";

type MuseumTheme = Pick<
  MuseumRow,
  "id" | "slug" | "title" | "tagline" | "description" | "cover_image_path" | "theme_preset" | "accent_color" | "font_pairing" | "theme_overrides"
>;

type Draft = {
  name: string;
  description: string;
  is_visible: boolean;
  wall_style: WallStyle;
  wall_color: string | null;
  floor_style: FloorStyle;
  floor_decoration: FloorDecoration;
  floor_decoration_color: string | null;
  lighting_preset: LightingPreset;
  default_frame_style: FrameStyle;
  accent_color: string | null;
  decor: Record<DecorId, boolean>;
};

const DECOR_LABELS: Record<DecorId, { label: string; description: string }> = {
  rope_barriers: { label: "Rope barriers", description: "Velvet ropes in front of the wall." },
  benches: { label: "Benches", description: "Seating between artworks." },
  plants: { label: "Plants", description: "Greenery along the hall." },
};

function draftFromHall(hall: HallRow): Draft {
  const style = resolveHallStyle(hall);
  return {
    name: hall.name,
    description: hall.description ?? "",
    is_visible: hall.is_visible,
    wall_style: style.wallStyle,
    wall_color: style.wallColor,
    floor_style: style.floorStyle,
    floor_decoration: style.floorDecoration,
    floor_decoration_color: style.floorDecorationColor,
    lighting_preset: style.lighting,
    default_frame_style: style.defaultFrameStyle,
    accent_color: style.accent,
    decor: Object.fromEntries(DECOR_IDS.map((id) => [id, style.decor.includes(id)])) as Record<DecorId, boolean>,
  };
}

export function HallEditor({ hall, artworks, museumTheme }: { hall: HallRow; artworks: ArtworkRow[]; museumTheme: MuseumTheme }) {
  const router = useRouter();
  const [saved, setSaved] = useState(() => draftFromHall(hall));
  const [draft, setDraft] = useState(saved);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  useUnsavedGuard(dirty);

  const patch = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((current) => ({ ...current, [key]: value }));

  // The preview is the real viewer fed by the unsaved draft.
  const theme = useMemo(() => resolveMuseumTheme(museumTheme), [museumTheme]);
  const preview = useMemo(() => {
    const draftRow: HallRow = {
      ...hall,
      ...draft,
      description: draft.description || null,
      decor: draft.decor as Json,
    };
    return buildViewerMuseum({ museum: museumTheme, halls: [draftRow], artworks }).halls[0];
  }, [draft, hall, artworks, museumTheme]);

  function save() {
    startTransition(async () => {
      const result = await updateHall(hall.id, draft);
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        toast.error(result.error);
        return;
      }
      setErrors({});
      setSaved(draft);
      toast.success("Hall saved");
      router.refresh();
    });
  }

  const framePickerArt = (
    <OptionGroup
      legend="Default frame"
      name="default-frame"
      hint="Used for every artwork in this hall that does not choose its own frame."
      value={draft.default_frame_style}
      options={frameOptions(FRAME_STYLES, null, false, null)}
      onChange={(value) => patch("default_frame_style", value)}
    />
  );

  return (
    <>
      <div className="mb-5">
        <Link href="/studio/halls" className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-fg">
          <ArrowLeft aria-hidden className="size-4" />
          All halls
        </Link>
        <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">{saved.name}</h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
        <div className="order-2 flex min-w-0 flex-col gap-6 lg:order-1">
          <section className={`${cardClass} flex flex-col gap-4 p-5`} aria-labelledby="general">
            <h2 id="general" className="font-display text-lg font-semibold">General</h2>
            <Field id="hall-name" label="Name" error={errors.name}>
              <input id="hall-name" value={draft.name} maxLength={80} onChange={(event) => patch("name", event.target.value)} aria-describedby="hall-name-note" aria-invalid={errors.name ? true : undefined} className={inputClass} />
            </Field>
            <Field id="hall-description" label="Description" error={errors.description} hint="Shown on the museum entrance.">
              <textarea id="hall-description" value={draft.description} maxLength={1000} onChange={(event) => patch("description", event.target.value)} aria-describedby="hall-description-note" className={textareaClass} />
            </Field>
            <Toggle id="hall-visible" label="Visible to visitors" description="Hidden halls are skipped in the public museum." checked={draft.is_visible} onChange={(value) => patch("is_visible", value)} />
          </section>

          <section className={`${cardClass} flex flex-col gap-5 p-5`} aria-labelledby="walls">
            <h2 id="walls" className="font-display text-lg font-semibold">Walls and floor</h2>
            <OptionGroup
              legend="Wall"
              name="wall-style"
              value={draft.wall_style}
              options={wallOptions(draft.wall_color, WALL_STYLES)}
              onChange={(value) => {
                patch("wall_style", value);
                if (value === "custom_color" && !draft.wall_color) patch("wall_color", "#e8e2d6");
              }}
            />
            {draft.wall_style === "custom_color" ? (
              <div>
                <ColorField id="wall-color" label="Wall color" value={draft.wall_color} fallback="#e8e2d6" onChange={(value) => patch("wall_color", value)} />
                {errors.wall_color ? <p role="alert" className="mt-1 text-sm text-red-700">{errors.wall_color}</p> : null}
              </div>
            ) : null}
            <OptionGroup legend="Floor" name="floor-style" value={draft.floor_style} options={floorOptions(FLOOR_STYLES)} onChange={(value) => patch("floor_style", value)} />
            <OptionGroup
              legend="Floor decoration"
              name="floor-decoration"
              value={draft.floor_decoration}
              options={decorationOptions(draft.floor_style, draft.floor_decoration_color, FLOOR_DECORATIONS)}
              onChange={(value) => patch("floor_decoration", value)}
            />
            {draft.floor_decoration !== "none" ? (
              <ColorField
                id="decoration-color"
                label="Decoration color"
                value={draft.floor_decoration_color}
                fallback="#9b1c28"
                clearLabel="Use default color"
                onChange={(value) => patch("floor_decoration_color", value)}
              />
            ) : null}
          </section>

          <section className={`${cardClass} flex flex-col gap-5 p-5`} aria-labelledby="mood">
            <h2 id="mood" className="font-display text-lg font-semibold">Lighting and frames</h2>
            <OptionGroup legend="Lighting" name="lighting" value={draft.lighting_preset} options={lightingOptions(LIGHTING_PRESETS)} onChange={(value) => patch("lighting_preset", value)} columns="grid-cols-2 sm:grid-cols-4" />
            {framePickerArt}
            <ColorField
              id="hall-accent"
              label="Hall accent color"
              value={draft.accent_color}
              fallback={museumTheme.accent_color}
              clearLabel="Use museum accent"
              onChange={(value) => patch("accent_color", value)}
            />
          </section>

          <section className={`${cardClass} flex flex-col gap-1 p-5`} aria-labelledby="decor">
            <h2 id="decor" className="mb-2 font-display text-lg font-semibold">Decor</h2>
            {DECOR_IDS.map((id) => (
              <Toggle
                key={id}
                id={`decor-${id}`}
                label={DECOR_LABELS[id].label}
                description={DECOR_LABELS[id].description}
                checked={draft.decor[id]}
                onChange={(value) => setDraft((current) => ({ ...current, decor: { ...current.decor, [id]: value } }))}
              />
            ))}
          </section>
        </div>

        <aside className="order-1 min-w-0 lg:order-2" aria-label="Live preview">
          <div className="lg:sticky lg:top-20">
            <h2 className="mb-2 font-display text-lg font-semibold">Live preview</h2>
            <HallPreview theme={theme} name={draft.name} style={preview.style} artworks={preview.artworks} />
          </div>
        </aside>
      </div>

      <SaveBar dirty={dirty} pending={pending} onSave={save} onDiscard={() => setDraft(saved)} saveLabel="Save hall" />
    </>
  );
}
