"use client";

import { Check, Copy, ExternalLink } from "lucide-react";
import { btnPrimary, btnSecondary, cardClass, Spinner } from "@/components/ui/panel";
import { useI18n } from "@/lib/i18n/provider";
import { useCopyLink, usePublicUrl, usePublishToggle } from "./museum-link";

/**
 * Prominent "View my museum" and "Copy link" actions for the overview. A draft
 * cannot be opened by anyone, so the buttons wait until the museum is published
 * and a Publish button is offered instead.
 */
export function ShareCard({ slug, published }: { slug: string; published: boolean }) {
  const { t } = useI18n();
  const { path, url } = usePublicUrl(slug);
  const { copied, copy } = useCopyLink(url);
  const publish = usePublishToggle(published);

  return (
    <section className={`${cardClass} mb-6 flex flex-col gap-4 p-5`} aria-labelledby="share-title">
      <div>
        <h2 id="share-title" className="font-display text-lg font-semibold">
          {t("ov.shareTitle")}
        </h2>
        <p className="mt-1 text-sm text-muted">{publish.published ? t("ov.shareLive") : t("ov.shareDraft")}</p>
        <p className="mt-2 truncate font-mono text-sm text-muted" dir="ltr">
          {url || path}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {publish.published ? (
          <a href={path} target="_blank" rel="noreferrer" className={btnPrimary}>
            <ExternalLink aria-hidden className="size-4" />
            {t("ov.view")}
          </a>
        ) : (
          <button type="button" onClick={publish.toggle} disabled={publish.pending} className={btnPrimary}>
            {publish.pending ? <Spinner /> : null}
            {t("ov.publishNow")}
          </button>
        )}
        <button type="button" onClick={copy} disabled={!publish.published} className={btnSecondary}>
          {copied ? <Check aria-hidden className="size-4" /> : <Copy aria-hidden className="size-4" />}
          {copied ? t("status.copied") : t("ov.copy")}
        </button>
      </div>
    </section>
  );
}
