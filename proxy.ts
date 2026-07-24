import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const publicPaths = [
  "/auth/login",
  "/auth/signup",
  "/auth/forgot-password",
  "/auth/callback",
];

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  const pathname = request.nextUrl.pathname;
  const isPublic = publicPaths.some(path => pathname.startsWith(path));
  const isPasswordUpdate = pathname.startsWith("/auth/update-password");
  const isApiRoute = pathname.startsWith("/api/");

  if (!userId && !isPublic && !isApiRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (userId && (pathname === "/auth/login" || pathname === "/auth/signup")) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (!userId && isPasswordUpdate) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    url.searchParams.set("message", "Open the password-reset link from your email first.");
    return NextResponse.redirect(url);
  }

  return response;
}
