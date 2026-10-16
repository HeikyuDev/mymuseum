import "server-only";
import { revalidatePath } from "next/cache";
import { requireMuseum } from "@/lib/auth/session";
import { thumbPathFor } from "@/lib/images";
import { revalidateMuseumData } from "@/lib/museum-cache";
import { createClient } from "@/lib/supabase/server";

/** Every studio mutation starts here: verified user + the museum they own. */
export async function getMuseumActionContext() {
  const auth = await requireMuseum();
  const supabase = await createClient();
  return { ...auth, supabase };
}

/** Deletes Storage objects, restricted to the museum's own folder (RLS also enforces this). */
export async function removeStoredFiles(
  supabase: Awaited<ReturnType<typeof createClient>>,
  museumId: string,
  paths: (string | null | undefined)[],
) {
  // Every original may have a thumbnail next to it (see thumbPathFor); removing a missing object is harmless.
  const withThumbs = paths.flatMap((p) => (p ? [p, thumbPathFor(p)] : []));
  const own = withThumbs.filter((p): p is string => !!p && p.startsWith(`${museumId}/`) && !p.includes(".."));
  if (own.length === 0) return;
  const { error } = await supabase.storage.from("artworks").remove(own);
  if (error) console.error("[studio] storage cleanup failed", error.message);
}

export function revalidateMuseum(slug: string, ...extraSlugs: string[]) {
  revalidatePath("/studio", "layout");
  revalidateMuseumData(slug, ...extraSlugs);
  for (const value of [slug, ...extraSlugs]) revalidatePath(`/m/${value}`);
}
