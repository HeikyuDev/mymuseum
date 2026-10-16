import { Plus } from "lucide-react";
import Link from "next/link";
import { btnPrimary, cardClass, EmptyState, PageHeader } from "@/components/ui/panel";
import { AccountStatusBadge, formatDate } from "@/components/admin/badges";
import { requireRole } from "@/lib/auth/session";
import { getOverview } from "@/lib/admin/queries";

export default async function AdminOverviewPage() {
  await requireRole("super_admin");
  const overview = await getOverview();

  const stats = [
    { label: "Clients", value: overview.clients, note: `${overview.activeClients} active` },
    { label: "Museums", value: overview.museums, note: "All statuses" },
    { label: "Published", value: overview.published, note: `${overview.museums - overview.published} draft` },
    { label: "Artworks", value: overview.artworks, note: "Across all museums" },
  ];

  return (
    <>
      <PageHeader
        title="Overview"
        description="Platform-wide numbers and the most recent clients."
        actions={
          <Link href="/admin/clients/new" className={btnPrimary}>
            <Plus aria-hidden className="size-4" />
            New client
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
            Recent clients
          </h2>
          <Link href="/admin/clients" className="text-sm font-semibold text-accent-text">
            View all
          </Link>
        </div>
        {overview.recentClients.length === 0 ? (
          <div className="mt-3">
            <EmptyState title="No clients yet" description="Create the first client account to onboard a museum." />
          </div>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {overview.recentClients.map(({ profile, museums }) => (
              <li key={profile.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3">
                <div className="min-w-0 flex-1">
                  <Link href={`/admin/clients/${profile.id}`} className="block truncate font-medium hover:underline">
                    {profile.display_name || profile.email}
                  </Link>
                  <p className="truncate text-sm text-muted">
                    {profile.email} · {museums[0] ? `/m/${museums[0].slug}` : "No museum yet"}
                  </p>
                </div>
                <span className="text-sm text-muted">{formatDate(profile.created_at)}</span>
                <AccountStatusBadge active={profile.is_active} />
              </li>
            ))}
          </ul>
        )}
      </section>
      <p className="mt-4 text-xs text-muted">
        Storage usage is not tracked: uploaded files are not measured per museum, so only row counts are shown.
      </p>
    </>
  );
}
