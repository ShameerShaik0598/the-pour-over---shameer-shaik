import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { previewSegment } from "@/lib/segments/filter";
import { FilterSchema } from "@/lib/segments/schema";

const previewSchema = z.object({ filter: FilterSchema, page: z.number().int().min(1).max(1000).default(1),
  sort: z.enum(["engagement_desc", "signup_desc", "signup_asc", "email_asc"]).default("signup_desc") }).strict();

export async function POST(request: NextRequest) {
  const parsed = previewSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid segment filter" }, { status: 400 });
  const result = await previewSegment(db, parsed.data.filter, parsed.data.page, parsed.data.sort);
  return NextResponse.json({ count: result.count, page: result.page, pageSize: result.pageSize, rows: result.rows.map((row) => ({ id: row.id,
    email: row.email, source: row.source, status: row.status, signupDate: row.signupDate, lastOpenDate: row.lastOpenDate,
    coldBucket: row.coldBucket, engagementScore: row.engagementScore, hasApp: row.hasApp, webVisitCount30: row.webVisitCount30 })) });
}
