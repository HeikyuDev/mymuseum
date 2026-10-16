import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/panel";
import { getOwnArtworks, getOwnHalls } from "@/lib/studio/queries";
import { requireMuseum } from "@/lib/auth/session";
import { HallsManager } from "./HallsManager";

export const metadata: Metadata = { title: "Halls" };

export default async function HallsPage() {
  await requireMuseum();
  const [halls, artworks] = await Promise.all([getOwnHalls(), getOwnArtworks()]);
  const counts: Record<string, number> = {};
  for (const artwork of artworks) {
    if (artwork.hall_id) counts[artwork.hall_id] = (counts[artwork.hall_id] ?? 0) + 1;
  }

  return (
    <>
      <PageHeader title="Halls" description="Rooms of your museum. Visitors walk through them in this order." />
      <HallsManager
        halls={halls.map((hall) => ({
          id: hall.id,
          name: hall.name,
          description: hall.description,
          isVisible: hall.is_visible,
          artworkCount: counts[hall.id] ?? 0,
        }))}
      />
    </>
  );
}
