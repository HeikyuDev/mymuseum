"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { btnSecondary } from "@/components/ui/panel";
import { buildQuery, pageCount } from "@/lib/admin/params";
import { useI18n } from "@/lib/i18n/provider";

type Props = {
  basePath: string;
  page: number;
  total: number;
  /** Current filters, preserved in the links. */
  query: Record<string, string | number | undefined>;
  noun: "clients" | "museums";
};

export function Pagination({ basePath, page, total, query, noun }: Props) {
  const { t } = useI18n();
  const pages = pageCount(total);
  const href = (target: number) => `${basePath}${buildQuery({ ...query, page: target })}`;
  const disabled = "pointer-events-none opacity-50";

  let count: string;
  if (noun === "clients") count = total === 1 ? t("adm.countClientsOne", { count: total }) : t("adm.countClientsOther", { count: total });
  else count = total === 1 ? t("adm.countMuseumsOne", { count: total }) : t("adm.countMuseumsOther", { count: total });

  return (
    <nav aria-label={t("adm.paginationAria")} className="mt-4 flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-muted">
        {count} · {t("adm.pageOf", { page: Math.min(page, pages), pages })}
      </p>
      <div className="flex gap-2">
        <Link
          href={href(page - 1)}
          aria-disabled={page <= 1}
          tabIndex={page <= 1 ? -1 : undefined}
          className={`${btnSecondary} !min-h-9 ${page <= 1 ? disabled : ""}`}
        >
          <ChevronLeft aria-hidden className="size-4" />
          {t("adm.previous")}
        </Link>
        <Link
          href={href(page + 1)}
          aria-disabled={page >= pages}
          tabIndex={page >= pages ? -1 : undefined}
          className={`${btnSecondary} !min-h-9 ${page >= pages ? disabled : ""}`}
        >
          {t("adm.next")}
          <ChevronRight aria-hidden className="size-4" />
        </Link>
      </div>
    </nav>
  );
}
