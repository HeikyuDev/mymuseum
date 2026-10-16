import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getOwnArtworks, getOwnHalls } from "@/lib/studio/queries";
import { requireMuseum } from "@/lib/auth/session";
import { uuidSchema } from "@/lib/validation/schemas";
import { HallEditor } from "./HallEditor";

export const metadata: Metadata = { title: "Edit hall" };

export default async function EditHallPage({ params }: PageProps<"/studio/halls/[id]">) {
  const { id } = await params;
  const { museum } = await requireMuseum();
  if (!uuidSchema.safeParse(id).success) notFound();

  const [halls, artworks] = await Promise.all([getOwnHalls(), getOwnArtworks()]);
  const hall = halls.find((item) => item.id === id);
  if (!hall) notFound();

  return (
    <HallEditor
      hall={hall}
      artworks={artworks.filter((artwork) => artwork.hall_id === hall.id && artwork.is_active)}
      museumTheme={{
        id: museum.id,
        slug: museum.slug,
        title: museum.title,
        tagline: museum.tagline,
        description: museum.description,
        cover_image_path: museum.cover_image_path,
        theme_preset: museum.theme_preset,
        accent_color: museum.accent_color,
        font_pairing: museum.font_pairing,
        theme_overrides: museum.theme_overrides,
      }}
    />
  );
}
