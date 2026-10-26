import { describe, expect, it } from "vitest";
import { fixture } from "./fixtures";
import {
  generatedPlanSchema,
  itinerarySchema,
  planRequestSchema,
} from "@/lib/itinerary/validation";
import {
  constraintErrors,
  replaceActivity,
  summarize,
} from "@/lib/itinerary/calculations";
import { parsePromptHints } from "@/lib/itinerary/constraints";
import { money } from "@/lib/utils";
describe("prompt constraint hints", () => {
  it("extracts explicit total budget, party size and transit", () =>
    expect(
      parsePromptHints("Plan for 6 friends under $125.50 using public transit"),
    ).toEqual({ budget: 125.5, partySize: 6, transportation: "transit" }));
  it("does not invent constraints for vague requests", () =>
    expect(parsePromptHints("Give me a good afternoon")).toEqual({}));
  it("rejects negative controls and oversized prompts", () => {
    expect(
      planRequestSchema.safeParse({
        prompt: "A good day please",
        preferences: { budget: -10 },
      }).success,
    ).toBe(false);
    expect(
      planRequestSchema.safeParse({ prompt: "x".repeat(3001), preferences: {} })
        .success,
    ).toBe(false);
  });
});
describe("itinerary constraints", () => {
  it("displays cents so the estimated total and remaining budget still add up", () => {
    const plan = fixture();
    plan.budget = 50;
    plan.activities[0].estimatedCost = 48.5;
    const summary = summarize(plan);
    expect(money(summary.totalCost)).toBe("$48.50");
    expect(money(summary.remaining)).toBe("$1.50");
    expect(money(plan.budget)).toBe("$50");
  });
  it("accepts a valid sourced itinerary", () => {
    expect(itinerarySchema.safeParse(fixture()).success).toBe(true);
    expect(constraintErrors(fixture())).toEqual([]);
  });
  it("rejects invalid dates, time formats and model data", () => {
    const plan = fixture();
    plan.date = "2026-02-30";
    expect(generatedPlanSchema.safeParse(plan).success).toBe(false);
    plan.activities[0].startTime = "25:00";
    expect(generatedPlanSchema.safeParse(plan).success).toBe(false);
  });
  it("detects overlap including travel before the next stop", () => {
    const plan = fixture();
    plan.activities[1].startTime = "12:10";
    expect(constraintErrors(plan).join()).toContain("travel time");
  });
  it("rejects outside-window activities and overnight plans", () => {
    const plan = fixture();
    plan.activities[1].endTime = "18:00";
    expect(constraintErrors(plan).join()).toContain("time window");
    plan.endTime = "09:00";
    expect(constraintErrors(plan).join()).toContain("end time");
  });
  it("detects duplicate identifiers and zero duration", () => {
    const plan = fixture();
    plan.activities[1].id = "lunch";
    plan.activities[0].endTime = "11:00";
    expect(constraintErrors(plan).join()).toContain("unique");
    expect(constraintErrors(plan).join()).toContain("positive duration");
  });
  it("calculates party costs without multiplying by party size", () =>
    expect(summarize(fixture())).toMatchObject({
      totalCost: 40,
      remaining: 60,
      travelMinutes: 20,
      durationMinutes: 360,
      activityCount: 2,
    }));
  it("rejects budget overflow", () => {
    const plan = fixture();
    plan.activities[0].estimatedCost = 101;
    expect(constraintErrors(plan).join()).toContain("budget");
  });
  it("preserves other activities when replacing one", () => {
    const plan = fixture();
    const result = replaceActivity(plan, "lunch", {
      ...plan.activities[0],
      id: "new-id",
      name: "New lunch",
      estimatedCost: 30,
    });
    expect(result.activities[0].id).toBe("lunch");
    expect(result.activities[1]).toEqual(plan.activities[1]);
    expect(summarize(result).remaining).toBe(70);
  });
  it("rejects invalid replacements instead of silently changing other stops", () => {
    const plan = fixture();
    expect(() =>
      replaceActivity(plan, "lunch", {
        ...plan.activities[0],
        endTime: "13:00",
      }),
    ).toThrow("overlaps");
    expect(() => replaceActivity(plan, "unknown", plan.activities[0])).toThrow(
      "not found",
    );
  });
});
