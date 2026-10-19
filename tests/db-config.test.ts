import { describe, expect, it } from "vitest";
import { resolveDatabaseMode } from "@/lib/db/config";

describe("database environment selection", () => {
  it("uses hosted PostgreSQL when a URL is configured", () => {
    expect(resolveDatabaseMode("postgres://host/database", "production")).toBe("neon");
  });

  it("keeps PGlite as the local development fallback", () => {
    expect(resolveDatabaseMode(undefined, "development")).toBe("pglite");
    expect(resolveDatabaseMode("   ", "test")).toBe("pglite");
  });

  it("fails clearly in production when the hosted database URL is missing", () => {
    expect(() => resolveDatabaseMode(undefined, "production")).toThrow("DATABASE_URL is required in production");
    expect(() => resolveDatabaseMode("", "production")).toThrow("PGlite is for local development and tests only");
  });
});
