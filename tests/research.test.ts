import { afterEach, describe, expect, it, vi } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import { researchActivities } from "@/lib/ai/research";
import { anthropicEndpoint, getAnthropic } from "@/lib/ai/anthropic";

const source = {
  type: "web_search_tool_result",
  tool_use_id: "search",
  content: [
    {
      type: "web_search_result",
      url: "https://example.org/menu",
      title: "Retrieved test menu",
      encrypted_content: "fixture-only",
    },
  ],
};
const search = {
  type: "server_tool_use",
  id: "search",
  name: "web_search",
  input: { query: "test venue menu" },
};
function message(content: unknown[], stop_reason = "end_turn", searches = 0) {
  return {
    content,
    stop_reason,
    usage: { server_tool_use: { web_search_requests: searches } },
  };
}
function provider(...responses: ReturnType<typeof message>[]) {
  const create = vi.fn();
  responses.forEach((response) => create.mockResolvedValueOnce(response));
  return { create, client: { messages: { create } } as unknown as Anthropic };
}
afterEach(() => vi.unstubAllEnvs());
describe("venue research failures and continuations", () => {
  it("reports an HTTP-200 search tool failure without blaming the user's location", async () => {
    const { client, create } = provider(
      message([
        {
          ...source,
          content: {
            type: "web_search_tool_result_error",
            error_code: "unavailable",
          },
        },
      ]),
    );
    await expect(
      researchActivities(client, "test-model", {
        request: "Dinner in Madison",
      }),
    ).rejects.toMatchObject({ code: "RESEARCH_UNAVAILABLE", status: 503 });
    expect(create).toHaveBeenCalledTimes(1);
  });
  it("distinguishes search rate limits and exhausted search allowances", async () => {
    for (const [error_code, code, status] of [
      ["too_many_requests", "RESEARCH_RATE_LIMITED", 429],
      ["max_uses_exceeded", "RESEARCH_LIMIT_REACHED", 422],
    ]) {
      const { client } = provider(
        message([
          {
            ...source,
            content: { type: "web_search_tool_result_error", error_code },
          },
        ]),
      );
      await expect(
        researchActivities(client, "test-model", {}),
      ).rejects.toMatchObject({ code, status });
    }
  });
  it("continues a paused research turn with the entire assistant content unchanged", async () => {
    const paused = message(
      [search, { type: "text", text: "Research is continuing" }],
      "pause_turn",
      1,
    );
    const { client, create } = provider(
      paused,
      message(
        [source, { type: "text", text: "Retrieved test details" }],
        "end_turn",
        1,
      ),
    );
    const result = await researchActivities(client, "test-model", {
      request: "Dinner in Madison",
    });
    expect(create).toHaveBeenCalledTimes(2);
    expect(create.mock.calls[1][0].messages[1]).toEqual({
      role: "assistant",
      content: paused.content,
    });
    expect(create.mock.calls[1][0].tools[0].max_uses).toBe(3);
    expect(result.sources.get("https://example.org/menu")).toBe(
      "Retrieved test menu",
    );
    expect(result.text).toContain("Retrieved test details");
  });
  it("bounds repeated pauses rather than polling forever", async () => {
    const paused = message([], "pause_turn");
    const { client, create } = provider(paused, paused, paused);
    await expect(
      researchActivities(client, "test-model", {}),
    ).rejects.toMatchObject({ code: "RESEARCH_INCOMPLETE" });
    expect(create).toHaveBeenCalledTimes(3);
  });
  it("caps search usage across continuations", async () => {
    const { client, create } = provider(message([search], "pause_turn", 4));
    await expect(
      researchActivities(client, "test-model", {}),
    ).rejects.toMatchObject({ code: "RESEARCH_LIMIT_REACHED" });
    expect(create).toHaveBeenCalledTimes(1);
  });
  it("asks explicitly for search if the model initially answers from memory", async () => {
    const { client, create } = provider(
      message([{ type: "text", text: "An unsourced recommendation" }]),
      message([source], "end_turn", 1),
    );
    const result = await researchActivities(client, "test-model", {});
    expect(create).toHaveBeenCalledTimes(2);
    expect(create.mock.calls[1][0].messages[2].content).toContain("web_search");
    expect(result.sources.size).toBe(1);
  });
  it("returns a focused location clarification when genuinely needed", async () => {
    const { client, create } = provider(
      message([
        {
          type: "text",
          text: '{"clarification":"Which Madison do you mean—Wisconsin or another city?"}',
        },
      ]),
    );
    await expect(
      researchActivities(client, "test-model", {}),
    ).rejects.toMatchObject({
      code: "LOCATION_CLARIFICATION_REQUIRED",
      message: "Which Madison do you mean—Wisconsin or another city?",
    });
    expect(create).toHaveBeenCalledTimes(1);
  });
  it("does not send incomplete token-limited research to the planner", async () => {
    const { client } = provider(message([source], "max_tokens", 1));
    await expect(
      researchActivities(client, "test-model", {}),
    ).rejects.toMatchObject({ code: "RESEARCH_INCOMPLETE" });
  });
  it("keeps real sources when a later search hits its limit", async () => {
    const { client } = provider(
      message(
        [
          source,
          {
            ...source,
            content: {
              type: "web_search_tool_result_error",
              error_code: "max_uses_exceeded",
            },
          },
        ],
        "end_turn",
        4,
      ),
    );
    expect(
      (await researchActivities(client, "test-model", {})).sources.size,
    ).toBe(1);
  });
});
describe("intentional Anthropic endpoint configuration", () => {
  it("keeps a real API key on Anthropic instead of inheriting an unrelated gateway", () => {
    vi.stubEnv("ANTHROPIC_BASE_URL", "http://localhost:1234");
    vi.stubEnv("DAYMADE_TEST_ANTHROPIC_BASE_URL", "");
    vi.stubEnv("ANTHROPIC_API_KEY", "controlled-test-key");
    vi.stubEnv("ANTHROPIC_MODEL", "controlled-test-model");
    expect(anthropicEndpoint()).toBe("https://api.anthropic.com");
    expect(getAnthropic().baseURL).toBe("https://api.anthropic.com");
  });
  it("allows an explicit loopback test provider only in development or tests", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("DAYMADE_TEST_ANTHROPIC_BASE_URL", "http://127.0.0.1:4100");
    expect(anthropicEndpoint()).toBe("http://127.0.0.1:4100");
    vi.stubEnv("NODE_ENV", "production");
    expect(anthropicEndpoint).toThrow("only allowed on localhost");
  });
  it("rejects remote or credential-bearing test endpoints", () => {
    vi.stubEnv("NODE_ENV", "development");
    for (const endpoint of [
      "https://unrelated.test",
      "http://secret@localhost:4100",
      "not a URL",
    ]) {
      vi.stubEnv("DAYMADE_TEST_ANTHROPIC_BASE_URL", endpoint);
      expect(anthropicEndpoint).toThrow();
    }
  });
});
