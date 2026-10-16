import { getTenantContext } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { MuseumWithRelations, MuseumSettingsData, ArtworkData } from "@/types/museum";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Panel de Curaduría | Mi Museo",
  description: "Personaliza tu museo tridimensional y gestiona tus obras.",
};

export default async function AdminPage() {
  const { user, museum: tenantMuseum } = await getTenantContext();

  const rawMuseum = await prisma.museum.findUnique({
    where: { id: tenantMuseum.id },
    include: {
      settings: true,
      artworks: {
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  if (!rawMuseum) {
    throw new Error("No se pudo cargar la galería del usuario.");
  }

  const museum: MuseumWithRelations = {
    ...rawMuseum,
    settings: rawMuseum.settings as unknown as MuseumSettingsData | null,
    artworks: rawMuseum.artworks as unknown as ArtworkData[],
  };

  return <AdminDashboard initialMuseum={museum} />;
}
