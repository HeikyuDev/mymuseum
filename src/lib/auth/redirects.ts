import type { UserRole } from "@/types/database";

// Route areas
//   /admin   platform administration (super_admin only): creates and manages clients
//   /studio  the museum owner's panel (any active signed-in user)
//   /m/...   public museum viewer (never protected)
export const ADMIN_AREA = "/admin";
export const STUDIO_AREA = "/studio";

const PROTECTED_AREAS = [ADMIN_AREA, STUDIO_AREA] as const;

function inArea(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(`${prefix}/`) || path.startsWith(`${prefix}?`);
}

/** Landing area for each role after signing in. */
export function homeForRole(role: UserRole): string {
  return role === "super_admin" ? ADMIN_AREA : STUDIO_AREA;
}

/** True for paths that need a signed-in user. The proxy uses this as a first line of defence. */
export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_AREAS.some((area) => inArea(pathname, area));
}

/** Where a signed-in user who opened an area they may not use should go instead. */
export function fallbackForRole(role: UserRole): string {
  return homeForRole(role);
}

/**
 * `/login?next=...` for an anonymous visitor of a protected path. The target is
 * kept so they come back after signing in.
 */
export function loginPathFor(pathname: string, search = ""): string {
  const params = new URLSearchParams({ next: `${pathname}${search}` });
  return `/login?${params.toString()}`;
}

/**
 * Accepts a post-login target only when it is a same-site path inside the
 * areas the role may open. Anything else (external URLs, protocol-relative
 * links, other roles' areas) is ignored.
 */
export function safeNextPath(next: unknown, role: UserRole): string | null {
  if (typeof next !== "string" || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) {
    return null;
  }
  if (inArea(next, STUDIO_AREA)) return next;
  if (inArea(next, ADMIN_AREA) && role === "super_admin") return next;
  return null;
}
