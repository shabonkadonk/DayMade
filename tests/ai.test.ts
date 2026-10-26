import { beforeEach, describe, expect, it, vi } from "vitest";
import { fixture } from "./fixtures";
const mocks = vi.hoisted(() => ({ create: vi.fn(), parse: vi.fn() }));
vi.mock("@/lib/ai/anthropic", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/ai/anthropic")>();
  return { ...original, getAnthropic: () => ({ messages: mocks }) };
});
import { generatePlan } from "@/lib/ai/planner";
beforeEach(() => {
  mocks.create.mockResolvedValue({
    content: [
      { type: "text", text: "Retrieved venue details", citations: [] },
      {
        type: "web_search_tool_result",
        content: [
          {
            type: "web_search_result",
            url: "https://example.org/venue",
            title: "Test source",
          },
        ],
      },
    ],
  });
  mocks.parse.mockResolvedValue({
    parsed_output: fixture(),
    stop_reason: "end_turn",
  });
});
describe("research-grounded planning", () => {
  it("repairs a generated travel conflict once without repeating research or relaxing constraints", async () => {
    const broken = fixture();
    broken.activities[0].transportationMinutes = 15;
    mocks.parse
      .mockResolvedValueOnce({ parsed_output: broken })
      .mockResolvedValueOnce({ parsed_output: fixture() });
    const result = await generatePlan({
      prompt: "A day in San Francisco",
      preferences: { location: "San Francisco", budget: 100 },
    });
    expect(result.activities[0].transportationMinutes).toBe(0);
    expect(result.budget).toBe(100);
    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(mocks.parse).toHaveBeenCalledTimes(2);
    const repair = JSON.parse(
      mocks.parse.mock.calls[1][0].messages[0].content,
    ).repair;
    expect(repair.validationErrors[0]).toContain("travel time");
  });

  it("generates validated structured data and strips model coordinates", async () => {
    const plan = fixture();
    plan.activities[0].coordinates = [-122, 37];
    mocks.parse.mockResolvedValue({ parsed_output: plan });
    const result = await generatePlan({
      prompt: "A day in San Francisco for two",
      preferences: { location: "San Francisco" },
    });
    expect(result.activities[0].coordinates).toBeNull();
    expect(result.sources).toEqual(plan.sources);
  });
  it("rejects invented sources", async () => {
    const plan = fixture();
    plan.activities[0].sourceUrl = "https://invented.example";
    mocks.parse.mockResolvedValue({ parsed_output: plan });
    await expect(
      generatePlan({
        prompt: "A day in San Francisco",
        preferences: { location: "" },
      }),
    ).rejects.toMatchObject({ code: "PLAN_CONSTRAINTS" });
  });
  it("rejects search failure instead of substituting a sample plan", async () => {
    mocks.create.mockResolvedValue({ content: [] });
    await expect(
      generatePlan({
        prompt: "A day in San Francisco",
        preferences: { location: "" },
      }),
    ).rejects.toMatchObject({ code: "RESEARCH_INCOMPLETE" });
    expect(mocks.parse).not.toHaveBeenCalled();
  });
  it("enforces explicit controls against model drift", async () => {
    await expect(
      generatePlan({
        prompt: "A day in San Francisco",
        preferences: { location: "San Francisco", budget: 25 },
      }),
    ).rejects.toMatchObject({ code: "PLAN_CONSTRAINTS" });
  });
  it("preserves other stops despite unrequested model changes", async () => {
    const plan = fixture();
    const output = fixture();
    output.activities[0].name = "Alternative lunch";
    output.activities[1].name = "Unrequested change";
    mocks.parse.mockResolvedValue({ parsed_output: output });
    const result = await generatePlan(
      {
        prompt: "Something more exciting",
        preferences: { location: "San Francisco" },
      },
      plan,
      "lunch",
    );
    expect(result.activities[1]).toEqual(plan.activities[1]);
    expect(result.revision).toBe(2);
  });
  it("sanitizes provider errors", async () => {
    mocks.create.mockRejectedValue(new Error("secret credential in raw error"));
    await expect(
      generatePlan({
        prompt: "A day in San Francisco",
        preferences: { location: "" },
      }),
    ).rejects.toMatchObject({ code: "AI_UNAVAILABLE" });
  });
});
