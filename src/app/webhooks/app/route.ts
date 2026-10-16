import { processAppWebhook } from "@/lib/webhook";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return processAppWebhook(request);
}
