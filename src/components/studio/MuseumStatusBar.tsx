"use client";

import { Check, Copy, ExternalLink } from "lucide-react";
import { btnPrimary, btnSecondary, Spinner } from "@/components/ui/panel";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useI18n } from "@/lib/i18n/provider";
import { useCopyLink, usePublicUrl, usePublishToggle } from "./museum-link";

export function MuseumStatusBar({ slug, published }: { slug: string; published: boolean }) {
  const { t } = useI18n();
  const { path, url } = usePublicUrl(slug);
  const { copied, copy } = useCopyLink(url);
  const publish = usePublishToggle(published);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <StatusBadge published={publish.published} />
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
        <button type="button" onClick={copy} className={`${btnSecondary} !min-h-9 !px-2.5`} aria-label={t("status.copyAria")}>
          {copied ? <Check aria-hidden className="size-4" /> : <Copy aria-hidden className="size-4" />}
          <span className="hidden lg:inline">{copied ? t("status.copied") : t("status.copyLink")}</span>
        </button>
      </div>
      <button
        type="button"
        onClick={publish.toggle}
        disabled={publish.pending}
        aria-pressed={publish.published}
        className={`${publish.published ? btnSecondary : btnPrimary} !min-h-9`}
      >
        {publish.pending ? <Spinner /> : null}
        {publish.published ? t("status.unpublish") : t("status.publish")}
      </button>
    </div>
  );
}
