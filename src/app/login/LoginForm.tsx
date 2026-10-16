"use client";

import { AlertCircle, Eye, EyeOff } from "lucide-react";
import { useActionState, useState } from "react";
import { btnPrimary, Field, inputClass, Spinner } from "@/components/ui/panel";
import { signIn, type LoginState } from "./actions";

const initialState: LoginState = {};

export function LoginForm({ next, notice }: { next: string | null; notice: string | null }) {
  const [state, formAction, pending] = useActionState(signIn, initialState);
  const [showPassword, setShowPassword] = useState(false);
  const message = state.error ?? notice;

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      {next ? <input type="hidden" name="next" value={next} /> : null}

      {message ? (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-theme border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-800"
        >
          <AlertCircle aria-hidden className="mt-0.5 size-4 shrink-0" />
          <p>{message}</p>
        </div>
      ) : null}

      <Field id="email" label="Email">
        <input
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          required
          autoFocus
          defaultValue={state.email ?? ""}
          aria-invalid={state.error ? true : undefined}
          className={inputClass}
        />
      </Field>

      <Field id="password" label="Password">
        <div className="relative">
          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            aria-invalid={state.error ? true : undefined}
            className={`${inputClass} pr-12`}
          />
          <button
            type="button"
            onClick={() => setShowPassword((value) => !value)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            aria-pressed={showPassword}
            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted hover:text-fg"
          >
            {showPassword ? <EyeOff aria-hidden className="size-4" /> : <Eye aria-hidden className="size-4" />}
          </button>
        </div>
      </Field>

      <button type="submit" disabled={pending} className={`${btnPrimary} w-full`}>
        {pending ? <Spinner /> : null}
        {pending ? "Signing in" : "Sign in"}
      </button>
    </form>
  );
}
