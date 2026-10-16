import { NextRequest, NextResponse } from "next/server";
import { hasSameOrigin } from "@/lib/same-origin";
import { sessionCookieName } from "@/lib/auth";

export async function POST(request: NextRequest) {
  if (!hasSameOrigin(request)) return NextResponse.json({ error: "invalid origin" }, { status: 403 });
  const response = NextResponse.json({ ok: true });
  response.cookies.set(sessionCookieName, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
  return response;
}
