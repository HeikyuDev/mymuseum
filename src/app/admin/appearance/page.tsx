import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/ui";
import { getAdminArtworks, getAdminHalls } from "@/lib/admin/queries";
import { requireMuseum } from "@/lib/auth/session";
import { AppearanceEditor } from "./AppearanceEditor";

export const metadata: Metadata = { title: "Appearance" };

export default async function AppearancePage() {
  const { museum } = await requireMuseum();
  const [halls, artworks] = await Promise.all([getAdminHalls(), getAdminArtworks()]);

  return (
    <>
      <PageHeader title="Appearance" description="Colors, fonts and the overall mood of your museum." />
      <AppearanceEditor
        museum={museum}
        halls={halls}
        artworks={artworks.filter((artwork) => artwork.is_active)}
      />
    </>
  );
}
