import { scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
export { createSession, readSession, sessionCookieName } from "@/lib/session";

const scrypt = promisify(scryptCallback);
export async function verifyScryptPassword(password: string, encoded: string | undefined): Promise<boolean> {
  if (!encoded) return false;
  const [scheme, salt, hash] = encoded.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "hex");
  const actual = (await scrypt(password, salt, expected.length)) as Buffer;
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
