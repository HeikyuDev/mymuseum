import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/ui";
import { getAdminArtworks, getAdminHalls } from "@/lib/admin/queries";
import { requireMuseum } from "@/lib/auth/session";
import { storyArtworkFromRow, storyHallsFromRows, storyMuseumFromRow } from "@/lib/story/adapters";
import { artworkImageUrl } from "@/lib/viewer-model";
import { ArtworksManager } from "./ArtworksManager";

export const metadata: Metadata = { title: "Artworks" };

export default async function ArtworksPage() {
  const { museum } = await requireMuseum();
  const [halls, artworks] = await Promise.all([getAdminHalls(), getAdminArtworks()]);

  return (
    <>
      <PageHeader title="Artworks" description="Upload images, then place them in halls and choose their frames." />
      <ArtworksManager
        museumId={museum.id}
        halls={halls.map((hall) => ({ id: hall.id, name: hall.name }))}
        story={{
          museum: storyMuseumFromRow(museum),
          halls: storyHallsFromRows(halls),
          artworks: Object.fromEntries(
            artworks.flatMap((artwork) => {
              const imageUrl = artworkImageUrl(artwork);
              return imageUrl ? [[artwork.id, storyArtworkFromRow(artwork, imageUrl, halls)]] : [];
            }),
          ),
        }}
        artworks={artworks.map((artwork) => ({
          id: artwork.id,
          title: artwork.title,
          hallId: artwork.hall_id,
          imageUrl: artworkImageUrl(artwork),
          isActive: artwork.is_active,
        }))}
      />
    </>
  );
}
