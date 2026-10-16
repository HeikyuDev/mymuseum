import type { Metadata } from "next";
import { Plus, Search } from "lucide-react";
import Link from "next/link";
import { btnPrimary, btnSecondary, cardClass, EmptyState, inputClass, PageHeader } from "@/components/admin/ui";
import { AccountStatusBadge, formatDate, RoleBadge } from "@/components/super/badges";
import { Pagination } from "@/components/super/Pagination";
import { requireRole } from "@/lib/auth/session";
import { parseClientParams } from "@/lib/super/params";
import { listClients } from "@/lib/super/queries";

export const metadata: Metadata = { title: "Clients" };

export default async function ClientsPage({ searchParams }: PageProps<"/super/clients">) {
  await requireRole("super_admin");
  const params = parseClientParams(await searchParams);
  const { items, total } = await listClients(params);
  const filtered = params.q !== "" || params.status !== "all" || params.role !== "all";

  return (
    <>
      <PageHeader
        title="Clients"
        description="Every account on the platform, with their museum."
        actions={
          <Link href="/super/clients/new" className={btnPrimary}>
            <Plus aria-hidden className="size-4" />
            New client
          </Link>
        }
      />

      <form method="get" role="search" className={`${cardClass} mb-4 grid gap-3 p-4 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end`}>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="q" className="text-sm font-medium">
            Search
          </label>
          <input id="q" name="q" defaultValue={params.q} placeholder="Email, name or museum address" maxLength={80} className={inputClass} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="status" className="text-sm font-medium">
            Status
          </label>
          <select id="status" name="status" defaultValue={params.status} className={inputClass}>
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="disabled">Disabled</option>
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="role" className="text-sm font-medium">
            Role
          </label>
          <select id="role" name="role" defaultValue={params.role} className={inputClass}>
            <option value="all">All</option>
            <option value="owner">Client</option>
            <option value="super_admin">Super admin</option>
          </select>
        </div>
        <div className="flex gap-2">
          <button type="submit" className={btnPrimary}>
            <Search aria-hidden className="size-4" />
            Apply
          </button>
          {filtered ? (
            <Link href="/super/clients" className={btnSecondary}>
              Clear
            </Link>
          ) : null}
        </div>
      </form>

      {items.length === 0 ? (
        <EmptyState
          title={filtered ? "No clients match" : "No clients yet"}
          description={filtered ? "Try a different search or clear the filters." : "Create the first client account to get started."}
        />
      ) : (
        <div className={`${cardClass} overflow-x-auto`}>
          <table className="w-full min-w-[40rem] text-left text-sm">
            <caption className="sr-only">Clients</caption>
            <thead className="border-b border-line text-xs uppercase tracking-wide text-muted">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">Client</th>
                <th scope="col" className="px-4 py-3 font-medium">Museum</th>
                <th scope="col" className="px-4 py-3 font-medium">Artworks</th>
                <th scope="col" className="px-4 py-3 font-medium">Status</th>
                <th scope="col" className="px-4 py-3 font-medium">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {items.map(({ profile, museums }) => {
                const artworks = museums.reduce((sum, museum) => sum + museum.artworkCount, 0);
                return (
                  <tr key={profile.id} className="align-top">
                    <td className="px-4 py-3">
                      <Link href={`/super/clients/${profile.id}`} className="font-medium hover:underline">
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
                      {museums.length === 0 ? (
                        <span className="text-muted">None</span>
                      ) : (
                        museums.map((museum) => (
                          <p key={museum.id}>
                            {museum.title} <span className="text-muted">/m/{museum.slug}</span>
                            {museum.is_published ? "" : <span className="text-muted"> (draft)</span>}
                          </p>
                        ))
                      )}
                    </td>
                    <td className="px-4 py-3">{artworks}</td>
                    <td className="px-4 py-3">
                      <AccountStatusBadge active={profile.is_active} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted">{formatDate(profile.created_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Pagination basePath="/super/clients" page={params.page} total={total} noun="account" query={{ q: params.q, status: params.status, role: params.role }} />
    </>
  );
}
