export function csvCell(value: string | number | boolean | null): string {
  let safe = value === null ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(safe)) safe = `'${safe}`;
  return `"${safe.replaceAll('"', '""')}"`;
}

export function segmentCsv(rows: Array<{ email: string; source: string; status: string; signupDate: string; lastOpenDate: string | null; coldBucket: string; engagementScore: number }>): string {
  const columns = ["email", "source", "status", "signup_date", "last_open_date", "cold_bucket", "engagement_score"];
  const values = rows.map((row) => [row.email, row.source, row.status, row.signupDate, row.lastOpenDate, row.coldBucket, row.engagementScore]);
  return [columns, ...values].map((line) => line.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
