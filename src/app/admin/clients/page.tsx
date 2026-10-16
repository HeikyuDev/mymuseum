import type { Metadata } from "next";
import { Plus, Search } from "lucide-react";
import Link from "next/link";
import { AccountStatusBadge, LocalDate, RoleBadge } from "@/components/admin/badges";
import { Pagination } from "@/components/admin/Pagination";
import { btnPrimary, btnSecondary, cardClass, EmptyState, inputClass, PageHeader } from "@/components/ui/panel";
import { parseClientParams } from "@/lib/admin/params";
import { listClients } from "@/lib/admin/queries";
import { requireRole } from "@/lib/auth/session";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("nav.clients") };
}

export default async function ClientsPage({ searchParams }: PageProps<"/admin/clients">) {
  await requireRole("super_admin");
  const t = await getT();
  const params = parseClientParams(await searchParams);
  const { items, total } = await listClients(params);
  const filtered = params.q !== "" || params.status !== "all" || params.role !== "all";

  return (
    <>
      <PageHeader
        title={t("nav.clients")}
        description={t("adm.clientsDesc")}
        actions={
          <Link href="/admin/clients/new" className={btnPrimary}>
            <Plus aria-hidden className="size-4" />
            {t("adm.newClient")}
          </Link>
        }
      />

      <form method="get" role="search" className={`${cardClass} mb-4 grid gap-3 p-4 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end`}>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="q" className="text-sm font-medium">
            {t("adm.search")}
          </label>
          <input id="q" name="q" defaultValue={params.q} placeholder={t("adm.clientsSearchPlaceholder")} maxLength={80} className={inputClass} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="status" className="text-sm font-medium">
            {t("adm.status")}
          </label>
          <select id="status" name="status" defaultValue={params.status} className={inputClass}>
            <option value="all">{t("adm.all")}</option>
            <option value="active">{t("adm.active")}</option>
            <option value="disabled">{t("adm.disabled")}</option>
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="role" className="text-sm font-medium">
            {t("adm.role")}
          </label>
          <select id="role" name="role" defaultValue={params.role} className={inputClass}>
            <option value="all">{t("adm.all")}</option>
            <option value="owner">{t("adm.roleClient")}</option>
            <option value="super_admin">{t("adm.roleAdmin")}</option>
          </select>
        </div>
        <div className="flex gap-2">
          <button type="submit" className={btnPrimary}>
            <Search aria-hidden className="size-4" />
            {t("adm.apply")}
          </button>
          {filtered ? (
            <Link href="/admin/clients" className={btnSecondary}>
              {t("adm.clear")}
            </Link>
          ) : null}
        </div>
      </form>

      {items.length === 0 ? (
        <EmptyState
          title={filtered ? t("adm.noClientsMatch") : t("adm.noClientsTitle")}
          description={filtered ? t("adm.tryOtherSearch") : t("adm.noClientsBody")}
        />
      ) : (
        <div className={`${cardClass} overflow-x-auto`}>
          <table className="w-full min-w-[40rem] text-left text-sm">
            <caption className="sr-only">{t("nav.clients")}</caption>
            <thead className="border-b border-line text-xs uppercase tracking-wide text-muted">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">{t("adm.colClient")}</th>
                <th scope="col" className="px-4 py-3 font-medium">{t("adm.colMuseum")}</th>
                <th scope="col" className="px-4 py-3 font-medium">{t("adm.colArtworks")}</th>
                <th scope="col" className="px-4 py-3 font-medium">{t("adm.colStatus")}</th>
                <th scope="col" className="px-4 py-3 font-medium">{t("adm.colCreated")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {items.map(({ profile, museum }) => (
                <tr key={profile.id} className="align-top">
                  <td className="px-4 py-3">
                    <Link href={`/admin/clients/${profile.id}`} className="font-medium hover:underline">
                      {profile.display_name || profile.email}
                    </Link>
                    <p className="text-muted">{profile.email}</p>
                    {profile.role === "super_admin" ? (
                      <div className="mt-1">
                        <RoleBadge role={profile.role} />
                      </div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    {museum ? (
                      <p>
                        {museum.title} <span className="text-muted">/m/{museum.slug}</span>
                        {museum.is_published ? "" : <span className="text-muted"> {t("adm.draftSuffix")}</span>}
                      </p>
                    ) : (
                      <span className="text-muted">{t("adm.none")}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">{museum?.artworkCount ?? 0}</td>
                  <td className="px-4 py-3">
                    <AccountStatusBadge active={profile.is_active} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-muted">
                    <LocalDate iso={profile.created_at} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination basePath="/admin/clients" page={params.page} total={total} noun="clients" query={{ q: params.q, status: params.status, role: params.role }} />
    </>
  );
}
