import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

export async function GET() {
  await db.select({ one: sql<number>`1` });
  return NextResponse.json({ ok: true });
}
