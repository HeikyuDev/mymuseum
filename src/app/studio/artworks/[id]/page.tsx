import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireMuseum } from "@/lib/auth/session";
import { getT } from "@/lib/i18n/server";
import { getOwnArtworks, getOwnHalls } from "@/lib/studio/queries";
import { uuidSchema } from "@/lib/validation/schemas";
import { artworkImageUrl, buildViewerMuseum } from "@/lib/viewer-model";
import { ArtworkEditor } from "./ArtworkEditor";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("art.editTitle") };
}

export default async function EditArtworkPage({ params }: PageProps<"/studio/artworks/[id]">) {
  const { id } = await params;
  const { museum } = await requireMuseum();
  if (!uuidSchema.safeParse(id).success) notFound();

  const [halls, artworks] = await Promise.all([getOwnHalls(), getOwnArtworks()]);
  const artwork = artworks.find((item) => item.id === id);
  if (!artwork) notFound();

  return <ArtworkEditor artwork={artwork} imageUrl={artworkImageUrl(artwork)} halls={halls} viewerMuseum={buildViewerMuseum({ museum, halls, artworks })} />;
}
