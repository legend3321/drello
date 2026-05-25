import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { AUTH_COOKIE } from "@/lib/auth-constants";

const PUBLIC_PATHS = ["/login", "/register"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((path) => pathname.startsWith(path)) || pathname.startsWith("/api");
  const isAuthenticated = request.cookies.get(AUTH_COOKIE)?.value === "1";

  if (!isAuthenticated && !isPublic) {
    const loginUrl = new URL("/login", request.url);
    if (pathname !== "/") {
      loginUrl.searchParams.set("next", pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();

}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
