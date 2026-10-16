import { count, desc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { segments } from "@/lib/db/schema";
import { FilterSchema } from "@/lib/segments/schema";
import { hasSameOrigin } from "@/lib/same-origin";
import { readSession, sessionCookieName } from "@/lib/session";

const saveSchema = z.object({ name: z.string().trim().min(1).max(80), filter: FilterSchema }).strict();

export async function GET(request: NextRequest) {
  const session = await readSession(request.cookies.get(sessionCookieName)?.value);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const saved = await db.select().from(segments).orderBy(desc(segments.createdAt));
  return NextResponse.json({ segments: saved });
}

export async function POST(request: NextRequest) {
  if (!hasSameOrigin(request)) return NextResponse.json({ error: "invalid origin" }, { status: 403 });
  const session = await readSession(request.cookies.get(sessionCookieName)?.value);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = saveSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid segment" }, { status: 400 });
  if (session.role === "viewer") {
    const [result] = await db.select({ total: count() }).from(segments).where(eq(segments.createdBy, session.username));
    if ((result?.total ?? 0) >= 10) return NextResponse.json({ error: "viewer saved-segment limit reached" }, { status: 403 });
  }
  const [saved] = await db.insert(segments).values({ name: parsed.data.name, filter: parsed.data.filter, createdBy: session.username }).returning();
  return NextResponse.json({ segment: saved }, { status: 201 });
}
