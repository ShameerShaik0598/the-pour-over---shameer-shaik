import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getProfile } from "@/lib/profile";

const paramsSchema = z.object({ type: z.enum(["subscriber", "app", "visitor"]), id: z.string().regex(/^(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|[a-f0-9]{64})$/i) }).strict();

export async function GET(_request: Request, context: { params: Promise<{ type: string; id: string }> }) {
  const parsed = paramsSchema.safeParse(await context.params);
  if (!parsed.success) return NextResponse.json({ error: "profile not found" }, { status: 404 });
  const profile = await getProfile(db, parsed.data.type, parsed.data.id);
  return profile ? NextResponse.json(profile) : NextResponse.json({ error: "profile not found" }, { status: 404 });
}
