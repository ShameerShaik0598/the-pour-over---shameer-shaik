import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { hasSameOrigin } from "@/lib/same-origin";
import { readSession, sessionCookieName } from "@/lib/session";
import { assistantSessionKey, AssistantOutputError, runAssistant } from "@/lib/ai/service";
import { GeminiClient } from "@/lib/ai/gemini";
import { allowRateLimit } from "@/lib/rate-limit";

const payloadSchema = z.object({ message: z.string().min(1).max(500) }).strict();

function dailyLimit(): number {
  const value = Number(process.env.ASSISTANT_DAILY_LIMIT ?? 20);
  return Number.isSafeInteger(value) && value > 0 ? Math.min(value, 1000) : 20;
}

export async function POST(request: NextRequest) {
  if (!hasSameOrigin(request)) return NextResponse.json({ error: "invalid origin" }, { status: 403 });
  const token = request.cookies.get(sessionCookieName)?.value;
  const session = await readSession(token);
  if (!session || !token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = payloadSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "message must be between 1 and 500 characters" }, { status: 400 });
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0] ?? request.headers.get("x-real-ip") ?? "unknown";
  const ipHash = createHash("sha256").update(forwarded).digest("hex");
  const sessionHash = assistantSessionKey(token);
  const maximum = dailyLimit();
  if (!(await allowRateLimit(db, `assistant:session:${sessionHash}`, 86_400, maximum)) || !(await allowRateLimit(db, `assistant:ip:${ipHash}`, 86_400, maximum))) {
    return NextResponse.json({ error: "daily assistant limit reached" }, { status: 429 });
  }
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL;
  const client = apiKey && model ? new GeminiClient(apiKey, model) : undefined;
  try {
    const result = await runAssistant({ message: parsed.data.message, sessionKey: sessionHash, client, database: db });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AssistantOutputError) return NextResponse.json({ error: "The model returned an unsafe or invalid plan." }, { status: 502 });
    if (error instanceof Error && error.message.startsWith("message must")) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ error: "assistant unavailable" }, { status: 500 });
  }
}
