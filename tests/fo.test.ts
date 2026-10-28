import { describe, expect, it, vi } from "vitest";
import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { callFo } from "@/lib/fo/client";
import { getAnthropic } from "@/lib/ai/anthropic";
function fakeClient(response: unknown) {
  return { callTool: vi.fn(async () => response) } as unknown as Client;
}
describe("external integration validation", () => {
  it("uses discovered arguments and validates the Fo response", async () => {
    const client = fakeClient({
      structuredContent: {
        status: "working",
        conversationId: "server-id",
        progress: "Working",
      },
    });
    const result = await callFo(client, "get_fo_reply", {
      conversationId: "server-id",
      waitSeconds: 0,
    });
    expect(result.status).toBe("working");
    expect(client.callTool).toHaveBeenCalledWith(
      {
        name: "get_fo_reply",
        arguments: { conversationId: "server-id", waitSeconds: 0 },
      },
      undefined,
      { timeout: 55000 },
    );
  });
  it("rejects missing structured content and fabricated status values", async () => {
    await expect(
      callFo(fakeClient({ content: [{ text: "success" }] }), "ask_fo", {
        message: "test",
      }),
    ).rejects.toMatchObject({ code: "FO_INVALID_RESPONSE" });
    await expect(
      callFo(
        fakeClient({
          structuredContent: { status: "confirmed", conversationId: "x" },
        }),
        "ask_fo",
        { message: "test" },
      ),
    ).rejects.toMatchObject({ code: "FO_UNAVAILABLE" });
  });
  it("handles provider tool errors without leaking raw content", async () => {
    await expect(
      callFo(fakeClient({ isError: true, content: "secret error" }), "ask_fo", {
        message: "test",
      }),
    ).rejects.toMatchObject({ code: "FO_REQUEST_FAILED" });
  });
  it("requires an explicit API key and model", () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    vi.stubEnv("ANTHROPIC_MODEL", "");
    expect(() => getAnthropic()).toThrow("ANTHROPIC_API_KEY");
    vi.unstubAllEnvs();
  });
});
