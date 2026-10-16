import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/panel";
import { requireMuseum } from "@/lib/auth/session";
import { getT } from "@/lib/i18n/server";
import { getOwnArtworks, getOwnHalls } from "@/lib/studio/queries";
import { AppearanceEditor } from "./AppearanceEditor";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("ap.title") };
}

export default async function AppearancePage() {
  const { museum } = await requireMuseum();
  const t = await getT();
  const [halls, artworks] = await Promise.all([getOwnHalls(), getOwnArtworks()]);

  return (
    <>
      <PageHeader title={t("ap.title")} description={t("ap.desc")} />
      <AppearanceEditor
        museum={museum}
        halls={halls}
        artworks={artworks.filter((artwork) => artwork.is_active)}
      />
    </>
  );
}
