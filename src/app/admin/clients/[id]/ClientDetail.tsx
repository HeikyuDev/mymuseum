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
} from "@/app/admin/actions";
import { CredentialsPanel } from "@/components/admin/CredentialsPanel";
import { btnDanger, btnPrimary, btnSecondary, cardClass, Field, inputClass, Spinner } from "@/components/ui/panel";
import { accountGuardError, isDeleteConfirmed } from "@/lib/admin/guards";
import { useI18n } from "@/lib/i18n/provider";
import type { UserRole } from "@/types/database";

type Profile = { id: string; email: string; displayName: string; role: UserRole; isActive: boolean };
type Museum = { id: string; title: string; slug: string; isPublished: boolean; hallCount: number; artworkCount: number };

type Props = { profile: Profile; museum: Museum | null; isSelf: boolean; activeSuperAdmins: number };

const sectionTitle = "font-display text-lg font-semibold";

export function ClientDetail({ profile, museum, isSelf, activeSuperAdmins }: Props) {
  const { t } = useI18n();
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
      toast.success(t("adm.nameUpdated"));
      router.refresh();
    });
  }

  function saveEmail(event: React.FormEvent) {
    event.preventDefault();
    if (!window.confirm(t("adm.confirmEmail", { email: email.trim() }))) return;
    startTransition(async () => {
      const result = await changeClientEmail(profile.id, { email });
      if (!result.ok) {
        setEmailError(result.fieldErrors?.email ?? null);
        toast.error(result.error);
        return;
      }
      setEmailError(null);
      setEmail(result.data.email);
      toast.success(t("adm.emailUpdated"));
      router.refresh();
    });
  }

  function toggleActive() {
    const next = !profile.isActive;
    const message = next ? t("adm.confirmEnable", { email: profile.email }) : t("adm.confirmDisable", { email: profile.email });
    if (!window.confirm(message)) return;
    startTransition(async () => {
      const result = await setClientActive(profile.id, next);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      if (result.data.warning) toast.warning(result.data.warning);
      else toast.success(next ? t("adm.accountEnabled") : t("adm.accountDisabled"));
      router.refresh();
    });
  }

  function resetPassword() {
    if (!window.confirm(t("adm.confirmReset", { email: profile.email }))) return;
    startTransition(async () => {
      const result = await resetClientPassword(profile.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setCredentials(result.data);
      toast.success(t("adm.passwordReset"));
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
      else toast.success(t("adm.clientDeleted"));
      router.push("/admin/clients");
      router.refresh();
    });
  }

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      {credentials ? (
        <CredentialsPanel
          title={t("adm.newTempPassword")}
          email={credentials.email}
          password={credentials.password}
          onDismiss={() => setCredentials(null)}
        />
      ) : null}

      <form onSubmit={saveName} className={`${cardClass} flex flex-col gap-4 p-5`} noValidate>
        <h2 className={sectionTitle}>{t("adm.profile")}</h2>
        <Field id="displayName" label={t("adm.fieldName")} error={nameError}>
          <input id="displayName" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} aria-describedby="displayName-note" aria-invalid={nameError ? true : undefined} className={inputClass} />
        </Field>
        <div>
          <button type="submit" disabled={pending || name.trim() === profile.displayName} className={btnPrimary}>
            {pending ? <Spinner /> : null}
            {t("adm.saveName")}
          </button>
        </div>
      </form>

      <section className={`${cardClass} flex flex-col gap-3 p-5`} aria-labelledby="access">
        <h2 id="access" className={sectionTitle}>
          {t("adm.access")}
        </h2>
        <p className="text-sm text-muted">{profile.isActive ? t("adm.accessActive") : t("adm.accessDisabled")}</p>
        {profile.isActive && disableBlock ? <p className="text-sm text-amber-900">{t(disableBlock)}</p> : null}
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={toggleActive} disabled={pending || (profile.isActive && !!disableBlock)} className={profile.isActive ? btnDanger : btnPrimary}>
            {profile.isActive ? t("adm.disableAccount") : t("adm.enableAccount")}
          </button>
          <button type="button" onClick={resetPassword} disabled={pending} className={btnSecondary}>
            <KeyRound aria-hidden className="size-4" />
            {t("adm.resetPassword")}
          </button>
        </div>
      </section>

      <form onSubmit={saveEmail} className={`${cardClass} flex flex-col gap-4 p-5`} noValidate>
        <h2 className={sectionTitle}>{t("adm.signInEmail")}</h2>
        <Field id="email" label={t("adm.fieldEmail")} error={emailError} hint={t("adm.emailHint")}>
          <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" aria-describedby="email-note" aria-invalid={emailError ? true : undefined} className={inputClass} />
        </Field>
        <div>
          <button type="submit" disabled={pending || email.trim().toLowerCase() === profile.email.toLowerCase()} className={btnSecondary}>
            {t("adm.changeEmail")}
          </button>
        </div>
      </form>

      <section className={`${cardClass} p-5`} aria-labelledby="museum">
        <h2 id="museum" className={sectionTitle}>
          {t("adm.museumSection")}
        </h2>
        {museum ? (
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{museum.title}</p>
              <p className="text-sm text-muted">
                {t("adm.museumStats", {
                  halls: museum.hallCount,
                  artworks: museum.artworkCount,
                  status: museum.isPublished ? t("status.published") : t("status.draft"),
                })}
              </p>
            </div>
            <a href={`/m/${museum.slug}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm font-medium text-accent-text" aria-label={t("adm.openMuseum")}>
              /m/{museum.slug}
              <ExternalLink aria-hidden className="size-3.5" />
            </a>
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted">{t("adm.noMuseumBody")}</p>
        )}
      </section>

      <form onSubmit={remove} className={`${cardClass} flex flex-col gap-4 border-red-300 p-5`} noValidate>
        <h2 className={`${sectionTitle} text-red-700`}>{t("adm.deleteClient")}</h2>
        <p className="text-sm text-muted">{t("adm.deleteBody")}</p>
        {deleteBlock ? (
          <p className="text-sm text-amber-900">{t(deleteBlock)}</p>
        ) : (
          <Field id="confirmation" label={t("adm.typeToConfirm", { email: profile.email })} error={deleteError}>
            <input id="confirmation" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} autoComplete="off" spellCheck={false} aria-describedby="confirmation-note" aria-invalid={deleteError ? true : undefined} className={inputClass} />
          </Field>
        )}
        <div>
          <button type="submit" disabled={pending || !!deleteBlock || !deleteReady} className={btnDanger}>
            {pending ? <Spinner /> : <Trash2 aria-hidden className="size-4" />}
            {t("adm.deletePermanently")}
          </button>
        </div>
      </form>
    </div>
  );
}
