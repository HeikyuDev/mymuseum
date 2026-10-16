// Parsing and building of list URLs (search, filters, pagination) for /super.

export const PAGE_SIZE = 15;

export const CLIENT_STATUS_FILTERS = ["all", "active", "disabled"] as const;
export const CLIENT_ROLE_FILTERS = ["all", "owner", "super_admin"] as const;
export const MUSEUM_STATUS_FILTERS = ["all", "published", "draft"] as const;

export type ClientStatusFilter = (typeof CLIENT_STATUS_FILTERS)[number];
export type ClientRoleFilter = (typeof CLIENT_ROLE_FILTERS)[number];
export type MuseumStatusFilter = (typeof MUSEUM_STATUS_FILTERS)[number];

export type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

function oneOf<T extends string>(value: string, allowed: readonly T[], fallback: T): T {
  return (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

/**
 * Makes free text safe to embed in a PostgREST `or()` filter: removes the
 * characters that separate or group filters and the LIKE wildcards.
 */
export function sanitizeSearch(raw: string): string {
  return raw
    .replace(/[%*,()"'\\:;]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

export function parsePage(raw: string): number {
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 1 && n <= 100_000 ? n : 1;
}

export type ClientListParams = { q: string; status: ClientStatusFilter; role: ClientRoleFilter; page: number };
export type MuseumListParams = { q: string; status: MuseumStatusFilter; page: number };

export function parseClientParams(sp: SearchParams): ClientListParams {
  return {
    q: sanitizeSearch(first(sp.q)),
    status: oneOf(first(sp.status), CLIENT_STATUS_FILTERS, "all"),
    role: oneOf(first(sp.role), CLIENT_ROLE_FILTERS, "all"),
    page: parsePage(first(sp.page)),
  };
}

export function parseMuseumParams(sp: SearchParams): MuseumListParams {
  return {
    q: sanitizeSearch(first(sp.q)),
    status: oneOf(first(sp.status), MUSEUM_STATUS_FILTERS, "all"),
    page: parsePage(first(sp.page)),
  };
}

/** Builds `?a=b&c=d`, skipping empty values and the "all" / page 1 defaults. */
export function buildQuery(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "" || value === "all") continue;
    if (key === "page" && Number(value) <= 1) continue;
    search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : "";
}

export function pageCount(total: number, pageSize = PAGE_SIZE): number {
  return Math.max(1, Math.ceil(total / pageSize));
}
