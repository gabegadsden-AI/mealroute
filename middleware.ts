import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refreshes the Supabase auth session on every request.
 * Without this, users get silently logged out when their
 * initial session token expires (typically within hours).
 */
export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll().map(({ name, value }) => ({ name, value }));
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            supabaseResponse.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  // Calling getUser() refreshes the session token if it's near expiry.
  // The refreshed cookies are written to supabaseResponse automatically.
  await supabase.auth.getUser();

  return supabaseResponse;
}

/**
 * Run middleware on all routes except static assets and API routes.
 * API routes handle their own auth via lib/supabase/server.ts.
 */
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|robots\\.txt|sitemap\\.xml|manifest\\.json|android-chrome|apple-touch|mstile|favicon|browserconfig|site\\.webmanifest)).*)",
  ],
};
