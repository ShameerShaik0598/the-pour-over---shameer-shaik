import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { searchProfiles, searchSubscriberById } from "@/lib/profile";

const searchSchema = z.union([
  z.object({ query: z.string().min(3).max(200) }).strict(),
  z.object({ sampleId: z.string().uuid() }).strict(),
]);

export async function POST(request: NextRequest) {
  const input = searchSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) return NextResponse.json({ error: "Enter an email fragment or reader ID." }, { status: 400 });
  const results = "sampleId" in input.data
    ? await searchSubscriberById(db, input.data.sampleId)
    : await searchProfiles(db, input.data.query);
  return NextResponse.json({ results });
}
