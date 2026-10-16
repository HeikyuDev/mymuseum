import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Disabled accounts are redirected here from server components, which cannot
// write cookies. A route handler can, so the session is cleared and the user
// lands on the login page with an explanation.
export async function GET(request: Request) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/login?error=disabled", request.url));
}
