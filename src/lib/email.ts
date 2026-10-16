const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/;

export function normalizeEmail(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.normalize("NFKC").trim().toLowerCase();
  return EMAIL_PATTERN.test(normalized) ? normalized : null;
}
