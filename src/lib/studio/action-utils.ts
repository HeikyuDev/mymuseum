import "server-only";
import { revalidatePath } from "next/cache";
import { requireMuseum } from "@/lib/auth/session";
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
  const own = paths.filter((p): p is string => !!p && p.startsWith(`${museumId}/`) && !p.includes(".."));
  if (own.length === 0) return;
  const { error } = await supabase.storage.from("artworks").remove(own);
  if (error) console.error("[studio] storage cleanup failed", error.message);
}

export function revalidateMuseum(slug: string, ...extraSlugs: string[]) {
  revalidatePath("/studio", "layout");
  for (const value of [slug, ...extraSlugs]) revalidatePath(`/m/${value}`);
}
