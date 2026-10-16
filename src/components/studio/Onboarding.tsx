"use client";

import { Landmark } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createMuseum } from "@/app/studio/actions/museum";
import { slugify } from "@/lib/validation/slug";
import { SlugField } from "./SlugField";
import { btnPrimary, cardClass, Field, inputClass, Spinner } from "@/components/ui/panel";

export function Onboarding() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [tagline, setTagline] = useState("");
  const [slugValid, setSlugValid] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function submit(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = await createMuseum({ title, slug, tagline });
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        toast.error(result.error);
        return;
      }
      toast.success("Your museum is ready");
      router.refresh();
    });
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-4 py-12">
      <div className="mb-6 flex items-center gap-3">
        <span className="flex size-11 items-center justify-center rounded-theme bg-accent text-on-accent">
          <Landmark aria-hidden className="size-6" />
        </span>
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Create your museum</h1>
          <p className="text-sm text-muted">Three details to start. You can change everything later.</p>
        </div>
      </div>

      <form onSubmit={submit} className={`${cardClass} flex flex-col gap-5 p-5 sm:p-6`} noValidate>
        <Field id="title" label="Museum title" error={errors.title}>
          <input
            id="title"
            value={title}
            maxLength={120}
            required
            autoFocus
            aria-invalid={errors.title ? true : undefined}
            aria-describedby="title-note"
            onChange={(event) => {
              setTitle(event.target.value);
              if (!slugEdited) setSlug(slugify(event.target.value));
            }}
            className={inputClass}
          />
        </Field>

        <SlugField
          id="slug"
          value={slug}
          serverError={errors.slug}
          onChange={(value) => {
            setSlug(value);
            setSlugEdited(true);
            setErrors((current) => ({ ...current, slug: "" }));
          }}
          onValidityChange={setSlugValid}
        />

        <Field id="tagline" label="Tagline (optional)" error={errors.tagline} hint="One line shown under the title.">
          <input
            id="tagline"
            value={tagline}
            maxLength={200}
            aria-describedby="tagline-note"
            onChange={(event) => setTagline(event.target.value)}
            className={inputClass}
          />
        </Field>

        <button type="submit" disabled={pending || !title.trim() || !slugValid} className={btnPrimary}>
          {pending ? <Spinner /> : null}
          Create museum
        </button>
      </form>
    </div>
  );
}
