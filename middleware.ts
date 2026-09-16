import { NextRequest, NextResponse } from "next/server";
import { decodeSession } from "@/lib/session-token";

const PUBLIC = ["/login", "/api/auth/login", "/portal"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }
  const user = decodeSession(req.cookies.get("dgz_session")?.value);
  if (!user) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  if (pathname.startsWith("/hr") && user.role !== "hr") {
    return NextResponse.redirect(new URL("/workspace", req.url));
  }
  if (pathname.startsWith("/workspace") && user.role !== "employee") {
    return NextResponse.redirect(new URL("/hr", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/hr/:path*", "/workspace/:path*", "/portal/:path*"],
};
