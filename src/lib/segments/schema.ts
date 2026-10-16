import { z } from "zod";
import { SOURCES } from "@/lib/sources";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, "Expected a valid YYYY-MM-DD date");

export const FilterSchema = z.object({
  sources: z.array(z.enum(SOURCES)).optional(),
  status: z.enum(["active", "unsubscribed", "any"]).default("active"),
  signup_between: z.tuple([isoDate, isoDate]).optional(),
  cold: z.enum(["lapsed", "never_opened", "any_cold", "warm", "new_unopened"]).optional(),
  went_cold_between: z.tuple([isoDate, isoDate]).optional(),
  last_open_within_days: z.number().int().min(0).max(3650).optional(),
  has_app: z.boolean().optional(),
  has_web_activity: z.boolean().optional(),
  min_engagement: z.number().int().min(0).max(100).optional(),
  new_within_days: z.number().int().min(0).max(3650).optional(),
}).strict().superRefine((filter, context) => {
  for (const range of [filter.signup_between, filter.went_cold_between]) {
    if (range && range[0] > range[1]) context.addIssue({ code: "custom", message: "Date range start must not follow its end" });
  }
});

export type SegmentFilter = z.output<typeof FilterSchema>;
