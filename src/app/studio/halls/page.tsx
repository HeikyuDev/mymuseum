import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/panel";
import { requireMuseum } from "@/lib/auth/session";
import { getT } from "@/lib/i18n/server";
import { getOwnArtworks, getOwnHalls } from "@/lib/studio/queries";
import { HallsManager } from "./HallsManager";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("cat.title") };
}

export default async function HallsPage() {
  await requireMuseum();
  const t = await getT();
  const [halls, artworks] = await Promise.all([getOwnHalls(), getOwnArtworks()]);
  const counts: Record<string, number> = {};
  for (const artwork of artworks) {
    if (artwork.hall_id) counts[artwork.hall_id] = (counts[artwork.hall_id] ?? 0) + 1;
  }

  return (
    <>
      <PageHeader title={t("cat.title")} description={t("cat.desc")} />
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
