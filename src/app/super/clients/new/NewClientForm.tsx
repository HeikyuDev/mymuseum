"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createClientAccount, type CreatedClient } from "@/app/super/actions";
import { btnPrimary, btnSecondary, cardClass, Field, inputClass, Spinner } from "@/components/admin/ui";
import { CredentialsPanel } from "@/components/super/CredentialsPanel";
import { PasswordField } from "@/components/super/PasswordField";
import { slugify } from "@/lib/validation/slug";

type Values = { email: string; displayName: string; password: string; museumTitle: string; museumSlug: string };

const empty = (): Values => ({ email: "", displayName: "", password: "", museumTitle: "", museumSlug: "" });

export function NewClientForm() {
  const [values, setValues] = useState<Values>(empty);
  const [slugTouched, setSlugTouched] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [created, setCreated] = useState<{ client: CreatedClient; password: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const set = (key: keyof Values) => (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setValues((current) => {
      const next = { ...current, [key]: value };
      // Keep the address in sync with the title until the admin edits it.
      if (key === "museumTitle" && !slugTouched) next.museumSlug = slugify(value);
      return next;
    });
    if (key === "museumSlug") setSlugTouched(true);
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
      if (result.data.warning) toast.warning(result.data.warning);
      else toast.success("Client created");
      // The form (and its password) is cleared immediately.
      setValues(empty());
      setSlugTouched(false);
    });
  }

  if (created) {
    return (
      <div className="flex max-w-2xl flex-col gap-4">
        <CredentialsPanel
          title="Client created"
          email={created.client.email}
          password={created.password}
          museumPath={created.client.museumSlug ? `/m/${created.client.museumSlug}` : null}
          onDismiss={() => setCreated(null)}
        />
        <div className="flex flex-wrap gap-2">
          <Link href={`/super/clients/${created.client.userId}`} className={btnSecondary}>
            Open client
          </Link>
          <Link href="/super/clients" className={btnSecondary}>
            Back to clients
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className={`${cardClass} flex max-w-2xl flex-col gap-5 p-5 sm:p-6`} noValidate autoComplete="off">
      <Field id="email" label="Email" error={errors.email}>
        <input id="email" type="email" value={values.email} onChange={set("email")} required autoComplete="off" aria-describedby="email-note" aria-invalid={errors.email ? true : undefined} className={inputClass} />
      </Field>
      <Field id="displayName" label="Display name" error={errors.displayName}>
        <input id="displayName" value={values.displayName} onChange={set("displayName")} maxLength={80} required aria-describedby="displayName-note" aria-invalid={errors.displayName ? true : undefined} className={inputClass} />
      </Field>
      <PasswordField id="password" label="Temporary password" value={values.password} onChange={(password) => setValues((current) => ({ ...current, password }))} error={errors.password} />

      <fieldset className="flex flex-col gap-5 rounded-theme border border-line p-4">
        <legend className="px-1 text-sm font-medium">Initial museum (optional)</legend>
        <Field id="museumTitle" label="Museum title" error={errors.museumTitle} hint="Leave empty to let the client create their museum on first sign-in.">
          <input id="museumTitle" value={values.museumTitle} onChange={set("museumTitle")} maxLength={120} aria-describedby="museumTitle-note" aria-invalid={errors.museumTitle ? true : undefined} className={inputClass} />
        </Field>
        <Field id="museumSlug" label="Museum address" error={errors.museumSlug} hint={`Public link: /m/${values.museumSlug || "address"}`}>
          <input id="museumSlug" value={values.museumSlug} onChange={set("museumSlug")} maxLength={40} autoCapitalize="none" spellCheck={false} aria-describedby="museumSlug-note" aria-invalid={errors.museumSlug ? true : undefined} className={`${inputClass} font-mono`} />
        </Field>
      </fieldset>

      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={pending} className={btnPrimary}>
          {pending ? <Spinner /> : null}
          Create client
        </button>
        <Link href="/super/clients" className={btnSecondary}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
