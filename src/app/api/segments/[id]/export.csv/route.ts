import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { segments } from "@/lib/db/schema";
import { readSession, sessionCookieName } from "@/lib/session";
import { getSegmentRows } from "@/lib/segments/filter";
import { FilterSchema } from "@/lib/segments/schema";
import { segmentCsv } from "@/lib/segments/csv";

const idSchema = z.string().uuid();

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await readSession(request.cookies.get(sessionCookieName)?.value);
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });
  const parsedId = idSchema.safeParse((await context.params).id);
  if (!parsedId.success) return Response.json({ error: "segment not found" }, { status: 404 });
  const [segment] = await db.select().from(segments).where(eq(segments.id, parsedId.data)).limit(1);
  if (!segment) return Response.json({ error: "segment not found" }, { status: 404 });
  const filter = FilterSchema.safeParse(segment.filter);
  if (!filter.success) return Response.json({ error: "saved segment is invalid" }, { status: 400 });
  const rows = await getSegmentRows(db, filter.data, "signup_desc");
  if (session.role === "viewer" && rows.length > 5000) return Response.json({ error: "viewer export is limited to 5000 rows" }, { status: 403 });
  return new Response(segmentCsv(rows), { headers: { "content-type": "text/csv; charset=utf-8",
    "content-disposition": `attachment; filename="carafe-segment-${segment.id}.csv"`, "x-content-type-options": "nosniff" } });
}
