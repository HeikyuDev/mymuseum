import "server-only";
import { revalidateTag } from "next/cache";

/** Cache tag of a published museum's viewer data. */
export const museumCacheTag = (slug: string) => `museum:${slug}`;

/** Drops the cached viewer data right away (the next visit refetches; no stale page is served). */
export function revalidateMuseumData(...slugs: string[]) {
  for (const slug of slugs) revalidateTag(museumCacheTag(slug), { expire: 0 });
}
