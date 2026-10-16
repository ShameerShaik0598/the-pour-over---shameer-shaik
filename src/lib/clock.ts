export const TODAY = "2026-09-28" as const;
export const TODAY_DATE = new Date(`${TODAY}T00:00:00.000Z`);
export const TODAY_LABEL = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }).format(TODAY_DATE);

export function shiftDate(dateValue: string, days: number): string {
  const shifted = new Date(`${dateValue}T00:00:00.000Z`);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return shifted.toISOString().slice(0, 10);
}

export function last30DaysStartDate(): string { return shiftDate(TODAY, -30); }

export function previousMonthRange(): readonly [string, string] {
  const firstDay = new Date(`${TODAY.slice(0, 7)}-01T00:00:00.000Z`);
  firstDay.setUTCMonth(firstDay.getUTCMonth() - 1);
  const lastDay = new Date(`${TODAY.slice(0, 7)}-01T00:00:00.000Z`);
  lastDay.setUTCDate(0);
  return [firstDay.toISOString().slice(0, 10), lastDay.toISOString().slice(0, 10)];
}

export function daysBetween(start: string, end: string = TODAY): number {
  return Math.floor((Date.parse(`${end}T00:00:00.000Z`) - Date.parse(`${start}T00:00:00.000Z`)) / 86_400_000);
}
