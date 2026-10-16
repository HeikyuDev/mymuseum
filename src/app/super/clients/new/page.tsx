import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/ui";
import { requireRole } from "@/lib/auth/session";
import { NewClientForm } from "./NewClientForm";

export const metadata: Metadata = { title: "New client" };

export default async function NewClientPage() {
  await requireRole("super_admin");
  return (
    <>
      <PageHeader
        title="New client"
        description="Create an account with a temporary password. You will see the credentials once, to hand them to the client."
      />
      <NewClientForm />
    </>
  );
}
