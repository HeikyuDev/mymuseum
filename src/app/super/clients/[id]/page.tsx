import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/admin/ui";
import { AccountStatusBadge, RoleBadge } from "@/components/super/badges";
import { requireRole } from "@/lib/auth/session";
import { getClientDetail } from "@/lib/super/queries";
import { uuidSchema } from "@/lib/validation/schemas";
import { ClientDetail } from "./ClientDetail";

export const metadata: Metadata = { title: "Client" };

export default async function ClientDetailPage({ params }: PageProps<"/super/clients/[id]">) {
  const { id } = await params;
  const { userId } = await requireRole("super_admin");
  if (!uuidSchema.safeParse(id).success) notFound();

  const detail = await getClientDetail(id);
  if (!detail) notFound();
  const { profile } = detail;

  return (
    <>
      <Link href="/super/clients" className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-fg">
        <ArrowLeft aria-hidden className="size-4" />
        All clients
      </Link>
      <PageHeader
        title={profile.display_name || profile.email}
        description={profile.email}
        actions={
          <>
            <RoleBadge role={profile.role} />
            <AccountStatusBadge active={profile.is_active} />
          </>
        }
      />
      <ClientDetail
        profile={{
          id: profile.id,
          email: profile.email,
          displayName: profile.display_name ?? "",
          role: profile.role,
          isActive: profile.is_active,
        }}
        museums={detail.museums.map((museum) => ({
          id: museum.id,
          title: museum.title,
          slug: museum.slug,
          isPublished: museum.is_published,
          hallCount: museum.hallCount,
          artworkCount: museum.artworkCount,
        }))}
        isSelf={profile.id === userId}
        activeSuperAdmins={detail.activeSuperAdmins}
      />
    </>
  );
}
