export const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE_PATTERN = /(?<!\w)\+?\d[\d().\s-]{6,}\d(?!\w)/g;
const IDENTIFIER_PATTERN = /\b(?:u_|d_|v_|evt_)[a-z0-9_-]+\b/gi;
const UUID_PATTERN = /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi;

export function redactAssistantMessage(message: string): string {
  return message.replace(EMAIL_PATTERN, "[redacted]")
    .replace(PHONE_PATTERN, (match) => match.replace(/\D/g, "").length >= 9 ? "[redacted]" : match)
    .replace(IDENTIFIER_PATTERN, "[redacted]")
    .replace(UUID_PATTERN, "[redacted]");
}
