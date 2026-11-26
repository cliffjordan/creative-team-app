import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth/session";

const PROTECTED_PREFIXES = ["/events", "/cue-cards", "/profile", "/superadmin"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api/")) {
    const method = request.method.toUpperCase();
    if (method === "POST" || method === "PATCH" || method === "PUT" || method === "DELETE") {
      const origin = request.headers.get("origin");
      if (origin && origin !== request.nextUrl.origin) {
        return NextResponse.json(
          { success: false, error: "Forbidden: Cross-origin request tidak diizinkan." },
          { status: 403 }
        );
      }
    }
    return NextResponse.next();
  }

  if (pathname === "/superadmin/login") {
    const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
    const session = await verifySessionToken(token);
    if (session?.isSuperadmin) {
      return NextResponse.redirect(new URL("/superadmin", request.url));
    }
    return NextResponse.next();
  }

  const isProtected = PROTECTED_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix)
  );

  if (!isProtected) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = await verifySessionToken(token);

  if (!session) {
    if (pathname.startsWith("/superadmin")) {
      return NextResponse.redirect(new URL("/superadmin/login", request.url));
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname.startsWith("/superadmin") && !session.isSuperadmin) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/events/:path*", "/cue-cards/:path*", "/profile/:path*", "/superadmin/:path*", "/api/:path*"],
};
