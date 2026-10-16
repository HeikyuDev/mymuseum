import type { Metadata } from "next";
import { LogOut, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { Toaster } from "sonner";
import { signOut } from "@/app/login/actions";
import { PANEL_THEME } from "@/lib/panel-theme";
import { requireRole } from "@/lib/auth/session";
import { AdminBottomNav, AdminSidebar } from "./AdminNav";

export const metadata: Metadata = { title: { default: "Super admin", template: "%s | MyMuseum super admin" }, robots: { index: false } };

// The role is verified here AND again in every page, query and server action:
// layouts are not re-rendered on client-side navigation.
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const { profile } = await requireRole("super_admin");
  return (
    <div className="flex min-h-dvh flex-col bg-canvas text-fg" style={PANEL_THEME.cssVars}>
      <Toaster position="top-center" richColors closeButton />
      <header className="sticky top-0 z-30 border-b border-line bg-raised/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5 sm:px-6">
          <Link href="/admin" className="flex items-center gap-2 font-display text-lg font-semibold tracking-tight">
            <span className="flex size-8 items-center justify-center rounded-theme bg-accent text-on-accent">
              <ShieldCheck aria-hidden className="size-4.5" />
            </span>
            <span>MyMuseum platform</span>
          </Link>
          <div className="ml-auto flex flex-wrap items-center gap-3">
            <Link href="/studio" className="text-sm font-medium text-muted hover:text-fg">
              My museum
            </Link>
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

      <div className="mx-auto flex w-full max-w-7xl flex-1 gap-8 px-4 py-6 pb-24 sm:px-6 md:pb-10">
        <AdminSidebar />
        <main id="main" className="min-w-0 flex-1">
          {children}
        </main>
      </div>
      <AdminBottomNav />
    </div>
  );
}
