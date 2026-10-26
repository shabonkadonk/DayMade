import { afterEach, describe, expect, it, vi } from "vitest";
import { encryptCredentials, decryptCredentials } from "@/lib/fo/credentials";
import { appOrigin, FoOAuthProvider, wajoFetch } from "@/lib/fo/oauth";
afterEach(() => vi.unstubAllEnvs());
describe("per-user Fo credentials", () => {
  it("allows OAuth callback query parameters when deriving the development origin", () => {
    vi.stubEnv("DAYMADE_APP_URL", "");
    vi.stubEnv("NODE_ENV", "development");
    expect(
      appOrigin(
        new Request(
          "http://localhost:3000/api/fo/callback?code=test&state=test",
        ),
      ),
    ).toBe("http://localhost:3000");
  });
  it("encrypts credentials and binds decryption to the owning guest", () => {
    vi.stubEnv("FO_TOKEN_ENCRYPTION_KEY", "1".repeat(64));
    const record = {
      redirectUrl: "http://localhost:3000/api/fo/callback",
      returnTo: "/connections/fo",
      tokens: { access_token: "private-token", token_type: "Bearer" },
    };
    const encrypted = encryptCredentials("owner-one", record);
    expect(encrypted).not.toContain("private-token");
    expect(decryptCredentials("owner-one", encrypted)).toEqual(record);
    expect(() => decryptCredentials("owner-two", encrypted)).toThrow();
    expect(() =>
      decryptCredentials("owner-one", encrypted.slice(0, -4) + "AAAA"),
    ).toThrow();
  });
  it("requires a properly sized encryption key", () => {
    vi.stubEnv("FO_TOKEN_ENCRYPTION_KEY", "short");
    expect(() =>
      encryptCredentials("owner", {
        redirectUrl: "http://localhost",
        returnTo: "/",
      }),
    ).toThrow("FO_TOKEN_ENCRYPTION_KEY");
  });
  it("rejects untrusted endpoints before issuing any request", async () => {
    await expect(
      wajoFetch("https://evil.example/oauth/token"),
    ).rejects.toMatchObject({ code: "FO_UNTRUSTED_ENDPOINT" });
  });
  it("accepts a local development origin but requires a fixed HTTPS origin in production", () => {
    vi.stubEnv("DAYMADE_APP_URL", "");
    vi.stubEnv("NODE_ENV", "development");
    expect(appOrigin(new Request("http://localhost:3000/api/fo/connect"))).toBe(
      "http://localhost:3000",
    );
    expect(() =>
      appOrigin(new Request("http://evil.example/api/fo/connect")),
    ).toThrow();
    vi.stubEnv("NODE_ENV", "production");
    expect(() =>
      appOrigin(new Request("https://daymade.example/api/fo/connect")),
    ).toThrow();
    vi.stubEnv("DAYMADE_APP_URL", "https://daymade.example");
    expect(
      appOrigin(new Request("https://daymade.example/api/fo/connect")),
    ).toBe("https://daymade.example");
  });
  it("never starts an interactive sign-in from a booking request", async () => {
    const provider = new FoOAuthProvider("owner", {
      redirectUrl: "http://localhost:3000/api/fo/callback",
      returnTo: "/",
    });
    await expect(
      provider.redirectToAuthorization(
        new URL("https://mcp.api.wajo.ai/oauth/authorize"),
      ),
    ).rejects.toMatchObject({ code: "FO_RECONNECT_REQUIRED" });
  });
});
