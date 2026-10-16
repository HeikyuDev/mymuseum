"use client";

import { Check, Copy, ExternalLink } from "lucide-react";
import { useState, useSyncExternalStore, useTransition } from "react";
import { toast } from "sonner";
import { setMuseumPublished } from "@/app/studio/actions/museum";
import { btnPrimary, btnSecondary, Spinner } from "@/components/ui/panel";

export function StatusBadge({ published }: { published: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${
        published ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-amber-300 bg-amber-50 text-amber-900"
      }`}
    >
      <span aria-hidden className={`size-1.5 rounded-full ${published ? "bg-emerald-600" : "bg-amber-600"}`} />
      {published ? "Published" : "Draft"}
    </span>
  );
}

export function MuseumStatusBar({ slug, published }: { slug: string; published: boolean }) {
  const origin = useSyncExternalStore(
    () => () => {},
    () => window.location.origin,
    () => "",
  );
  const [copied, setCopied] = useState(false);
  const [state, setState] = useState(published);
  const [syncedFrom, setSyncedFrom] = useState(published);
  const [pending, startTransition] = useTransition();

  // Adopt the server value after a refresh.
  if (published !== syncedFrom) {
    setSyncedFrom(published);
    setState(published);
  }

  const path = `/m/${slug}`;
  const url = `${origin}${path}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link copied");
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Could not copy the link");
    }
  }

  function toggle() {
    const next = !state;
    setState(next);
    startTransition(async () => {
      const result = await setMuseumPublished(next);
      if (!result.ok) {
        setState(!next);
        toast.error(result.error);
      } else {
        toast.success(next ? "Museum published" : "Museum unpublished");
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <StatusBadge published={state} />
      <div className="flex items-center gap-1">
        <a
          href={path}
          target="_blank"
          rel="noreferrer"
          className="hidden max-w-[16rem] items-center gap-1.5 truncate text-sm text-muted hover:text-fg sm:inline-flex"
        >
          <span className="truncate">{url || path}</span>
          <ExternalLink aria-hidden className="size-3.5 shrink-0" />
        </a>
        <button type="button" onClick={copy} className={`${btnSecondary} !min-h-9 !px-2.5`} aria-label="Copy public link">
          {copied ? <Check aria-hidden className="size-4" /> : <Copy aria-hidden className="size-4" />}
          <span className="hidden lg:inline">{copied ? "Copied" : "Copy link"}</span>
        </button>
      </div>
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        aria-pressed={state}
        className={`${state ? btnSecondary : btnPrimary} !min-h-9`}
      >
        {pending ? <Spinner /> : null}
        {state ? "Unpublish" : "Publish"}
      </button>
    </div>
  );
}
