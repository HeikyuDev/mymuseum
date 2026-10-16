"use client";

import { Check, Copy, KeyRound } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { copyToClipboard } from "@/components/admin/clipboard";
import { btnPrimary, btnSecondary, cardClass } from "@/components/ui/panel";
import { useI18n } from "@/lib/i18n/provider";

type Props = {
  email: string;
  password: string;
  title: string;
  onDismiss: () => void;
};

/**
 * Shows credentials ONCE. The password only lives in this component's props
 * (client memory); it is never written to storage, URLs or logs.
 */
export function CredentialsPanel({ email, password, title, onDismiss }: Props) {
  const { t } = useI18n();
  const origin = useSyncExternalStore(
    () => () => {},
    () => window.location.origin,
    () => "",
  );
  const [copied, setCopied] = useState<string | null>(null);

  const handover = [
    t("adm.handoverLogin", { url: `${origin}/login` }),
    t("adm.handoverEmail", { email }),
    t("adm.handoverPassword", { password }),
    t("adm.handoverNext"),
  ].join("\n");

  async function copy(key: string, text: string) {
    if (await copyToClipboard(text)) {
      setCopied(key);
      setTimeout(() => setCopied(null), 1800);
    } else {
      toast.error(t("adm.clipboardFailed"));
    }
  }

  const row = (key: string, label: string, value: string, mono = false) => (
    <div className="flex items-center justify-between gap-3 py-2">
      <div className="min-w-0">
        <dt className="text-xs uppercase tracking-wide text-muted">{label}</dt>
        <dd className={`break-all text-sm font-medium ${mono ? "font-mono" : ""}`}>{value}</dd>
      </div>
      <button type="button" className={`${btnSecondary} !min-h-9 !px-2.5`} onClick={() => copy(key, value)} aria-label={t("adm.copyField", { label })}>
        {copied === key ? <Check aria-hidden className="size-4" /> : <Copy aria-hidden className="size-4" />}
      </button>
    </div>
  );

  return (
    <section role="status" className={`${cardClass} border-emerald-300 p-5`} aria-labelledby="credentials-title">
      <h2 id="credentials-title" className="flex items-center gap-2 font-display text-lg font-semibold">
        <KeyRound aria-hidden className="size-5" />
        {title}
      </h2>
      <p className="mt-1 text-sm text-amber-900">{t("adm.credentialsNote")}</p>
      <dl className="mt-3 divide-y divide-line">
        {row("email", t("adm.fieldEmail"), email)}
        {row("password", t("adm.fieldTempPassword"), password, true)}
      </dl>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className={btnSecondary} onClick={() => copy("all", handover)}>
          {copied === "all" ? <Check aria-hidden className="size-4" /> : <Copy aria-hidden className="size-4" />}
          {t("adm.copyAll")}
        </button>
        <button type="button" className={btnPrimary} onClick={onDismiss}>
          {t("adm.savedCredentials")}
        </button>
      </div>
    </section>
  );
}
