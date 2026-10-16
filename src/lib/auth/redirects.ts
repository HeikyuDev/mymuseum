import type { UserRole } from "@/types/database";

/** Landing area for each role after signing in. */
export function homeForRole(role: UserRole): string {
  return role === "super_admin" ? "/super" : "/admin";
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
  const inArea = (prefix: string) => next === prefix || next.startsWith(`${prefix}/`) || next.startsWith(`${prefix}?`);
  if (inArea("/admin")) return next;
  if (inArea("/super") && role === "super_admin") return next;
  return null;
}
