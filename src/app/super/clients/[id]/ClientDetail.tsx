"use client";

import { ExternalLink, KeyRound, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  changeClientEmail,
  deleteClient,
  resetClientPassword,
  setClientActive,
  updateClientProfile,
} from "@/app/super/actions";
import { btnDanger, btnPrimary, btnSecondary, cardClass, Field, inputClass, Spinner } from "@/components/admin/ui";
import { CredentialsPanel } from "@/components/super/CredentialsPanel";
import { accountGuardError, isDeleteConfirmed } from "@/lib/super/guards";
import type { UserRole } from "@/types/database";

type Profile = { id: string; email: string; displayName: string; role: UserRole; isActive: boolean };
type Museum = { id: string; title: string; slug: string; isPublished: boolean; hallCount: number; artworkCount: number };

type Props = { profile: Profile; museums: Museum[]; isSelf: boolean; activeSuperAdmins: number };

const sectionTitle = "font-display text-lg font-semibold";

export function ClientDetail({ profile, museums, isSelf, activeSuperAdmins }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // Profile
  const [name, setName] = useState(profile.displayName);
  const [nameError, setNameError] = useState<string | null>(null);

  // Email
  const [email, setEmail] = useState(profile.email);
  const [emailError, setEmailError] = useState<string | null>(null);

  // Credentials shown once after a password reset
  const [credentials, setCredentials] = useState<{ email: string; password: string } | null>(null);

  // Delete
  const [confirmation, setConfirmation] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const target = { id: profile.id, role: profile.role, is_active: profile.isActive };
  // Mirrors the server guard rails to explain disabled buttons; the server re-checks.
  const disableBlock = accountGuardError({ action: "disable", actorId: isSelf ? profile.id : "", target, activeSuperAdmins });
  const deleteBlock = accountGuardError({ action: "delete", actorId: isSelf ? profile.id : "", target, activeSuperAdmins });
  const deleteReady = isDeleteConfirmed(confirmation, profile.email);

  function saveName(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = await updateClientProfile(profile.id, { displayName: name });
      if (!result.ok) {
        setNameError(result.fieldErrors?.displayName ?? null);
        toast.error(result.error);
        return;
      }
      setNameError(null);
      toast.success("Name updated");
      router.refresh();
    });
  }

  function saveEmail(event: React.FormEvent) {
    event.preventDefault();
    if (!window.confirm(`Change the sign-in email to ${email.trim()}? The client must use the new address from now on.`)) return;
    startTransition(async () => {
      const result = await changeClientEmail(profile.id, { email });
      if (!result.ok) {
        setEmailError(result.fieldErrors?.email ?? null);
        toast.error(result.error);
        return;
      }
      setEmailError(null);
      setEmail(result.data.email);
      toast.success("Email updated");
      router.refresh();
    });
  }

  function toggleActive() {
    const next = !profile.isActive;
    const message = next
      ? `Enable ${profile.email}? They will be able to sign in again.`
      : `Disable ${profile.email}? They will be signed out and unable to sign in.`;
    if (!window.confirm(message)) return;
    startTransition(async () => {
      const result = await setClientActive(profile.id, next);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      if (result.data.warning) toast.warning(result.data.warning);
      else toast.success(next ? "Account enabled" : "Account disabled");
      router.refresh();
    });
  }

  function resetPassword() {
    if (!window.confirm(`Generate a new temporary password for ${profile.email}? The current password stops working immediately.`)) return;
    startTransition(async () => {
      const result = await resetClientPassword(profile.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setCredentials(result.data);
      toast.success("Password reset");
    });
  }

  function remove(event: React.FormEvent) {
    event.preventDefault();
    if (!deleteReady) return;
    startTransition(async () => {
      const result = await deleteClient(profile.id, confirmation);
      if (!result.ok) {
        setDeleteError(result.fieldErrors?.confirmation ?? null);
        toast.error(result.error);
        return;
      }
      if (result.data.warning) toast.warning(result.data.warning);
      else toast.success("Client deleted");
      router.push("/super/clients");
      router.refresh();
    });
  }

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      {credentials ? (
        <CredentialsPanel
          title="New temporary password"
          email={credentials.email}
          password={credentials.password}
          onDismiss={() => setCredentials(null)}
        />
      ) : null}

      <form onSubmit={saveName} className={`${cardClass} flex flex-col gap-4 p-5`} noValidate>
        <h2 className={sectionTitle}>Profile</h2>
        <Field id="displayName" label="Display name" error={nameError}>
          <input id="displayName" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} aria-describedby="displayName-note" aria-invalid={nameError ? true : undefined} className={inputClass} />
        </Field>
        <div>
          <button type="submit" disabled={pending || name.trim() === profile.displayName} className={btnPrimary}>
            {pending ? <Spinner /> : null}
            Save name
          </button>
        </div>
      </form>

      <section className={`${cardClass} flex flex-col gap-3 p-5`} aria-labelledby="access">
        <h2 id="access" className={sectionTitle}>
          Access
        </h2>
        <p className="text-sm text-muted">
          {profile.isActive
            ? "This account can sign in. Disabling it blocks sign-in and ends existing sessions."
            : "This account is disabled and cannot sign in."}
        </p>
        {profile.isActive && disableBlock ? <p className="text-sm text-amber-900">{disableBlock}</p> : null}
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={toggleActive} disabled={pending || (profile.isActive && !!disableBlock)} className={profile.isActive ? btnDanger : btnPrimary}>
            {profile.isActive ? "Disable account" : "Enable account"}
          </button>
          <button type="button" onClick={resetPassword} disabled={pending} className={btnSecondary}>
            <KeyRound aria-hidden className="size-4" />
            Reset password
          </button>
        </div>
      </section>

      <form onSubmit={saveEmail} className={`${cardClass} flex flex-col gap-4 p-5`} noValidate>
        <h2 className={sectionTitle}>Sign-in email</h2>
        <Field id="email" label="Email" error={emailError} hint="The new address is confirmed automatically; no email is sent.">
          <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" aria-describedby="email-note" aria-invalid={emailError ? true : undefined} className={inputClass} />
        </Field>
        <div>
          <button type="submit" disabled={pending || email.trim().toLowerCase() === profile.email.toLowerCase()} className={btnSecondary}>
            Change email
          </button>
        </div>
      </form>

      <section className={`${cardClass} p-5`} aria-labelledby="museums">
        <h2 id="museums" className={sectionTitle}>
          Museums
        </h2>
        {museums.length === 0 ? (
          <p className="mt-2 text-sm text-muted">No museum yet. The client creates one on first sign-in.</p>
        ) : (
          <ul className="mt-2 divide-y divide-line">
            {museums.map((museum) => (
              <li key={museum.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{museum.title}</p>
                  <p className="text-sm text-muted">
                    {museum.hallCount} hall{museum.hallCount === 1 ? "" : "s"} · {museum.artworkCount} artwork{museum.artworkCount === 1 ? "" : "s"} ·{" "}
                    {museum.isPublished ? "Published" : "Draft"}
                  </p>
                </div>
                <a href={`/m/${museum.slug}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm font-medium text-accent-text">
                  /m/{museum.slug}
                  <ExternalLink aria-hidden className="size-3.5" />
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      <form onSubmit={remove} className={`${cardClass} flex flex-col gap-4 border-red-300 p-5`} noValidate>
        <h2 className={`${sectionTitle} text-red-700`}>Delete client</h2>
        <p className="text-sm text-muted">
          Permanently deletes the account, its museums, halls, artworks and uploaded files. This cannot be undone.
        </p>
        {deleteBlock ? (
          <p className="text-sm text-amber-900">{deleteBlock}</p>
        ) : (
          <Field id="confirmation" label={`Type ${profile.email} to confirm`} error={deleteError}>
            <input id="confirmation" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} autoComplete="off" spellCheck={false} aria-describedby="confirmation-note" aria-invalid={deleteError ? true : undefined} className={inputClass} />
          </Field>
        )}
        <div>
          <button type="submit" disabled={pending || !!deleteBlock || !deleteReady} className={btnDanger}>
            {pending ? <Spinner /> : <Trash2 aria-hidden className="size-4" />}
            Delete permanently
          </button>
        </div>
      </form>
    </div>
  );
}
