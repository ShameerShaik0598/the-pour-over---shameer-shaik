export const TODAY = "2026-09-28" as const;
export const TODAY_DATE = new Date(`${TODAY}T00:00:00.000Z`);

export function daysBetween(start: string, end: string = TODAY): number {
  return Math.floor((Date.parse(`${end}T00:00:00.000Z`) - Date.parse(`${start}T00:00:00.000Z`)) / 86_400_000);
}
