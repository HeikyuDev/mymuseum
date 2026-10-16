import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MuseumExperience } from "@/components/viewer/MuseumExperience";
import { getPublishedMuseum } from "@/lib/museum-data";

export async function generateMetadata({ params }: PageProps<"/m/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const museum = await getPublishedMuseum(slug);
  if (!museum) return { title: "Museum not found" };

  const description = museum.tagline ?? museum.description ?? `Visit ${museum.title}, a virtual museum.`;
  return {
    title: museum.title,
    description,
    openGraph: {
      title: museum.title,
      description,
      type: "website",
      images: museum.coverUrl ? [{ url: museum.coverUrl }] : undefined,
    },
  };
}

export default async function MuseumPage({ params }: PageProps<"/m/[slug]">) {
  const { slug } = await params;
  const museum = await getPublishedMuseum(slug);
  if (!museum) notFound();

  return (
    <div className="min-h-dvh bg-canvas text-fg" style={museum.theme.cssVars}>
      <MuseumExperience museum={museum} />
    </div>
  );
}
