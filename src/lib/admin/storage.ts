import "server-only";
import { ARTWORKS_BUCKET } from "@/lib/supabase/storage";
import type { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

const LIST_PAGE = 100;
const MAX_DEPTH = 3;

/** Lists every object path under `prefix` (objects live at `{museum_id}/{file}`). */
async function listObjectPaths(admin: AdminClient, prefix: string, depth = 0): Promise<string[]> {
  const paths: string[] = [];
  for (let offset = 0; ; offset += LIST_PAGE) {
    const { data, error } = await admin.storage.from(ARTWORKS_BUCKET).list(prefix, { limit: LIST_PAGE, offset });
    if (error) throw new Error(error.message);
    for (const entry of data ?? []) {
      const path = `${prefix}/${entry.name}`;
      // Folders have no id; recurse a little in case nested paths ever exist.
      if (entry.id === null && depth < MAX_DEPTH) paths.push(...(await listObjectPaths(admin, path, depth + 1)));
      else if (entry.id !== null) paths.push(path);
    }
    if (!data || data.length < LIST_PAGE) break;
  }
  return paths;
}

/**
 * Removes every Storage object stored under the given museum folders.
 * Returns how many objects could not be removed (0 on full success).
 */
export async function purgeMuseumFolders(admin: AdminClient, museumIds: string[]): Promise<number> {
  let failed = 0;
  for (const museumId of museumIds) {
    try {
      const paths = await listObjectPaths(admin, museumId);
      for (let i = 0; i < paths.length; i += LIST_PAGE) {
        const chunk = paths.slice(i, i + LIST_PAGE);
        const { error } = await admin.storage.from(ARTWORKS_BUCKET).remove(chunk);
        if (error) {
          console.error("[admin] storage cleanup failed", error.message);
          failed += chunk.length;
        }
      }
    } catch (error) {
      console.error("[admin] storage listing failed", error instanceof Error ? error.message : "unknown");
      failed += 1;
    }
  }
  return failed;
}
