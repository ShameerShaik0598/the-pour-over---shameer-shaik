import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { searchProfiles } from "@/lib/profile";

const searchSchema = z.object({ query: z.string().min(3).max(200) }).strict();

export async function POST(request: NextRequest) {
  const input = searchSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) return NextResponse.json({ error: "Enter an email fragment or reader ID." }, { status: 400 });
  return NextResponse.json({ results: await searchProfiles(db, input.data.query) });
}
