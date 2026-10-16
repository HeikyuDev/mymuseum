"use client";

import { Skeleton } from "@/components/ui/panel";
import { useI18n } from "@/lib/i18n/provider";

/** Skeleton shown while a panel page streams in. `stats` is the number of summary tiles. */
export function PanelLoading({ stats }: { stats: 3 | 4 }) {
  const { t } = useI18n();
  return (
    <div role="status" aria-label={t("common.loading")} className="flex flex-col gap-4">
      <Skeleton className="h-9 w-56" />
      <Skeleton className="h-4 w-80 max-w-full" />
      <div className={`mt-4 grid gap-3 ${stats === 4 ? "grid-cols-2 lg:grid-cols-4" : "grid-cols-3"}`}>
        {Array.from({ length: stats }, (_, index) => (
          <Skeleton key={index} className="h-24" />
        ))}
      </div>
      <Skeleton className="h-64" />
    </div>
  );
}
