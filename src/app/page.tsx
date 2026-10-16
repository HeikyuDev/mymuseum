import type { Metadata } from "next";
import { Landmark } from "lucide-react";
import Link from "next/link";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { btnPrimary } from "@/components/ui/panel";
import { floorLayer, wallLayer } from "@/components/viewer/scenery";
import { I18nProvider } from "@/lib/i18n/provider";
import { getLocale, getT } from "@/lib/i18n/server";
import { PANEL_THEME } from "@/lib/panel-theme";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("common.appName"), description: t("home.metaDescription") };
}

// A quiet landing page: the product name, one sentence and the way in. Museums
// live at /m/[slug]; people with an account sign in from here.
export default async function HomePage() {
  const locale = await getLocale();
  const t = await getT();

  return (
    <I18nProvider initialLocale={locale}>
      <div className="relative flex min-h-dvh flex-col overflow-hidden bg-canvas text-fg" style={PANEL_THEME.cssVars}>
        <div aria-hidden className="absolute inset-0 opacity-60" style={wallLayer("plaster", null)} />
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-[22%]" style={floorLayer("parquet")} />
        <header className="relative flex justify-end p-4 sm:p-6">
          <LanguageSwitcher />
        </header>
        <main id="main" className="relative flex flex-1 items-center justify-center px-6 pb-24">
          <div className="flex max-w-xl flex-col items-center gap-6 rounded-theme border border-line bg-raised/90 px-8 py-12 text-center shadow-lg backdrop-blur">
            <span className="flex size-14 items-center justify-center rounded-theme bg-accent text-on-accent">
              <Landmark aria-hidden className="size-7" />
            </span>
            <div>
              <p className="font-display text-sm font-semibold tracking-wide text-muted uppercase">{t("common.appName")}</p>
              <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight sm:text-5xl">{t("home.title")}</h1>
            </div>
            <p className="max-w-md text-muted">{t("home.tagline")}</p>
            <Link href="/login" className={btnPrimary}>
              {t("home.signIn")}
            </Link>
          </div>
        </main>
      </div>
    </I18nProvider>
  );
}
