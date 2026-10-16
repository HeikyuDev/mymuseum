"use client";

import { Check, Copy, KeyRound } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { btnPrimary, btnSecondary, cardClass } from "@/components/ui/panel";
import { copyToClipboard } from "@/components/admin/clipboard";

type Props = {
  email: string;
  password: string;
  /** Public museum path (e.g. /m/my-museum) to include in the handover text, if any. */
  museumPath?: string | null;
  title?: string;
  onDismiss: () => void;
};

/**
 * Shows credentials ONCE. The password only lives in this component's props
 * (client memory); it is never written to storage, URLs or logs.
 */
export function CredentialsPanel({ email, password, museumPath, title = "Credentials", onDismiss }: Props) {
  const origin = useSyncExternalStore(
    () => () => {},
    () => window.location.origin,
    () => "",
  );
  const [copied, setCopied] = useState<string | null>(null);

  const loginUrl = `${origin}/login`;
  const handover = [
    `Sign in: ${loginUrl}`,
    `Email: ${email}`,
    `Temporary password: ${password}`,
    museumPath ? `Your museum: ${origin}${museumPath}` : null,
    "Please change the password after your first sign-in.",
  ]
    .filter(Boolean)
    .join("\n");

  async function copy(key: string, text: string) {
    if (await copyToClipboard(text)) {
      setCopied(key);
      setTimeout(() => setCopied(null), 1800);
    } else {
      toast.error("Could not copy to the clipboard");
    }
  }

  const row = (key: string, label: string, value: string, mono = false) => (
    <div className="flex items-center justify-between gap-3 py-2">
      <div className="min-w-0">
        <dt className="text-xs uppercase tracking-wide text-muted">{label}</dt>
        <dd className={`break-all text-sm font-medium ${mono ? "font-mono" : ""}`}>{value}</dd>
      </div>
      <button type="button" className={`${btnSecondary} !min-h-9 !px-2.5`} onClick={() => copy(key, value)} aria-label={`Copy ${label.toLowerCase()}`}>
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
      <p className="mt-1 text-sm text-amber-900">
        This password is shown only once and is not stored anywhere. Copy it now and send it to the client over a secure channel.
      </p>
      <dl className="mt-3 divide-y divide-line">
        {row("email", "Email", email)}
        {row("password", "Temporary password", password, true)}
        {museumPath ? row("museum", "Museum path", museumPath) : null}
      </dl>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className={btnSecondary} onClick={() => copy("all", handover)}>
          {copied === "all" ? <Check aria-hidden className="size-4" /> : <Copy aria-hidden className="size-4" />}
          Copy all
        </button>
        <button type="button" className={btnPrimary} onClick={onDismiss}>
          I have saved these credentials
        </button>
      </div>
    </section>
  );
}
