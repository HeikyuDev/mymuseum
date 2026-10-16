import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/panel";
import { requireMuseum } from "@/lib/auth/session";
import { getT } from "@/lib/i18n/server";
import { getOwnArtworks, getOwnHalls } from "@/lib/studio/queries";
import { artworkImageUrl, buildViewerMuseum } from "@/lib/viewer-model";
import { ArtworksManager } from "./ArtworksManager";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("art.title") };
}

export default async function ArtworksPage() {
  const { museum } = await requireMuseum();
  const t = await getT();
  const [halls, artworks] = await Promise.all([getOwnHalls(), getOwnArtworks()]);

  return (
    <>
      <PageHeader title={t("art.title")} description={t("art.desc")} />
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
