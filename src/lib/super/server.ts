import "server-only";
import { requireRole } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// Every super-admin query and mutation starts here: the session is verified
// with getUser() and the role is read from public.profiles (never from user
// metadata or the proxy). Non-super-admins are redirected.
export async function getSuperContext() {
  const { userId } = await requireRole("super_admin");
  // Reads and plain row updates use the caller's own session, so RLS
  // (is_super_admin()) stays in force. The service role is used only for
  // auth.admin.* calls and Storage cleanup, via getAdminClient().
  const supabase = await createClient();
  return { actorId: userId, supabase };
}

/** Service-role client, or null when the key is not configured on this server. */
export function getAdminClient() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  return createAdminClient();
}

export const MISSING_SERVICE_ROLE = "The server is missing SUPABASE_SERVICE_ROLE_KEY, so accounts cannot be managed.";
