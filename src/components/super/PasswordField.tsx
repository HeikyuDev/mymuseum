"use client";

import { Check, Copy, Eye, EyeOff, RefreshCw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { btnSecondary, Field, inputClass } from "@/components/admin/ui";
import { copyToClipboard } from "@/components/super/clipboard";
import { generateTempPassword, passwordStrength } from "@/lib/super/password";

const STRENGTH_COLOR = ["bg-red-500", "bg-red-500", "bg-amber-500", "bg-emerald-500", "bg-emerald-600"];

type Props = { id: string; label: string; value: string; onChange: (value: string) => void; error?: string | null };

/** Password input with show/hide, a strong-password generator and copy. */
export function PasswordField({ id, label, value, onChange, error }: Props) {
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const strength = passwordStrength(value);

  async function copy() {
    if (!value) return;
    const ok = await copyToClipboard(value);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } else {
      toast.error("Could not copy the password");
    }
  }

  return (
    <Field id={id} label={label} error={error} hint="At least 12 characters with upper and lower case letters and a number.">
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete="new-password"
          spellCheck={false}
          aria-describedby={`${id}-note`}
          aria-invalid={error ? true : undefined}
          className={`${inputClass} font-mono`}
        />
        <div className="flex gap-2">
          <button
            type="button"
            className={btnSecondary}
            onClick={() => {
              onChange(generateTempPassword());
              setVisible(true);
            }}
          >
            <RefreshCw aria-hidden className="size-4" />
            Generate
          </button>
          <button type="button" className={`${btnSecondary} !px-3`} onClick={() => setVisible((v) => !v)} aria-label={visible ? "Hide password" : "Show password"} aria-pressed={visible}>
            {visible ? <EyeOff aria-hidden className="size-4" /> : <Eye aria-hidden className="size-4" />}
          </button>
          <button type="button" className={`${btnSecondary} !px-3`} onClick={copy} disabled={!value} aria-label="Copy password">
            {copied ? <Check aria-hidden className="size-4" /> : <Copy aria-hidden className="size-4" />}
          </button>
        </div>
      </div>
      {value ? (
        <div className="flex items-center gap-2" aria-live="polite">
          <div className="h-1.5 w-28 overflow-hidden rounded-full bg-surface" aria-hidden>
            <div className={`h-full ${STRENGTH_COLOR[strength.score]}`} style={{ width: `${(strength.score + 1) * 20}%` }} />
          </div>
          <span className="text-xs text-muted">Strength: {strength.label}</span>
        </div>
      ) : null}
    </Field>
  );
}
