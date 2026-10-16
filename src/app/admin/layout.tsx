import type { Metadata } from "next";
import { Landmark, LogOut } from "lucide-react";
import Link from "next/link";
import { Toaster } from "sonner";
import { signOut } from "@/app/login/actions";
import { BottomNav, SidebarNav } from "@/components/admin/AdminNav";
import { MuseumStatusBar } from "@/components/admin/MuseumStatusBar";
import { Onboarding } from "@/components/admin/Onboarding";
import { ADMIN_THEME } from "@/lib/admin/theme";
import { getOwnedMuseum, requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: { default: "Admin", template: "%s | MyMuseum admin" }, robots: { index: false } };

// Auth is verified here AND again in every page and server action: layouts are
// not re-rendered on client-side navigation, so they cannot be the only guard.
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const { profile } = await requireUser();
  const museum = await getOwnedMuseum();

  return (
    <div className="flex min-h-dvh flex-col bg-canvas text-fg" style={ADMIN_THEME.cssVars}>
      <Toaster position="top-center" richColors closeButton />
      <header className="sticky top-0 z-30 border-b border-line bg-raised/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5 sm:px-6">
          <Link href="/admin" className="flex items-center gap-2 font-display text-lg font-semibold tracking-tight">
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
          <SidebarNav />
          <main id="main" className="min-w-0 flex-1">
            {children}
          </main>
        </div>
      ) : (
        <Onboarding />
      )}
      {museum ? <BottomNav /> : null}
    </div>
  );
}
