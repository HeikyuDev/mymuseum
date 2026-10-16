import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/panel";
import { requireRole } from "@/lib/auth/session";
import { getT } from "@/lib/i18n/server";
import { NewClientForm } from "./NewClientForm";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("adm.newClient") };
}

export default async function NewClientPage() {
  await requireRole("super_admin");
  const t = await getT();
  return (
    <>
      <PageHeader title={t("adm.newClient")} description={t("adm.newClientDesc")} />
      <NewClientForm />
    </>
  );
}
