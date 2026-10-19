export type DatabaseMode = "neon" | "pglite";

export function resolveDatabaseMode(databaseUrl: string | undefined, nodeEnv: string | undefined): DatabaseMode {
  if (databaseUrl?.trim()) return "neon";
  if (nodeEnv === "production") {
    throw new Error("DATABASE_URL is required in production. Configure a hosted PostgreSQL URL, such as Neon; PGlite is for local development and tests only.");
  }
  return "pglite";
}
