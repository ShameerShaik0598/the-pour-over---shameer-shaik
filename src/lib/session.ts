import { SignJWT, jwtVerify } from "jose";

const COOKIE = "carafe_session";
const SESSION_DURATION = 8 * 60 * 60;

function signingKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("SESSION_SECRET must contain at least 32 characters");
  return new TextEncoder().encode(secret);
}

export type Session = { username: string; role: "admin" | "viewer" };

export async function createSession(session: Session): Promise<string> {
  return new SignJWT({ role: session.role }).setProtectedHeader({ alg: "HS256" }).setSubject(session.username).setIssuedAt().setExpirationTime(`${SESSION_DURATION}s`).sign(signingKey());
}

export async function readSession(token: string | undefined): Promise<Session | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, signingKey());
    if (typeof payload.sub !== "string" || (payload.role !== "admin" && payload.role !== "viewer")) return null;
    return { username: payload.sub, role: payload.role };
  } catch {
    return null;
  }
}

export const sessionCookieName = COOKIE;
