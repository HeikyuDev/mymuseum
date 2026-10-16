import type { Metadata } from "next";
import { Plus } from "lucide-react";
import Link from "next/link";
import { AccountStatusBadge, LocalDate } from "@/components/admin/badges";
import { btnPrimary, cardClass, EmptyState, PageHeader } from "@/components/ui/panel";
import { getOverview } from "@/lib/admin/queries";
import { requireRole } from "@/lib/auth/session";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("nav.overview") };
}

export default async function AdminOverviewPage() {
  await requireRole("super_admin");
  const t = await getT();
  const overview = await getOverview();

  const stats = [
    { label: t("adm.statClients"), value: overview.clients, note: t("adm.statClientsNote", { count: overview.activeClients }) },
    { label: t("adm.statMuseums"), value: overview.museums, note: t("adm.statMuseumsNote") },
    { label: t("adm.statPublished"), value: overview.published, note: t("adm.statPublishedNote", { count: overview.museums - overview.published }) },
    { label: t("adm.statArtworks"), value: overview.artworks, note: t("adm.statArtworksNote") },
  ];

  return (
    <>
      <PageHeader
        title={t("nav.overview")}
        description={t("adm.overviewDesc")}
        actions={
          <Link href="/admin/clients/new" className={btnPrimary}>
            <Plus aria-hidden className="size-4" />
            {t("adm.newClient")}
          </Link>
        }
      />

      <dl className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className={`${cardClass} p-4`}>
            <dt className="text-sm text-muted">{stat.label}</dt>
            <dd className="mt-1 font-display text-3xl font-semibold">{stat.value}</dd>
            <p className="mt-0.5 text-xs text-muted">{stat.note}</p>
          </div>
        ))}
      </dl>

      <section className={`${cardClass} p-5`} aria-labelledby="recent">
        <div className="flex items-center justify-between gap-3">
          <h2 id="recent" className="font-display text-lg font-semibold">
            {t("adm.recent")}
          </h2>
          <Link href="/admin/clients" className="text-sm font-semibold text-accent-text">
            {t("adm.viewAll")}
          </Link>
        </div>
        {overview.recentClients.length === 0 ? (
          <div className="mt-3">
            <EmptyState title={t("adm.noClientsTitle")} description={t("adm.noClientsBody")} />
          </div>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {overview.recentClients.map(({ profile, museum }) => (
              <li key={profile.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3">
                <div className="min-w-0 flex-1">
                  <Link href={`/admin/clients/${profile.id}`} className="block truncate font-medium hover:underline">
                    {profile.display_name || profile.email}
                  </Link>
                  <p className="truncate text-sm text-muted">
                    {profile.email} · {museum ? `/m/${museum.slug}` : t("adm.noMuseumYet")}
                  </p>
                </div>
                <span className="text-sm text-muted">
                  <LocalDate iso={profile.created_at} />
                </span>
                <AccountStatusBadge active={profile.is_active} />
              </li>
            ))}
          </ul>
        )}
      </section>
      <p className="mt-4 text-xs text-muted">{t("adm.storageNote")}</p>
    </>
  );
}
