import { requireRole } from "@/lib/auth/session";
import { ADMIN_THEME } from "@/lib/admin/theme";

// Super-admin area (built in a later phase). The role is verified server-side.
export default async function SuperLayout({ children }: LayoutProps<"/super">) {
  await requireRole("super_admin");
  return (
    <div className="min-h-dvh bg-canvas text-fg" style={ADMIN_THEME.cssVars}>
      {children}
    </div>
  );
}
