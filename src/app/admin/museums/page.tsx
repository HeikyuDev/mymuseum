import type { Metadata } from "next";
import { ExternalLink, Search } from "lucide-react";
import Link from "next/link";
import { LocalDate } from "@/components/admin/badges";
import { Pagination } from "@/components/admin/Pagination";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { btnPrimary, btnSecondary, cardClass, EmptyState, inputClass, PageHeader } from "@/components/ui/panel";
import { parseMuseumParams } from "@/lib/admin/params";
import { listMuseums } from "@/lib/admin/queries";
import { requireRole } from "@/lib/auth/session";
import { getT } from "@/lib/i18n/server";
import { UnpublishButton } from "./UnpublishButton";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("nav.museums") };
}

// Read-only overview of every museum (each client owns exactly one). The only
// action is taking a museum offline.
export default async function MuseumsPage({ searchParams }: PageProps<"/admin/museums">) {
  await requireRole("super_admin");
  const t = await getT();
  const params = parseMuseumParams(await searchParams);
  const { items, total } = await listMuseums(params);
  const filtered = params.q !== "" || params.status !== "all";

  return (
    <>
      <PageHeader title={t("nav.museums")} description={t("adm.museumsDesc")} />

      <form method="get" role="search" className={`${cardClass} mb-4 grid gap-3 p-4 sm:grid-cols-[1fr_auto_auto] sm:items-end`}>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="q" className="text-sm font-medium">
            {t("adm.search")}
          </label>
          <input id="q" name="q" defaultValue={params.q} placeholder={t("adm.museumsSearchPlaceholder")} maxLength={80} className={inputClass} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="status" className="text-sm font-medium">
            {t("adm.status")}
          </label>
          <select id="status" name="status" defaultValue={params.status} className={inputClass}>
            <option value="all">{t("adm.all")}</option>
            <option value="published">{t("status.published")}</option>
            <option value="draft">{t("status.draft")}</option>
          </select>
        </div>
        <div className="flex gap-2">
          <button type="submit" className={btnPrimary}>
            <Search aria-hidden className="size-4" />
            {t("adm.apply")}
          </button>
          {filtered ? (
            <Link href="/admin/museums" className={btnSecondary}>
              {t("adm.clear")}
            </Link>
          ) : null}
        </div>
      </form>

      {items.length === 0 ? (
        <EmptyState
          title={filtered ? t("adm.noMuseumsMatch") : t("adm.noMuseumsTitle")}
          description={filtered ? t("adm.tryOtherSearch") : t("adm.noMuseumsBody")}
        />
      ) : (
        <div className={`${cardClass} overflow-x-auto`}>
          <table className="w-full min-w-[44rem] text-left text-sm">
            <caption className="sr-only">{t("nav.museums")}</caption>
            <thead className="border-b border-line text-xs uppercase tracking-wide text-muted">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">{t("adm.colMuseum")}</th>
                <th scope="col" className="px-4 py-3 font-medium">{t("adm.colOwner")}</th>
                <th scope="col" className="px-4 py-3 font-medium">{t("adm.colArtworks")}</th>
                <th scope="col" className="px-4 py-3 font-medium">{t("adm.colStatus")}</th>
                <th scope="col" className="px-4 py-3 font-medium">{t("adm.colCreated")}</th>
                <th scope="col" className="px-4 py-3 font-medium">
                  <span className="sr-only">{t("adm.colActions")}</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {items.map((museum) => (
                <tr key={museum.id} className="align-top">
                  <td className="px-4 py-3">
                    <p className="font-medium">{museum.title}</p>
                    <a href={`/m/${museum.slug}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-muted hover:text-fg" aria-label={`${t("adm.openMuseum")}: /m/${museum.slug}`}>
                      /m/{museum.slug}
                      <ExternalLink aria-hidden className="size-3" />
                    </a>
                  </td>
                  <td className="px-4 py-3">
                    {museum.owner ? (
                      <Link href={`/admin/clients/${museum.owner.id}`} className="hover:underline">
                        {museum.owner.display_name || museum.owner.email}
                        <span className="block text-muted">{museum.owner.email}</span>
                      </Link>
                    ) : (
                      <span className="text-muted">{t("common.unknown")}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">{museum.artworkCount}</td>
                  <td className="px-4 py-3">
                    <StatusBadge published={museum.is_published} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-muted">
                    <LocalDate iso={museum.created_at} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    {museum.is_published ? <UnpublishButton id={museum.id} title={museum.title} /> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination basePath="/admin/museums" page={params.page} total={total} noun="museums" query={{ q: params.q, status: params.status }} />
    </>
  );
}
