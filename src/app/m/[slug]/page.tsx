import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MuseumGallery } from "@/components/gallery/MuseumGallery";
import { createTranslator } from "@/lib/i18n";
import { I18nProvider } from "@/lib/i18n/provider";
import { getLocale } from "@/lib/i18n/server";
import { getPublishedMuseum } from "@/lib/museum-data";

export async function generateMetadata({ params }: PageProps<"/m/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const museum = await getPublishedMuseum(slug);
  const t = createTranslator(await getLocale(museum?.theme.overrides.defaultLocale));
  if (!museum) return { title: t("viewer.notFound") };

  const description = museum.tagline ?? museum.description ?? t("viewer.defaultDescription", { name: museum.title });
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

  // Visitors without a language cookie get the museum's own default.
  const locale = await getLocale(museum.theme.overrides.defaultLocale);

  return (
    <div className="h-dvh overflow-hidden bg-canvas text-fg" style={museum.theme.cssVars}>
      <I18nProvider initialLocale={locale}>
        <MuseumGallery museum={museum} />
      </I18nProvider>
    </div>
  );
}
