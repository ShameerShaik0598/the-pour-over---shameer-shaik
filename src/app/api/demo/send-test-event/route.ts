import { createHmac, randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { readSession, sessionCookieName } from "@/lib/session";
import { allowRateLimit } from "@/lib/rate-limit";
import { processAppWebhook } from "@/lib/webhook";
import { hasSameOrigin } from "@/lib/same-origin";

export async function POST(request: NextRequest) {
  if (!hasSameOrigin(request)) return NextResponse.json({ error: "invalid origin" }, { status: 403 });
  const session = await readSession(request.cookies.get(sessionCookieName)?.value);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!(await allowRateLimit(db, `demo-event:${session.username}`, 60, 20))) return NextResponse.json({ error: "rate limited" }, { status: 429 });
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "webhook unavailable" }, { status: 503 });
  const timestamp = String(Math.floor(Date.now() / 1000));
  const body = JSON.stringify({ event_id: `evt_demo_${randomUUID()}`, event: "read_story", user_id: null,
    device_id: `d_demo_${randomUUID()}`, timestamp: new Date(Number(timestamp) * 1000).toISOString(),
    properties: { story: "demo-story" } });
  const signature = createHmac("sha256", secret).update(timestamp).update(".").update(body).digest("hex");
  const simulatedRequest = new Request(new URL("/webhooks/app", request.url), { method: "POST", headers: {
    "content-type": "application/json", "x-tpo-timestamp": timestamp, "x-tpo-signature": `sha256=${signature}`,
    "x-forwarded-for": request.headers.get("x-forwarded-for") ?? "demo-local",
  }, body });
  const result = await processAppWebhook(simulatedRequest, db);
  if (!result.ok) return NextResponse.json({ error: "event could not be sent" }, { status: result.status });
  return NextResponse.json({ status: "sent" }, { status: 202 });
}
