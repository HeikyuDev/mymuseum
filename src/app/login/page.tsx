import type { Metadata } from "next";
import { Landmark } from "lucide-react";
import { redirect } from "next/navigation";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { floorLayer, wallLayer } from "@/components/viewer/scenery";
import { homeForRole, safeNextPath } from "@/lib/auth/redirects";
import { getAuthState } from "@/lib/auth/session";
import { I18nProvider } from "@/lib/i18n/provider";
import { getLocale, getT } from "@/lib/i18n/server";
import { PANEL_THEME } from "@/lib/panel-theme";
import { LoginForm } from "./LoginForm";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("auth.pageTitle") };
}

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const nextParam = typeof params.next === "string" ? params.next : null;
  const errorParam = typeof params.error === "string" ? params.error : null;

  const auth = await getAuthState();
  if (auth.status === "ok") {
    redirect(safeNextPath(nextParam, auth.profile.role) ?? homeForRole(auth.profile.role));
  }

  const locale = await getLocale();
  const t = await getT();
  const notice = errorParam === "disabled" ? t("auth.disabled") : null;

  return (
    <I18nProvider initialLocale={locale}>
      <div className="grid min-h-dvh bg-canvas text-fg lg:grid-cols-2" style={PANEL_THEME.cssVars}>
        <aside aria-hidden className="relative hidden overflow-hidden lg:block" style={wallLayer("plaster", null)}>
          <div className="absolute inset-x-0 bottom-0 h-[28%]" style={floorLayer("parquet")} />
          <div className="absolute inset-x-0 bottom-[28%] h-3 bg-white/70 shadow-sm" />
          <div className="absolute top-[14%] left-[12%] h-[34%] w-[26%] bg-white p-2 shadow-[8px_12px_24px_rgba(0,0,0,.25)]">
            <div className="size-full bg-gradient-to-br from-amber-200 via-rose-200 to-sky-300" />
          </div>
          <div className="absolute top-[22%] left-[44%] h-[30%] w-[40%] bg-neutral-900 p-2 shadow-[8px_12px_24px_rgba(0,0,0,.3)]">
            <div className="size-full bg-gradient-to-tr from-slate-200 via-stone-300 to-emerald-200" />
          </div>
        </aside>

        <main className="relative flex items-center justify-center px-5 py-12 sm:px-8">
          <LanguageSwitcher className="absolute top-4 right-4" />
          <div className="w-full max-w-sm">
            <div className="mb-8 flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-theme bg-accent text-on-accent">
                <Landmark aria-hidden className="size-6" />
              </span>
              <span className="font-display text-xl font-semibold tracking-tight">{t("common.appName")}</span>
            </div>
            <h1 className="font-display text-3xl font-semibold tracking-tight">{t("auth.heading")}</h1>
            <p className="mt-2 mb-8 text-sm text-muted">{t("auth.subtitle")}</p>
            <LoginForm next={safeNextPath(nextParam, "super_admin")} notice={notice} />
          </div>
        </main>
      </div>
    </I18nProvider>
  );
}
