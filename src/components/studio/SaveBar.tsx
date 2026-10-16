"use client";

import { btnPrimary, btnSecondary, Spinner } from "@/components/ui/panel";

type Props = { dirty: boolean; pending: boolean; onSave: () => void; onDiscard: () => void; saveLabel: string };

/** Sticky bar that fades in when a form has unsaved changes. Reserves its space to avoid layout shift. */
export function SaveBar({ dirty, pending, onSave, onDiscard, saveLabel }: Props) {
  return (
    <div
      className={`sticky bottom-16 z-20 mt-6 flex items-center justify-between gap-3 rounded-theme border border-line bg-raised px-4 py-3 shadow-lg transition md:bottom-4 ${
        dirty ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
      aria-hidden={!dirty}
    >
      <p className="text-sm font-medium" role="status">
        {dirty ? "You have unsaved changes." : ""}
      </p>
      <div className="flex gap-2">
        <button type="button" className={btnSecondary} onClick={onDiscard} disabled={pending || !dirty} tabIndex={dirty ? 0 : -1}>
          Discard
        </button>
        <button type="button" className={btnPrimary} onClick={onSave} disabled={pending || !dirty} tabIndex={dirty ? 0 : -1}>
          {pending ? <Spinner /> : null}
          {saveLabel}
        </button>
      </div>
    </div>
  );
}
