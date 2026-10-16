import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { eraseProfile } from "@/lib/erase-profile";
import { hasSameOrigin } from "@/lib/same-origin";
import { getProfile } from "@/lib/profile";
import { readSession, sessionCookieName } from "@/lib/session";

const paramsSchema = z.object({
  type: z.enum(["subscriber", "app", "visitor"]),
  id: z.string().regex(/^(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|[0-9a-f]{64})$/i),
});

export async function GET(_request: Request, context: { params: Promise<{ type: string; id: string }> }) {
  const params = paramsSchema.safeParse(await context.params);
  if (!params.success) return NextResponse.json({ error: "profile not found" }, { status: 404 });
  const profile = await getProfile(db, params.data.type, params.data.id);
  return profile ? NextResponse.json(profile) : NextResponse.json({ error: "profile not found" }, { status: 404 });
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ type: string; id: string }> }) {
  if (!hasSameOrigin(request)) return NextResponse.json({ error: "invalid origin" }, { status: 403 });
  const session = await readSession(request.cookies.get(sessionCookieName)?.value);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (session.role !== "admin") return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const params = paramsSchema.safeParse(await context.params);
  if (!params.success) return NextResponse.json({ error: "invalid profile" }, { status: 400 });
  const erased = await eraseProfile(db, params.data.type, params.data.id);
  if (!erased) return NextResponse.json({ error: "profile not found" }, { status: 404 });
  return NextResponse.json({ erased: true });
}
