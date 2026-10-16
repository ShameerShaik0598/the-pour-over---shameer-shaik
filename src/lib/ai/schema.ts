import { z } from "zod";
import { SOURCES } from "@/lib/sources";

const planFilterSchema = z.object({
  sources: z.array(z.enum(SOURCES)).optional(),
  status: z.enum(["active", "unsubscribed", "any"]).optional(),
  signup_between: z.tuple([z.string(), z.string()]).optional(),
  cold: z.enum(["lapsed", "never_opened", "any_cold", "warm", "new_unopened"]).optional(),
  went_cold_between: z.tuple([z.string(), z.string()]).optional(),
  last_open_within_days: z.number().int().min(0).max(3650).optional(),
  has_app: z.boolean().optional(), has_web_activity: z.boolean().optional(),
  min_engagement: z.number().int().min(0).max(100).optional(), new_within_days: z.number().int().min(0).max(3650).optional(),
}).strict();

export const AssistantPlanSchema = z.object({
  intent: z.enum(["count", "list", "segment", "first_pages", "trend", "clarify", "refuse"]),
  filter: planFilterSchema.optional(),
  group_by: z.enum(["source", "status", "cold_bucket", "signup_week"]).optional(),
  sort: z.enum(["engagement_desc", "signup_desc"]).optional(),
  limit: z.number().int().min(1).max(100).optional(),
  segment_name: z.string().min(1).max(100).optional(),
  clarifying_question: z.string().min(1).max(300).optional(),
  assumptions: z.array(z.string().max(200)).max(8).optional(),
}).strict();

export type AssistantPlan = z.output<typeof AssistantPlanSchema>;

export const PLAN_JSON_SCHEMA = {
  type: "object",
  properties: {
    intent: { type: "string", enum: ["count", "list", "segment", "first_pages", "trend", "clarify", "refuse"] },
    filter: { type: "object", additionalProperties: false, properties: {
      sources: { type: "array", items: { type: "string", enum: ["Instagram", "Facebook", "X", "Google", "Referral", "Podcast", "Direct"] } },
      status: { type: "string", enum: ["active", "unsubscribed", "any"] },
      signup_between: { type: "array", minItems: 2, maxItems: 2, items: { type: "string", format: "date" } },
      cold: { type: "string", enum: ["lapsed", "never_opened", "any_cold", "warm", "new_unopened"] },
      went_cold_between: { type: "array", minItems: 2, maxItems: 2, items: { type: "string", format: "date" } },
      last_open_within_days: { type: "integer", minimum: 0, maximum: 3650 },
      has_app: { type: "boolean" }, has_web_activity: { type: "boolean" },
      min_engagement: { type: "integer", minimum: 0, maximum: 100 }, new_within_days: { type: "integer", minimum: 0, maximum: 3650 },
    } },
    group_by: { type: "string", enum: ["source", "status", "cold_bucket", "signup_week"] },
    sort: { type: "string", enum: ["engagement_desc", "signup_desc"] }, limit: { type: "integer", minimum: 1, maximum: 100 },
    segment_name: { type: "string" }, clarifying_question: { type: "string" }, assumptions: { type: "array", items: { type: "string" } },
  }, required: ["intent"], additionalProperties: false,
} as const;
