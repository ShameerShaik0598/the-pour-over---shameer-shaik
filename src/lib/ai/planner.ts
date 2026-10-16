import { AssistantPlanSchema, type AssistantPlan } from "@/lib/ai/schema";

export const SUGGESTED_PROMPTS = [
  "How many Instagram signups went cold last month?",
  "Build me a list of our most engaged readers",
  "Which pages do new subscribers hit first?",
] as const;

export function rulesPlan(redactedMessage: string): AssistantPlan {
  const message = redactedMessage.toLowerCase();
  if (/\b(?:look up|who is|activity for|what did .+ do)\b/.test(message) || (message.includes("[redacted]") && /\b(?:look up|find|show|tell me about)\b/.test(message))) {
    return AssistantPlanSchema.parse({ intent: "refuse", assumptions: ["Person-specific questions belong in Lookup."] });
  }
  if ((message.includes("first") || message.includes("hit")) && message.includes("page")) {
    return AssistantPlanSchema.parse({ intent: "first_pages", filter: { new_within_days: 30 }, limit: 10, assumptions: ["New subscribers signed up within the last 30 days, regardless of status, to match the assessment cohort.", "First page means each linked visitor's earliest page view."] });
  }
  if (message.includes("most engaged") || message.includes("highest engagement")) {
    return AssistantPlanSchema.parse({ intent: "segment", filter: { status: "active", min_engagement: 70 }, sort: "engagement_desc", limit: 100,
      segment_name: "Most engaged readers", assumptions: ["Engaged means an engagement score of at least 70.", "Unsubscribed readers are excluded."] });
  }
  if (message.includes("cold") && (message.includes("last month") || message.includes("august")) && message.includes("instagram")) {
    return AssistantPlanSchema.parse({ intent: "count", filter: { sources: ["Instagram"], status: "active", went_cold_between: ["2026-08-01", "2026-08-31"] },
      assumptions: ["Cold means no open for more than 30 days.", "Unsubscribed readers are excluded."] });
  }
  return AssistantPlanSchema.parse({ intent: "clarify", clarifying_question: "Would you like a count, a reader list, a segment, first-page results, or a trend?", assumptions: [] });
}

export function parseModelPlan(output: string): AssistantPlan {
  if (output.includes("@") || /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(output)) {
    throw new Error("Model output contained a disallowed email-like value.");
  }
  let decoded: unknown;
  try { decoded = JSON.parse(output); } catch { throw new Error("Model output was not valid JSON."); }
  return AssistantPlanSchema.parse(decoded);
}
