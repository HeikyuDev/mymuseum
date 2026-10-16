import prisma from "@/lib/prisma";
import { SiteAdminPortal } from "@/components/admin/SiteAdminPortal";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Administración del Sitio | Mi Museo",
  description: "Portal administrativo para gestión de inquilinos, administradores de museos y accesos directos 3D.",
};

export default async function HomePage() {
  const museums = await prisma.museum.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      _count: {
        select: {
          artworks: true,
        },
      },
    },
  });

  return <SiteAdminPortal museums={museums} />;
}
