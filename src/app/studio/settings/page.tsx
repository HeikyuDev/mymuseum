import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/panel";
import { requireMuseum } from "@/lib/auth/session";
import { SettingsForm } from "./SettingsForm";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { museum } = await requireMuseum();
  return (
    <>
      <PageHeader title="Settings" description="Your museum's name, description and public address." />
      <SettingsForm
        initial={{
          title: museum.title,
          tagline: museum.tagline ?? "",
          description: museum.description ?? "",
          slug: museum.slug,
        }}
      />
    </>
  );
}
