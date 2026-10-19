import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const nextCli = fileURLToPath(new URL("../node_modules/next/dist/bin/next", import.meta.url));
const env = { ...process.env, NODE_ENV: "production" };

if (!env.DATABASE_URL?.trim()) {
  // Next imports route modules while collecting build configuration. This
  // build-only URL prevents local PGlite from starting in parallel workers;
  // server runtime still requires a real DATABASE_URL.
  env.DATABASE_URL = "postgres://build:build@127.0.0.1:5432/build";
  process.stdout.write("DATABASE_URL is unset; using a build-only placeholder (configure the real URL for runtime).\n");
}

const result = spawnSync(process.execPath, [nextCli, "build"], { env, stdio: "inherit" });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
