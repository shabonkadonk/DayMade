import { expect, it } from "vitest";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { plannerOutputSchema } from "@/lib/itinerary/validation";
it("uses a schema the official Anthropic structured-output helper supports", () => {
  expect(() => zodOutputFormat(plannerOutputSchema)).not.toThrow();
});
