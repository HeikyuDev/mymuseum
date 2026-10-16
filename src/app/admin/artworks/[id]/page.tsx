import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAdminArtworks, getAdminHalls } from "@/lib/admin/queries";
import { requireMuseum } from "@/lib/auth/session";
import { storyMuseumFromRow } from "@/lib/story/adapters";
import { uuidSchema } from "@/lib/validation/schemas";
import { artworkImageUrl } from "@/lib/viewer-model";
import { ArtworkEditor } from "./ArtworkEditor";

export const metadata: Metadata = { title: "Edit artwork" };

export default async function EditArtworkPage({ params }: PageProps<"/admin/artworks/[id]">) {
  const { id } = await params;
  const { museum } = await requireMuseum();
  if (!uuidSchema.safeParse(id).success) notFound();

  const [halls, artworks] = await Promise.all([getAdminHalls(), getAdminArtworks()]);
  const artwork = artworks.find((item) => item.id === id);
  if (!artwork) notFound();

  return <ArtworkEditor artwork={artwork} imageUrl={artworkImageUrl(artwork)} halls={halls} storyMuseum={storyMuseumFromRow(museum)} />;
}
