"use client";

import { CheckCircle2, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { checkSlugAvailability, type SlugCheck } from "@/app/studio/actions/museum";
import { validateSlug } from "@/lib/validation/slug";
import { Field, Spinner } from "@/components/ui/panel";

type Props = {
  id: string;
  value: string;
  onChange: (value: string) => void;
  /** Slug the museum already owns: always considered available. */
  currentSlug?: string;
  /** Called whenever the validity changes so the parent can disable submit. */
  onValidityChange?: (valid: boolean) => void;
  serverError?: string | null;
};

export function SlugField({ id, value, onChange, currentSlug, onValidityChange, serverError }: Props) {
  const [result, setResult] = useState<{ slug: string; check: SlugCheck } | null>(null);
  const localProblem = value ? validateSlug(value) : "Choose an address for your museum.";
  const unchanged = !!currentSlug && value === currentSlug;

  useEffect(() => {
    if (localProblem || unchanged) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const check = await checkSlugAvailability(value);
        if (!cancelled) setResult({ slug: value, check });
      } catch {
        if (!cancelled) setResult({ slug: value, check: { available: true, message: "Could not verify availability." } });
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [value, localProblem, unchanged]);

  const remote = result && result.slug === value ? result.check : null;
  const checking = !localProblem && !unchanged && !remote;
  const valid = !localProblem && (unchanged || remote?.available === true);

  useEffect(() => {
    onValidityChange?.(valid);
  }, [valid, onValidityChange]);

  let status: { tone: "ok" | "error" | "pending"; message: string };
  if (serverError) status = { tone: "error", message: serverError };
  else if (localProblem) status = { tone: "error", message: localProblem };
  else if (unchanged) status = { tone: "ok", message: "This is your current address." };
  else if (checking) status = { tone: "pending", message: "Checking availability" };
  else status = { tone: remote?.available ? "ok" : "error", message: remote?.message ?? "" };

  return (
    <Field id={id} label="Public address">
      <div className="flex items-stretch overflow-hidden rounded-theme border border-line bg-raised focus-within:border-accent">
        <span className="flex items-center bg-surface px-3 text-sm text-muted select-none">/m/</span>
        <input
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value.toLowerCase().replace(/\s+/g, "-"))}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={40}
          aria-invalid={status.tone === "error" ? true : undefined}
          aria-describedby={`${id}-status`}
          className="min-h-11 min-w-0 flex-1 bg-transparent px-3 text-sm outline-none"
        />
      </div>
      <p
        id={`${id}-status`}
        role={status.tone === "error" ? "alert" : "status"}
        className={`flex items-center gap-1.5 text-sm ${
          status.tone === "ok" ? "text-emerald-700" : status.tone === "error" ? "text-red-700" : "text-muted"
        }`}
      >
        {status.tone === "ok" ? <CheckCircle2 aria-hidden className="size-4" /> : null}
        {status.tone === "error" ? <XCircle aria-hidden className="size-4" /> : null}
        {status.tone === "pending" ? <Spinner /> : null}
        {status.message}
      </p>
    </Field>
  );
}
