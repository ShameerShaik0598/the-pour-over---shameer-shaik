export const SOURCES = ["Instagram", "Facebook", "X", "Google", "Referral", "Podcast", "Direct"] as const;
export type Source = (typeof SOURCES)[number];

export function normalizeSource(value: string | null | undefined): Source | null {
  if (!value?.trim()) return null;
  const canonical = SOURCES.find((source) => source.toLowerCase() === value.trim().toLowerCase());
  if (canonical) return canonical;
  if (value.trim().toLowerCase() === "twitter") return "X";
  return null;
}
