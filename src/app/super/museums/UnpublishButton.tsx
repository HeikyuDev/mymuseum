"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { forceUnpublishMuseum } from "@/app/super/actions";
import { btnDanger, Spinner } from "@/components/admin/ui";

export function UnpublishButton({ id, title }: { id: string; title: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function unpublish() {
    if (!window.confirm(`Force unpublish "${title}"? Visitors will no longer be able to open it.`)) return;
    startTransition(async () => {
      const result = await forceUnpublishMuseum(id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Museum unpublished");
      router.refresh();
    });
  }

  return (
    <button type="button" onClick={unpublish} disabled={pending} className={`${btnDanger} !min-h-9`} aria-label={`Force unpublish ${title}`}>
      {pending ? <Spinner /> : null}
      Unpublish
    </button>
  );
}
