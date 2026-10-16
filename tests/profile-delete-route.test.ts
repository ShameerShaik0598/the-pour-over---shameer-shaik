import { beforeAll, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { DELETE } from "@/app/api/profiles/[type]/[id]/route";
import { createSession, sessionCookieName } from "@/lib/session";

describe("profile erasure route authorization", () => {
  let viewerToken: string;
  beforeAll(async () => {
    process.env.SESSION_SECRET = "profile-delete-test-secret-at-least-32-characters";
    viewerToken = await createSession({ username: "recruiter", role: "viewer" });
  });

  it("requires a session and rejects viewers before touching profile data", async () => {
    const context = { params: Promise.resolve({ type: "subscriber", id: "123e4567-e89b-42d3-a456-426614174000" }) };
    const anonymous = await DELETE(new NextRequest("http://localhost/api/profiles/subscriber/123e4567-e89b-42d3-a456-426614174000", {
      method: "DELETE", headers: { origin: "http://localhost", host: "localhost" },
    }), context);
    expect(anonymous.status).toBe(401);
    const viewerRequest = new NextRequest("http://localhost/api/profiles/subscriber/123e4567-e89b-42d3-a456-426614174000", {
      method: "DELETE", headers: { origin: "http://localhost", host: "localhost", cookie: `${sessionCookieName}=${viewerToken}` },
    });
    expect((await DELETE(viewerRequest, context)).status).toBe(403);
  });
});
