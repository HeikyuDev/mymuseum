"use client";

import { useState, useSyncExternalStore, useTransition } from "react";
import { toast } from "sonner";
import { setMuseumPublished } from "@/app/studio/actions/museum";
import { useI18n } from "@/lib/i18n/provider";

// Client hooks shared by the header status bar and the overview share card:
// the public link of the museum, copying it and publishing/unpublishing.

export function usePublicUrl(slug: string) {
  const origin = useSyncExternalStore(
    () => () => {},
    () => window.location.origin,
    () => "",
  );
  const path = `/m/${slug}`;
  return { path, url: `${origin}${path}` };
}

export function useCopyLink(url: string) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success(t("status.linkCopied"));
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error(t("status.copyFailed"));
    }
  }
  return { copied, copy };
}

/** Optimistic published flag that adopts the server value after a refresh. */
export function usePublishToggle(published: boolean) {
  const { t } = useI18n();
  const [state, setState] = useState(published);
  const [syncedFrom, setSyncedFrom] = useState(published);
  const [pending, startTransition] = useTransition();

  if (published !== syncedFrom) {
    setSyncedFrom(published);
    setState(published);
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
        toast.success(next ? t("status.museumPublished") : t("status.museumUnpublished"));
      }
    });
  }
  return { published: state, pending, toggle };
}
