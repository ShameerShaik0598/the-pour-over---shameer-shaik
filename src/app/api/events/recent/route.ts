import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { recentEvents } from "@/lib/profile";

const sinceSchema = z.string().datetime({ offset: true }).optional();

export async function GET(request: NextRequest) {
  const parsed = sinceSchema.safeParse(request.nextUrl.searchParams.get("since") ?? undefined);
  if (!parsed.success) return NextResponse.json({ error: "invalid since timestamp" }, { status: 400 });
  return NextResponse.json(await recentEvents(db, parsed.data ? new Date(parsed.data) : null));
}
