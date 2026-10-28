import { beforeEach, describe, expect, it, vi } from "vitest";
const cookieMock = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => cookieMock }));
vi.mock("@/lib/db/client", () => ({ getDatabase: () => null }));
import { guestSession, readBody } from "@/lib/api/security";
import { errorResponse, AppError } from "@/lib/api/errors";
beforeEach(() => {
  cookieMock.get.mockReturnValue(undefined);
});
describe("API security", () => {
  it("accepts the browser host when Next normalizes the internal URL", async () => {
    const body = await readBody(
      new Request("http://localhost:3000/api/plan", {
        method: "POST",
        headers: {
          host: "127.0.0.1:3000",
          origin: "http://127.0.0.1:3000",
          "content-type": "application/json",
        },
        body: "{}",
      }),
    );
    expect(body).toEqual({});
  });
  it("rejects requests from another origin", async () => {
    await expect(
      readBody(
        new Request("https://daymade.app/api/plan", {
          method: "POST",
          headers: {
            origin: "https://attacker.test",
            "content-type": "application/json",
          },
          body: "{}",
        }),
      ),
    ).rejects.toMatchObject({ code: "INVALID_ORIGIN" });
  });
  it("caps request size and validates JSON", async () => {
    await expect(
      readBody(
        new Request("https://daymade.app/api/plan", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: "x".repeat(17000),
        }),
      ),
    ).rejects.toMatchObject({ code: "REQUEST_TOO_LARGE" });
    await expect(
      readBody(
        new Request("https://daymade.app/api/plan", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: "broken",
        }),
      ),
    ).rejects.toMatchObject({ code: "INVALID_JSON" });
  });
  it("does not expose private plans without a guest cookie", async () => {
    await expect(guestSession()).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(cookieMock.set).not.toHaveBeenCalled();
  });
  it("creates a private HttpOnly cookie and stores only its hash", async () => {
    const hash = await guestSession(true);
    expect(hash).toHaveLength(64);
    expect(cookieMock.set).toHaveBeenCalledWith(
      "daymade_guest",
      expect.any(String),
      expect.objectContaining({ httpOnly: true, sameSite: "lax" }),
    );
    expect(cookieMock.set.mock.calls[0][1]).not.toBe(hash);
  });
  it("returns structured safe errors", async () => {
    const response = errorResponse(
      new AppError("FO_UNAVAILABLE", "Connect Wajo", 503),
    );
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      error: { code: "FO_UNAVAILABLE", message: "Connect Wajo" },
    });
  });
});
