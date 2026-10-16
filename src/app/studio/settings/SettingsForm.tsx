"use client";

import { TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { updateMuseumSettings } from "@/app/studio/actions/museum";
import { SlugField } from "@/components/studio/SlugField";
import { btnPrimary, btnSecondary, cardClass, Field, inputClass, Spinner, textareaClass } from "@/components/ui/panel";
import { useUnsavedGuard } from "@/hooks/useUnsavedGuard";

type Values = { title: string; tagline: string; description: string; slug: string };

export function SettingsForm({ initial }: { initial: Values }) {
  const router = useRouter();
  const [saved, setSaved] = useState(initial);
  const [values, setValues] = useState(initial);
  const [slugValid, setSlugValid] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  const dirty = JSON.stringify(values) !== JSON.stringify(saved);
  const slugChanged = values.slug !== saved.slug;
  useUnsavedGuard(dirty);

  const set = (key: keyof Values) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setValues((current) => ({ ...current, [key]: event.target.value }));

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (slugChanged && !window.confirm(`The old address /m/${saved.slug} will stop working. Continue?`)) return;
    startTransition(async () => {
      const result = await updateMuseumSettings(values);
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        toast.error(result.error);
        return;
      }
      setErrors({});
      setSaved(values);
      toast.success("Settings saved");
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className={`${cardClass} flex max-w-2xl flex-col gap-5 p-5 sm:p-6`} noValidate>
      <Field id="title" label="Title" error={errors.title}>
        <input id="title" value={values.title} onChange={set("title")} maxLength={120} required aria-describedby="title-note" className={inputClass} />
      </Field>
      <Field id="tagline" label="Tagline" error={errors.tagline} hint="One line shown under the title.">
        <input id="tagline" value={values.tagline} onChange={set("tagline")} maxLength={200} aria-describedby="tagline-note" className={inputClass} />
      </Field>
      <Field id="description" label="Description" error={errors.description} hint={`${values.description.length}/2000`}>
        <textarea id="description" value={values.description} onChange={set("description")} maxLength={2000} aria-describedby="description-note" className={textareaClass} />
      </Field>

      <SlugField
        id="slug"
        value={values.slug}
        currentSlug={saved.slug}
        serverError={errors.slug}
        onChange={(slug) => setValues((current) => ({ ...current, slug }))}
        onValidityChange={setSlugValid}
      />
      {slugChanged ? (
        <p className="flex items-start gap-2 rounded-theme border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
          <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          Changing the address breaks existing links: /m/{saved.slug} will stop working as soon as you save.
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={pending || !dirty || !slugValid} className={btnPrimary}>
          {pending ? <Spinner /> : null}
          Save changes
        </button>
        <button type="button" disabled={!dirty || pending} onClick={() => setValues(saved)} className={btnSecondary}>
          Discard
        </button>
      </div>
    </form>
  );
}
