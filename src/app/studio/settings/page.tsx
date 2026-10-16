import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/panel";
import { requireMuseum } from "@/lib/auth/session";
import { getT } from "@/lib/i18n/server";
import { resolveOverrides } from "@/lib/theme";
import { SettingsForm } from "./SettingsForm";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("set.title") };
}

export default async function SettingsPage() {
  const { museum } = await requireMuseum();
  const t = await getT();
  return (
    <>
      <PageHeader title={t("set.title")} description={t("set.desc")} />
      <SettingsForm
        initial={{
          title: museum.title,
          tagline: museum.tagline ?? "",
          description: museum.description ?? "",
          slug: museum.slug,
          defaultLocale: resolveOverrides(museum.theme_overrides).defaultLocale,
        }}
      />
    </>
  );
}
