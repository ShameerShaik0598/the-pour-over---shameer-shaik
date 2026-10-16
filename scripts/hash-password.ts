import { randomBytes, scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const password = process.argv[2];
if (!password) throw new Error("Usage: npm run hash-password -- <password>");
const salt = randomBytes(16).toString("hex");
const key = (await scrypt(password, salt, 64)) as Buffer;
process.stdout.write(`scrypt$${salt}$${key.toString("hex")}\n`);
