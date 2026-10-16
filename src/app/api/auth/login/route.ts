import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSession, sessionCookieName, verifyScryptPassword } from "@/lib/auth";
import { allowLoginAttempt } from "@/lib/rate-limit";
import { hasSameOrigin } from "@/lib/same-origin";

const LoginPayload = z.object({ username: z.string().min(1).max(100), password: z.string().min(1).max(200) }).strict();

export async function POST(request: NextRequest) {
  if (!hasSameOrigin(request)) return NextResponse.json({ error: "invalid origin" }, { status: 403 });
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!await allowLoginAttempt(`login:${ip}`)) return NextResponse.json({ error: "too many attempts" }, { status: 429 });
  const parsed = LoginPayload.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid credentials" }, { status: 401 });
  const { username, password } = parsed.data;
  const adminOk = username === process.env.ADMIN_USERNAME && await verifyScryptPassword(password, process.env.ADMIN_PASSWORD_HASH);
  const viewerOk = username === process.env.DEMO_USERNAME && password === process.env.DEMO_PASSWORD;
  if (!adminOk && !viewerOk) return NextResponse.json({ error: "invalid credentials" }, { status: 401 });
  const token = await createSession({ username, role: adminOk ? "admin" : "viewer" });
  const response = NextResponse.json({ ok: true });
  response.cookies.set(sessionCookieName, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 8 * 60 * 60 });
  return response;
}
