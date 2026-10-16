import type { Metadata } from "next";
import { ExternalLink, Search } from "lucide-react";
import Link from "next/link";
import { btnPrimary, btnSecondary, cardClass, EmptyState, inputClass, PageHeader } from "@/components/admin/ui";
import { StatusBadge } from "@/components/admin/MuseumStatusBar";
import { formatDate } from "@/components/super/badges";
import { Pagination } from "@/components/super/Pagination";
import { requireRole } from "@/lib/auth/session";
import { parseMuseumParams } from "@/lib/super/params";
import { listMuseums } from "@/lib/super/queries";
import { UnpublishButton } from "./UnpublishButton";

export const metadata: Metadata = { title: "Museums" };

export default async function MuseumsPage({ searchParams }: PageProps<"/super/museums">) {
  await requireRole("super_admin");
  const params = parseMuseumParams(await searchParams);
  const { items, total } = await listMuseums(params);
  const filtered = params.q !== "" || params.status !== "all";

  return (
    <>
      <PageHeader title="Museums" description="Every museum on the platform. Use force unpublish to take a museum offline." />

      <form method="get" role="search" className={`${cardClass} mb-4 grid gap-3 p-4 sm:grid-cols-[1fr_auto_auto] sm:items-end`}>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="q" className="text-sm font-medium">
            Search
          </label>
          <input id="q" name="q" defaultValue={params.q} placeholder="Title, address or owner" maxLength={80} className={inputClass} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="status" className="text-sm font-medium">
            Status
          </label>
          <select id="status" name="status" defaultValue={params.status} className={inputClass}>
            <option value="all">All</option>
            <option value="published">Published</option>
            <option value="draft">Draft</option>
          </select>
        </div>
        <div className="flex gap-2">
          <button type="submit" className={btnPrimary}>
            <Search aria-hidden className="size-4" />
            Apply
          </button>
          {filtered ? (
            <Link href="/super/museums" className={btnSecondary}>
              Clear
            </Link>
          ) : null}
        </div>
      </form>

      {items.length === 0 ? (
        <EmptyState
          title={filtered ? "No museums match" : "No museums yet"}
          description={filtered ? "Try a different search or clear the filters." : "Museums appear here once clients create them."}
        />
      ) : (
        <div className={`${cardClass} overflow-x-auto`}>
          <table className="w-full min-w-[44rem] text-left text-sm">
            <caption className="sr-only">Museums</caption>
            <thead className="border-b border-line text-xs uppercase tracking-wide text-muted">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">Museum</th>
                <th scope="col" className="px-4 py-3 font-medium">Owner</th>
                <th scope="col" className="px-4 py-3 font-medium">Artworks</th>
                <th scope="col" className="px-4 py-3 font-medium">Status</th>
                <th scope="col" className="px-4 py-3 font-medium">Created</th>
                <th scope="col" className="px-4 py-3 font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {items.map((museum) => (
                <tr key={museum.id} className="align-top">
                  <td className="px-4 py-3">
                    <p className="font-medium">{museum.title}</p>
                    <a href={`/m/${museum.slug}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-muted hover:text-fg">
                      /m/{museum.slug}
                      <ExternalLink aria-hidden className="size-3" />
                    </a>
                  </td>
                  <td className="px-4 py-3">
                    {museum.owner ? (
                      <Link href={`/super/clients/${museum.owner.id}`} className="hover:underline">
                        {museum.owner.display_name || museum.owner.email}
                        <span className="block text-muted">{museum.owner.email}</span>
                      </Link>
                    ) : (
                      <span className="text-muted">Unknown</span>
                    )}
                  </td>
                  <td className="px-4 py-3">{museum.artworkCount}</td>
                  <td className="px-4 py-3">
                    <StatusBadge published={museum.is_published} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-muted">{formatDate(museum.created_at)}</td>
                  <td className="px-4 py-3 text-right">
                    {museum.is_published ? <UnpublishButton id={museum.id} title={museum.title} /> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination basePath="/super/museums" page={params.page} total={total} noun="museum" query={{ q: params.q, status: params.status }} />
    </>
  );
}
