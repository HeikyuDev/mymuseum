"use client";

import { btnPrimary } from "@/components/ui/panel";
import { useI18n } from "@/lib/i18n/provider";

/** Body of the error boundary of both panels (it renders inside their layouts, so i18n is available). */
export function ErrorPanel({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useI18n();
  return (
    <div role="alert" className="mx-auto flex max-w-md flex-col items-center gap-4 py-20 text-center">
      <h1 className="font-display text-2xl font-semibold">{t("page.errorTitle")}</h1>
      <p className="text-sm text-muted">{t("page.errorBody")}</p>
      {error.digest ? <p className="text-xs text-muted">{t("page.errorReference", { digest: error.digest })}</p> : null}
      <button type="button" onClick={reset} className={btnPrimary}>
        {t("common.tryAgain")}
      </button>
    </div>
  );
}
