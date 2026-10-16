"use client";

import { TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { updateDefaultLocale, updateMuseumSettings } from "@/app/studio/actions/museum";
import { SlugField } from "@/components/studio/SlugField";
import { btnPrimary, btnSecondary, cardClass, Field, inputClass, Spinner, textareaClass } from "@/components/ui/panel";
import { useUnsavedGuard } from "@/hooks/useUnsavedGuard";
import { LOCALES, type Locale } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n/provider";

type Values = { title: string; tagline: string; description: string; slug: string; defaultLocale: Locale };

export function SettingsForm({ initial }: { initial: Values }) {
  const { t } = useI18n();
  const router = useRouter();
  const [saved, setSaved] = useState(initial);
  const [values, setValues] = useState(initial);
  const [slugValid, setSlugValid] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  const dirty = JSON.stringify(values) !== JSON.stringify(saved);
  const slugChanged = values.slug !== saved.slug;
  useUnsavedGuard(dirty);

  const set = (key: Exclude<keyof Values, "defaultLocale">) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setValues((current) => ({ ...current, [key]: event.target.value }));

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (slugChanged && !window.confirm(t("set.slugConfirm", { slug: saved.slug }))) return;
    startTransition(async () => {
      const { defaultLocale, ...museumFields } = values;
      const result = await updateMuseumSettings(museumFields);
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        toast.error(result.error);
        return;
      }
      if (defaultLocale !== saved.defaultLocale) {
        const localeResult = await updateDefaultLocale({ defaultLocale });
        if (!localeResult.ok) {
          setErrors(localeResult.fieldErrors ?? {});
          toast.error(localeResult.error);
          return;
        }
      }
      setErrors({});
      setSaved(values);
      toast.success(t("set.saved"));
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className={`${cardClass} flex max-w-2xl flex-col gap-5 p-5 sm:p-6`} noValidate>
      <Field id="title" label={t("set.name")} error={errors.title}>
        <input id="title" value={values.title} onChange={set("title")} maxLength={120} required aria-describedby="title-note" className={inputClass} />
      </Field>
      <Field id="tagline" label={t("set.tagline")} error={errors.tagline} hint={t("set.taglineHint")}>
        <input id="tagline" value={values.tagline} onChange={set("tagline")} maxLength={200} aria-describedby="tagline-note" className={inputClass} />
      </Field>
      <Field id="description" label={t("set.description")} error={errors.description} hint={`${values.description.length}/2000`}>
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
          {t("set.slugWarn", { slug: saved.slug })}
        </p>
      ) : null}

      <Field id="default-locale" label={t("set.defaultLanguage")} error={errors.defaultLocale} hint={t("set.defaultLanguageHint")}>
        <select
          id="default-locale"
          value={values.defaultLocale}
          onChange={(event) => setValues((current) => ({ ...current, defaultLocale: event.target.value as Locale }))}
          aria-describedby="default-locale-note"
          className={inputClass}
        >
          {LOCALES.map((code) => (
            <option key={code} value={code} lang={code}>
              {t(code === "es" ? "lang.es" : "lang.en")}
            </option>
          ))}
        </select>
      </Field>

      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={pending || !dirty || !slugValid} className={btnPrimary}>
          {pending ? <Spinner /> : null}
          {t("set.save")}
        </button>
        <button type="button" disabled={!dirty || pending} onClick={() => setValues(saved)} className={btnSecondary}>
          {t("common.discard")}
        </button>
      </div>
    </form>
  );
}
