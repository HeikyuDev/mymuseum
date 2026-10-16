import type { Metadata } from "next";
import { Landmark } from "lucide-react";
import { redirect } from "next/navigation";
import { floorLayer, wallLayer } from "@/components/viewer/scenery";
import { homeForRole, safeNextPath } from "@/lib/auth/redirects";
import { getAuthState } from "@/lib/auth/session";
import { ADMIN_THEME } from "@/lib/admin/theme";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Sign in" };

const NOTICES: Record<string, string> = {
  disabled: "This account has been disabled. Please contact the administrator.",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const nextParam = typeof params.next === "string" ? params.next : null;
  const errorParam = typeof params.error === "string" ? params.error : null;

  const auth = await getAuthState();
  if (auth.status === "ok") {
    redirect(safeNextPath(nextParam, auth.profile.role) ?? homeForRole(auth.profile.role));
  }

  return (
    <div className="grid min-h-dvh bg-canvas text-fg lg:grid-cols-2" style={ADMIN_THEME.cssVars}>
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

      <main className="flex items-center justify-center px-5 py-12 sm:px-8">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-theme bg-accent text-on-accent">
              <Landmark aria-hidden className="size-6" />
            </span>
            <span className="font-display text-xl font-semibold tracking-tight">MyMuseum</span>
          </div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Sign in</h1>
          <p className="mt-2 mb-8 text-sm text-muted">Manage your museum, halls and artworks.</p>
          <LoginForm next={safeNextPath(nextParam, "super_admin")} notice={errorParam ? (NOTICES[errorParam] ?? null) : null} />
        </div>
      </main>
    </div>
  );
}
