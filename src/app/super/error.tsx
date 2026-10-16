"use client";

import { btnPrimary } from "@/components/admin/ui";

export default function SuperError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div role="alert" className="mx-auto flex max-w-md flex-col items-center gap-4 py-20 text-center">
      <h1 className="font-display text-2xl font-semibold">Something went wrong</h1>
      <p className="text-sm text-muted">
        We could not load this page. Try again, and if the problem persists reload the page.
      </p>
      {error.digest ? <p className="text-xs text-muted">Reference: {error.digest}</p> : null}
      <button type="button" onClick={reset} className={btnPrimary}>
        Try again
      </button>
    </div>
  );
}
