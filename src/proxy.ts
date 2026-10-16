import { NextRequest, NextResponse } from "next/server";
import { readSession, sessionCookieName } from "@/lib/session";

const PUBLIC_PATHS = new Set(["/", "/login", "/api/auth/login", "/api/auth/logout", "/api/health", "/webhooks/app"]);

export async function proxy(request: NextRequest) {
  if (PUBLIC_PATHS.has(request.nextUrl.pathname)) return NextResponse.next();
  const session = await readSession(request.cookies.get(sessionCookieName)?.value);
  if (!session) {
    if (request.nextUrl.pathname.startsWith("/api/")) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
