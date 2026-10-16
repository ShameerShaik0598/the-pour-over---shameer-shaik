import { createHash } from "node:crypto";
import { z } from "zod";
import { db, type AppDatabase } from "@/lib/db";
import { assistantAudit } from "@/lib/db/schema";
import type { LlmClient } from "@/lib/ai/client";
import { buildModelRequest } from "@/lib/ai/request";
import { executePlan, type AssistantAnswer } from "@/lib/ai/execute";
import { parseModelPlan, rulesPlan, SUGGESTED_PROMPTS } from "@/lib/ai/planner";
import type { AssistantPlan } from "@/lib/ai/schema";
import { redactAssistantMessage } from "@/lib/ai/redact";

const inputSchema = z.string().min(1).max(500).refine((value) => value.trim().length > 0);
const suggestedPlanCache = new Map<string, AssistantPlan>();

export class AssistantOutputError extends Error {
  constructor() { super("The assistant could not safely use the model response."); }
}

export type AssistantRunResult = AssistantAnswer & {
  plan: AssistantPlan;
  redactedMessage: string;
  modelWasCalled: boolean;
  provider: "gemini" | "rules" | "rules_fallback" | "suggested_cache";
  assumptions: string[];
};

export async function runAssistant(input: { message: unknown; sessionKey: string; client?: LlmClient; database?: AppDatabase }): Promise<AssistantRunResult> {
  const parsed = inputSchema.safeParse(input.message);
  if (!parsed.success) throw new Error("message must be between 1 and 500 characters");
  const originalMessage = parsed.data;
  const redactedMessage = redactAssistantMessage(originalMessage);
  const database = input.database ?? db;
  const cacheKey = SUGGESTED_PROMPTS.find((prompt) => prompt === originalMessage);
  let plan: AssistantPlan | null = null;
  let provider: AssistantRunResult["provider"] | null = null;
  let modelWasCalled = false;

  const cached = cacheKey ? suggestedPlanCache.get(cacheKey) : undefined;
  if (cached) {
    plan = cached;
    provider = "suggested_cache";
  } else if (!input.client) {
    plan = rulesPlan(redactedMessage);
    provider = "rules";
  } else {
    let modelOutput: string | null = null;
    try {
      modelOutput = await input.client.generate(buildModelRequest(redactedMessage));
    } catch {
      plan = rulesPlan(redactedMessage);
      provider = "rules_fallback";
    }
    if (modelOutput !== null) {
      modelWasCalled = true;
      try {
        plan = parseModelPlan(modelOutput);
      } catch {
        await database.insert(assistantAudit).values({ sessionId: input.sessionKey, sentPrompt: redactedMessage, plan: null, outcome: "rejected_output", provider: "gemini" });
        throw new AssistantOutputError();
      }
      provider = "gemini";
      if (cacheKey) suggestedPlanCache.set(cacheKey, plan);
    }
  }
  if (!plan || !provider) throw new Error("assistant plan unavailable");
  const answer = await executePlan(database, plan);
  const assumptions = plan.assumptions ?? [];
  await database.insert(assistantAudit).values({ sessionId: input.sessionKey, sentPrompt: redactedMessage, plan, outcome: "answered", provider });
  return { ...answer, plan, redactedMessage, modelWasCalled, provider, assumptions };
}

export function assistantSessionKey(sessionToken: string): string {
  return createHash("sha256").update(sessionToken).digest("hex");
}

export function clearSuggestedPlanCache(): void {
  suggestedPlanCache.clear();
}
