import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isProtectedPath, loginPathFor } from "@/lib/auth/redirects";

// 1. Refreshes the Supabase session cookie on every request.
// 2. Sends anonymous visitors of /admin/** and /studio/** to /login?next=...
// This is only a first line of defence: the layouts, every data access function
// and every server action verify the user and the role again on the server.
// (The proxy cannot know the role without a database round trip, so wrong-role
// redirects, for example a client opening /admin, are decided server-side.)
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Validates the token against Supabase Auth and triggers a refresh when needed.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname, search } = request.nextUrl;
  if (!user && isProtectedPath(pathname)) {
    const redirect = NextResponse.redirect(new URL(loginPathFor(pathname, search), request.url));
    // Keep any cookies the refresh just cleared or rotated.
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico)$).*)",
  ],
};
