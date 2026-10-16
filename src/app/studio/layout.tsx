import type { Metadata } from "next";
import { Landmark, LogOut } from "lucide-react";
import Link from "next/link";
import { Toaster } from "sonner";
import { signOut } from "@/app/login/actions";
import { BottomNav, SidebarNav } from "@/components/ui/PanelNav";
import { MuseumStatusBar } from "@/components/studio/MuseumStatusBar";
import { Onboarding } from "@/components/studio/Onboarding";
import { StudioBottomNav, StudioSidebar } from "./StudioNav";
import { PANEL_THEME } from "@/lib/panel-theme";
import { getOwnMuseum, requireUser } from "@/lib/auth/session";
import { I18nProvider } from "@/lib/i18n/provider";
import { getLocale } from "@/lib/i18n/server";

export const metadata: Metadata = { title: { default: "Admin", template: "%s | MyMuseum admin" }, robots: { index: false } };

// Auth is verified here AND again in every page and server action: layouts are
// not re-rendered on client-side navigation, so they cannot be the only guard.
export default async function StudioLayout({ children }: LayoutProps<"/studio">) {
  const { profile } = await requireUser();
  const museum = await getOwnMuseum();
  const locale = await getLocale();

  return (
    <I18nProvider initialLocale={locale}>
    <div className="flex min-h-dvh flex-col bg-canvas text-fg" style={PANEL_THEME.cssVars}>
      <Toaster position="top-center" richColors closeButton />
      <header className="sticky top-0 z-30 border-b border-line bg-raised/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5 sm:px-6">
          <Link href="/studio" className="flex items-center gap-2 font-display text-lg font-semibold tracking-tight">
            <span className="flex size-8 items-center justify-center rounded-theme bg-accent text-on-accent">
              <Landmark aria-hidden className="size-4.5" />
            </span>
            <span className="max-w-[10rem] truncate">{museum?.title ?? "MyMuseum"}</span>
          </Link>
          <div className="ml-auto flex flex-wrap items-center gap-3">
            {museum ? <MuseumStatusBar slug={museum.slug} published={museum.is_published} /> : null}
            <form action={signOut}>
              <button
                type="submit"
                title={`Sign out (${profile.email})`}
                className="inline-flex min-h-9 items-center gap-2 rounded-theme px-2.5 text-sm font-medium text-muted hover:bg-surface hover:text-fg"
              >
                <LogOut aria-hidden className="size-4" />
                <span className="hidden sm:inline">Sign out</span>
              </button>
            </form>
          </div>
        </div>
      </header>

      {museum ? (
        <div className="mx-auto flex w-full max-w-7xl flex-1 gap-8 px-4 py-6 pb-24 sm:px-6 md:pb-10">
          <StudioSidebar />
          <main id="main" className="min-w-0 flex-1">
            {children}
          </main>
        </div>
      ) : (
        <Onboarding />
      )}
      {museum ? <StudioBottomNav /> : null}
    </div>
    </I18nProvider>
  );
}
