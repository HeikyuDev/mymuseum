import { notFound } from "next/navigation";
import { Metadata } from "next";

export const dynamic = "force-dynamic";
import prisma from "@/lib/prisma";
import { MuseumViewer } from "@/components/3d/MuseumViewer";
import { MuseumWithRelations, MuseumSettingsData, ArtworkData } from "@/types/museum";

interface PageProps {
  params: Promise<{
    slug: string;
  }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const museum = await prisma.museum.findUnique({
    where: { slug },
    select: { title: true, description: true },
  });

  if (!museum) {
    return {
      title: "Museo no encontrado - Mi Museo",
    };
  }

  return {
    title: `${museum.title} | Museo 3D Interactivo`,
    description: museum.description || "Recorre esta galería virtual 3D interactiva en tu navegador.",
  };
}

export default async function MuseumPage({ params }: PageProps) {
  const { slug } = await params;

  const rawMuseum = await prisma.museum.findUnique({
    where: { slug },
    include: {
      settings: true,
      artworks: {
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  if (!rawMuseum || !rawMuseum.isPublished) {
    notFound();
  }

  // Mapeo seguro a tipos tipados
  const museum: MuseumWithRelations = {
    ...rawMuseum,
    settings: rawMuseum.settings as unknown as MuseumSettingsData | null,
    artworks: rawMuseum.artworks as unknown as ArtworkData[],
  };

  return <MuseumViewer museum={museum} />;
}
