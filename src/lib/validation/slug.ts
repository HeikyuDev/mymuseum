import { z } from "zod";

// Mirrors the CHECK constraints on public.museums.slug (see the initial schema migration).
export const RESERVED_SLUGS: readonly string[] = [
  "admin", "studio", "super", "api", "m", "login", "logout", "signup",
  "auth", "dashboard", "settings", "static", "public", "_next", "assets",
];

export const SLUG_MIN = 3;
export const SLUG_MAX = 40;
const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Lowercases, strips accents and collapses anything else into single hyphens. */
export function slugify(input: string, maxLength = SLUG_MAX): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength)
    .replace(/-+$/g, "");
}

/** Returns a validation message code (see translateCode), or null when the slug is acceptable. */
export function validateSlug(slug: string): string | null {
  if (slug.length < SLUG_MIN) return `val.slugMin:${SLUG_MIN}`;
  if (slug.length > SLUG_MAX) return `val.slugMax:${SLUG_MAX}`;
  if (!SLUG_PATTERN.test(slug)) return "val.slugFormat";
  if (RESERVED_SLUGS.includes(slug)) return "val.slugReserved";
  return null;
}

export const slugSchema = z
  .string()
  .trim()
  .superRefine((value, ctx) => {
    const problem = validateSlug(value);
    if (problem) ctx.addIssue({ code: "custom", message: problem });
  });

/** Picks a hall slug (unique inside one museum) derived from the hall name. */
export function uniqueHallSlug(name: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  const base = slugify(name, 50) || "hall";
  if (!used.has(base)) return base;
  for (let i = 2; i < 1000; i += 1) {
    const candidate = `${base}-${i}`;
    if (!used.has(candidate)) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}
