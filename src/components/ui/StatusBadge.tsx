"use client";

import { useI18n } from "@/lib/i18n/provider";

/** Published / draft pill shared by the studio header and the platform museum list. */
export function StatusBadge({ published }: { published: boolean }) {
  const { t } = useI18n();
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${
        published ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-amber-300 bg-amber-50 text-amber-900"
      }`}
    >
      <span aria-hidden className={`size-1.5 rounded-full ${published ? "bg-emerald-600" : "bg-amber-600"}`} />
      {published ? t("status.published") : t("status.draft")}
    </span>
  );
}
