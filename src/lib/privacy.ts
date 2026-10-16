export function maskEmail(email: string | null): string {
  if (!email) return "App-only reader";
  const at = email.indexOf("@");
  if (at <= 0) return "•••";
  return `${email[0]}•••${email.slice(at)}`;
}
