"use client";

import { useId, type ReactNode } from "react";

// Small form controls for the export dialog. They use the theme tokens only,
// so they match both the museum viewer and the admin.

export const inputCls =
  "block min-h-11 w-full rounded-theme border border-line bg-surface px-3 text-base text-fg placeholder:text-muted focus-visible:border-accent";

export function FieldRow({ label, hint, htmlFor, children }: { label: string; hint?: string; htmlFor?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium text-fg">
        {label}
      </label>
      {children}
      {hint ? <p className="text-sm text-muted">{hint}</p> : null}
    </div>
  );
}

export type ChoiceOption<T extends string> = { value: T; label: string };

/** Segmented single choice, built on real radio inputs (arrow keys, screen readers). */
export function Segmented<T extends string>({
  legend,
  value,
  options,
  onChange,
  hideLegend = false,
}: {
  legend: string;
  value: T;
  options: readonly ChoiceOption<T>[];
  onChange: (value: T) => void;
  hideLegend?: boolean;
}) {
  const name = useId();
  return (
    <fieldset className="min-w-0">
      <legend className={hideLegend ? "sr-only" : "mb-1.5 text-sm font-medium text-fg"}>{legend}</legend>
      <div className="grid gap-1 rounded-theme border border-line bg-surface p-1" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
        {options.map((option) => (
          <label key={option.value} className="relative">
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              className="peer sr-only"
            />
            <span className="flex min-h-11 cursor-pointer items-center justify-center rounded-[calc(var(--v-radius,12px)-4px)] px-2 text-center text-sm font-medium text-fg transition peer-checked:bg-accent peer-checked:text-on-accent peer-focus-visible:outline-3 peer-focus-visible:outline-offset-1 peer-focus-visible:outline-accent hover:bg-raised peer-checked:hover:bg-accent">
              {option.label}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function SelectField<T extends string>({
  label,
  value,
  onChange,
  children,
  hint,
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  children: ReactNode;
  hint?: string;
}) {
  const id = useId();
  return (
    <FieldRow label={label} htmlFor={id} hint={hint}>
      <select id={id} value={value} onChange={(event) => onChange(event.target.value as T)} className={inputCls}>
        {children}
      </select>
    </FieldRow>
  );
}

export function SwitchField({ label, description, checked, onChange }: { label: string; description?: string; checked: boolean; onChange: (value: boolean) => void }) {
  const id = useId();
  return (
    <label htmlFor={id} className="flex min-h-11 cursor-pointer items-center justify-between gap-4">
      <span className="min-w-0">
        <span className="block text-sm font-medium text-fg">{label}</span>
        {description ? <span className="block text-sm text-muted">{description}</span> : null}
      </span>
      <input id={id} type="checkbox" role="switch" checked={checked} onChange={(event) => onChange(event.target.checked)} className="peer sr-only" />
      <span
        aria-hidden
        className="relative h-6 w-11 shrink-0 rounded-full bg-line transition peer-checked:bg-accent peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent after:absolute after:top-0.5 after:left-0.5 after:size-5 after:rounded-full after:bg-white after:shadow after:transition peer-checked:after:translate-x-5"
      />
    </label>
  );
}
