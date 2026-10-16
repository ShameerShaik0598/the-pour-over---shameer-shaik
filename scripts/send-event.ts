import { createHmac, randomUUID } from "node:crypto";
import { createRequire } from "node:module";

const nextEnv = createRequire(import.meta.url)("@next/env") as { loadEnvConfig: (directory: string) => unknown };
nextEnv.loadEnvConfig(process.cwd());

const secret = process.env.WEBHOOK_SECRET;
const baseUrl = process.env.WEBHOOK_URL ?? "http://localhost:3000/webhooks/app";
if (!secret) throw new Error("Set WEBHOOK_SECRET before sending a local test event.");
const timestamp = String(Math.floor(Date.now() / 1000));
const body = JSON.stringify({ event_id: `evt_cli_${randomUUID()}`, event: "app_open", user_id: "u_demo_test",
  device_id: "d_demo_test", timestamp: new Date(Number(timestamp) * 1000).toISOString(), properties: { source: "local-cli" } });
const signature = createHmac("sha256", secret).update(timestamp).update(".").update(body).digest("hex");
const response = await fetch(baseUrl, { method: "POST", headers: { "content-type": "application/json",
  "x-tpo-timestamp": timestamp, "x-tpo-signature": `sha256=${signature}` }, body });
process.stdout.write(`${response.status} ${await response.text()}\n`);
