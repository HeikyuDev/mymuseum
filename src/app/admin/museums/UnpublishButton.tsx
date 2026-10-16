"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { forceUnpublishMuseum } from "@/app/admin/actions";
import { btnDanger, Spinner } from "@/components/ui/panel";
import { useI18n } from "@/lib/i18n/provider";

export function UnpublishButton({ id, title }: { id: string; title: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function unpublish() {
    if (!window.confirm(t("adm.unpublishConfirm", { title }))) return;
    startTransition(async () => {
      const result = await forceUnpublishMuseum(id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(t("adm.museumUnpublished"));
      router.refresh();
    });
  }

  return (
    <button type="button" onClick={unpublish} disabled={pending} className={`${btnDanger} !min-h-9`} aria-label={t("adm.unpublishAria", { title })}>
      {pending ? <Spinner /> : null}
      {t("status.unpublish")}
    </button>
  );
}
