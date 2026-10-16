import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { logSecurityEvent } from "@/lib/log";

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const fullPath = path.join(directory, name);
    return statSync(fullPath).isDirectory() ? sourceFiles(fullPath) : /\.(?:ts|tsx|js|jsx)$/.test(name) ? [fullPath] : [];
  });
}

describe("assistant and logging boundaries", () => {
  afterEach(() => vi.restoreAllMocks());

  it("keeps LLM client imports inside src/lib/ai", () => {
    const files = sourceFiles(path.join(process.cwd(), "src"));
    const violations = files.filter((file) => !file.replaceAll("\\", "/").includes("/src/lib/ai/") && /(?:from\s*|import\s*\()\s*["'](?:@google\/genai|@google\/generative-ai|openai|@openai\/)[^"']*["']/.test(readFileSync(file, "utf8")));
    expect(violations).toEqual([]);
  });

  it("keeps console.log out of every source file except the logger", () => {
    const files = sourceFiles(path.join(process.cwd(), "src"));
    const violations = files.filter((file) => !file.replaceAll("\\", "/").endsWith("/src/lib/log.ts") && /console\.log\s*\(/.test(readFileSync(file, "utf8")));
    expect(violations).toEqual([]);
  });

  it("redacts email-like strings in the shared logger", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    logSecurityEvent("user ana@example.com blocked", "bad_signature");
    expect(info).toHaveBeenCalledWith("[carafe]", "user [redacted] blocked", "bad_signature");
  });
});
