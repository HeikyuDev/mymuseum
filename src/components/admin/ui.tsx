import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";

// Shared building blocks for the admin interface. Colors come from the same
// theme tokens as the viewer, resolved with a fixed neutral palette.

const btnBase =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-theme px-4 text-sm font-semibold whitespace-nowrap transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50";

export const btnPrimary = `${btnBase} bg-accent text-on-accent shadow-sm hover:brightness-110`;
export const btnSecondary = `${btnBase} border border-line bg-raised text-fg hover:bg-surface`;
export const btnDanger = `${btnBase} border border-red-300 bg-raised text-red-700 hover:bg-red-50`;
export const btnGhost = `${btnBase} text-fg hover:bg-surface`;
export const btnIconSm =
  "inline-flex size-9 items-center justify-center rounded-theme border border-line bg-raised text-fg transition hover:bg-surface disabled:pointer-events-none disabled:opacity-40";

export const inputClass =
  "block min-h-11 w-full rounded-theme border border-line bg-raised px-3 text-sm text-fg placeholder:text-muted/70 focus-visible:border-accent aria-[invalid=true]:border-red-500 disabled:opacity-60";
export const textareaClass = `${inputClass} min-h-24 py-2.5 leading-relaxed`;
export const cardClass = "rounded-theme border border-line bg-raised shadow-sm";

export function Spinner({ className = "size-4" }: { className?: string }) {
  return <Loader2 aria-hidden className={`${className} animate-spin`} />;
}

type FieldProps = {
  id: string;
  label: string;
  hint?: ReactNode;
  error?: string | null;
  children: ReactNode;
};

/** Label + control + hint/error wrapper. The control must use `id` and aria-describedby `${id}-note`. */
export function Field({ id, label, hint, error, children }: FieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-fg">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-note`} role="alert" className="text-sm text-red-700">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-note`} className="text-sm text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        {description ? <p className="mt-1 max-w-2xl text-sm text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-theme border border-dashed border-line bg-raised px-6 py-14 text-center">
      <h2 className="font-display text-lg font-semibold">{title}</h2>
      <p className="max-w-sm text-sm text-muted">{description}</p>
      {action}
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`animate-pulse rounded-theme bg-surface ${className}`} />;
}
