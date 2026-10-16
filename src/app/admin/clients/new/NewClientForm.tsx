"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createClientAccount, type CreatedClient } from "@/app/admin/actions";
import { CredentialsPanel } from "@/components/admin/CredentialsPanel";
import { PasswordField } from "@/components/admin/PasswordField";
import { btnPrimary, btnSecondary, cardClass, Field, inputClass, Spinner } from "@/components/ui/panel";
import { useI18n } from "@/lib/i18n/provider";

type Values = { email: string; displayName: string; password: string };

const empty = (): Values => ({ email: "", displayName: "", password: "" });

export function NewClientForm() {
  const { t } = useI18n();
  const [values, setValues] = useState<Values>(empty);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [created, setCreated] = useState<{ client: CreatedClient; password: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const set = (key: keyof Values) => (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setValues((current) => ({ ...current, [key]: value }));
  };

  function submit(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = await createClientAccount(values);
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        toast.error(result.error);
        return;
      }
      setErrors({});
      setCreated({ client: result.data, password: values.password });
      toast.success(t("adm.clientCreated"));
      // The form (and its password) is cleared immediately.
      setValues(empty());
    });
  }

  if (created) {
    return (
      <div className="flex max-w-2xl flex-col gap-4">
        <CredentialsPanel
          title={t("adm.clientCreated")}
          email={created.client.email}
          password={created.password}
          onDismiss={() => setCreated(null)}
        />
        <div className="flex flex-wrap gap-2">
          <Link href={`/admin/clients/${created.client.userId}`} className={btnSecondary}>
            {t("adm.openClient")}
          </Link>
          <Link href="/admin/clients" className={btnSecondary}>
            {t("adm.backToClients")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className={`${cardClass} flex max-w-2xl flex-col gap-5 p-5 sm:p-6`} noValidate autoComplete="off">
      <Field id="email" label={t("adm.fieldEmail")} error={errors.email}>
        <input id="email" type="email" value={values.email} onChange={set("email")} required autoComplete="off" aria-describedby="email-note" aria-invalid={errors.email ? true : undefined} className={inputClass} />
      </Field>
      <Field id="displayName" label={t("adm.fieldName")} error={errors.displayName}>
        <input id="displayName" value={values.displayName} onChange={set("displayName")} maxLength={80} required aria-describedby="displayName-note" aria-invalid={errors.displayName ? true : undefined} className={inputClass} />
      </Field>
      <PasswordField id="password" label={t("adm.fieldTempPassword")} value={values.password} onChange={(password) => setValues((current) => ({ ...current, password }))} error={errors.password} />

      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={pending} className={btnPrimary}>
          {pending ? <Spinner /> : null}
          {t("adm.createClient")}
        </button>
        <Link href="/admin/clients" className={btnSecondary}>
          {t("common.cancel")}
        </Link>
      </div>
    </form>
  );
}
