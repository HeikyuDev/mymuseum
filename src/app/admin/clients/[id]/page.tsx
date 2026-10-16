import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AccountStatusBadge, RoleBadge } from "@/components/admin/badges";
import { PageHeader } from "@/components/ui/panel";
import { getClientDetail } from "@/lib/admin/queries";
import { requireRole } from "@/lib/auth/session";
import { getT } from "@/lib/i18n/server";
import { uuidSchema } from "@/lib/validation/schemas";
import { ClientDetail } from "./ClientDetail";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("adm.colClient") };
}

export default async function ClientDetailPage({ params }: PageProps<"/admin/clients/[id]">) {
  const { id } = await params;
  const { userId } = await requireRole("super_admin");
  if (!uuidSchema.safeParse(id).success) notFound();

  const t = await getT();
  const detail = await getClientDetail(id);
  if (!detail) notFound();
  const { profile, museum } = detail;

  return (
    <>
      <Link href="/admin/clients" className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-fg">
        <ArrowLeft aria-hidden className="size-4" />
        {t("adm.allClients")}
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
        museum={
          museum
            ? {
                id: museum.id,
                title: museum.title,
                slug: museum.slug,
                isPublished: museum.is_published,
                hallCount: museum.hallCount,
                artworkCount: museum.artworkCount,
              }
            : null
        }
        isSelf={profile.id === userId}
        activeSuperAdmins={detail.activeSuperAdmins}
      />
    </>
  );
}
