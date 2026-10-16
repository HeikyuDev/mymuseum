"use client";

import { formatDate } from "@/lib/i18n/format";
import { useI18n } from "@/lib/i18n/provider";
import type { UserRole } from "@/types/database";

const base = "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold";

export function AccountStatusBadge({ active }: { active: boolean }) {
  const { t } = useI18n();
  return (
    <span className={`${base} ${active ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-red-300 bg-red-50 text-red-800"}`}>
      <span aria-hidden className={`size-1.5 rounded-full ${active ? "bg-emerald-600" : "bg-red-600"}`} />
      {active ? t("adm.badgeActive") : t("adm.badgeDisabled")}
    </span>
  );
}

export function RoleBadge({ role }: { role: UserRole }) {
  const { t } = useI18n();
  return (
    <span className={`${base} border-line bg-surface text-fg`}>
      {role === "super_admin" ? t("adm.badgeAdmin") : t("adm.badgeClient")}
    </span>
  );
}

/** Date in the interface language. */
export function LocalDate({ iso }: { iso: string }) {
  const { locale } = useI18n();
  return <>{formatDate(iso, locale)}</>;
}
