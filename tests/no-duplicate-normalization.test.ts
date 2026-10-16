import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const fullPath = path.join(directory, name);
    return statSync(fullPath).isDirectory() ? sourceFiles(fullPath) : /\.tsx?$/.test(name) ? [fullPath] : [];
  });
}

describe("email normalization has one source", () => {
  it("keeps NFKC, trimming, and lowercasing inside src/lib/email.ts", () => {
    const files = sourceFiles(path.join(process.cwd(), "src"));
    const normalizerImplementations = files.filter((file) => /\.normalize\(["']NFKC["']\)/.test(readFileSync(file, "utf8")));
    expect(normalizerImplementations.map((file) => path.relative(process.cwd(), file).replaceAll("\\", "/"))).toEqual(["src/lib/email.ts"]);
    const normalizerDefinitions = files.flatMap((file) => [...readFileSync(file, "utf8").matchAll(/function\s+normalizeEmail\s*\(/g)].map(() => file));
    expect(normalizerDefinitions.map((file) => path.relative(process.cwd(), file).replaceAll("\\", "/"))).toEqual(["src/lib/email.ts"]);
    const directEmailMutations = files.filter((file) => file.endsWith("email.ts") ? false : /\b(?:email|emailRaw|normalizedEmail)\b[^\n;]*\.(?:trim|toLowerCase)\(/.test(readFileSync(file, "utf8")));
    expect(directEmailMutations).toEqual([]);
  });
});
