import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/panel";
import { getOwnArtworks, getOwnHalls } from "@/lib/studio/queries";
import { requireMuseum } from "@/lib/auth/session";
import { artworkImageUrl, buildViewerMuseum } from "@/lib/viewer-model";
import { ArtworksManager } from "./ArtworksManager";

export const metadata: Metadata = { title: "Artworks" };

export default async function ArtworksPage() {
  const { museum } = await requireMuseum();
  const [halls, artworks] = await Promise.all([getOwnHalls(), getOwnArtworks()]);

  return (
    <>
      <PageHeader title="Artworks" description="Upload images, then place them in halls and choose their frames." />
      <ArtworksManager
        museumId={museum.id}
        halls={halls.map((hall) => ({ id: hall.id, name: hall.name }))}
        viewerMuseum={buildViewerMuseum({ museum, halls, artworks })}
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
