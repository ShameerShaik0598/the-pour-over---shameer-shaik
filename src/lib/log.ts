const EMAIL_LIKE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;

function safeText(value: string): string {
  return value.replace(EMAIL_LIKE, "[redacted]");
}

/** Log only caller-selected metadata; request bodies and arbitrary objects are intentionally unsupported. */
export function logSecurityEvent(message: string, outcome: string): void {
  console.info("[carafe]", safeText(message), safeText(outcome));
}
