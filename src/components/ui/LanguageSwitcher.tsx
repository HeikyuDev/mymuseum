"use client";

import { Languages } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { LOCALES, type Locale } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n/provider";

const NAMES: Record<Locale, "lang.es" | "lang.en"> = { es: "lang.es", en: "lang.en" };

/**
 * ES / EN toggle for the login page and the panels. It stores the choice in the
 * `lang` cookie and refreshes the route so server-rendered text follows.
 */
export function LanguageSwitcher({ className = "" }: { className?: string }) {
  const { locale, t, setLocale } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function choose(next: Locale) {
    if (next === locale) return;
    startTransition(async () => {
      await setLocale(next);
      router.refresh();
    });
  }

  return (
    <div role="group" aria-label={t("lang.switchAria")} className={`inline-flex items-center gap-1 ${className}`}>
      <Languages aria-hidden className="size-4 text-muted" />
      {LOCALES.map((code) => (
        <button
          key={code}
          type="button"
          lang={code}
          disabled={pending}
          aria-pressed={locale === code}
          title={t(NAMES[code])}
          onClick={() => choose(code)}
          className="min-h-9 min-w-9 rounded-theme px-2 text-xs font-semibold uppercase text-muted transition hover:bg-surface hover:text-fg aria-pressed:bg-surface aria-pressed:text-fg"
        >
          {code}
        </button>
      ))}
    </div>
  );
}
