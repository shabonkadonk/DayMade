import "server-only";
import { randomUUID } from "node:crypto";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { getAnthropic, providerError } from "./anthropic";
import { plannerSystem } from "./prompts";
import { researchActivities } from "./research";
import {
  generatedPlanSchema,
  plannerOutputSchema,
  type GeneratedPlan,
  type Itinerary,
  type PlanRequest,
} from "@/lib/itinerary/validation";
import { constraintErrors } from "@/lib/itinerary/calculations";
import { parsePromptHints } from "@/lib/itinerary/constraints";
import { AppError } from "@/lib/api/errors";
export async function generatePlan(
  request: PlanRequest,
  existing?: Itinerary,
  activityId?: string,
): Promise<Itinerary> {
  const client = getAnthropic(),
    model = process.env.ANTHROPIC_MODEL!;
  const explicit = Object.fromEntries(
    Object.entries(request.preferences).filter(
      ([, v]) => v !== undefined && v !== "",
    ),
  );
  const preferences = { ...parsePromptHints(request.prompt), ...explicit };
  const currentTimeUTC = new Date().toISOString();
  const deadline = Date.now() + 160000;
  try {
    const { sources, text: researchText } = await researchActivities(
      client,
      model,
      {
        request: request.prompt,
        preferences,
        existing: existing ?? null,
        replaceOnly: activityId ?? null,
        today: currentTimeUTC.slice(0, 10),
        currentTimeUTC,
      },
    );
    const sourceUrls = new Set([
      ...sources.keys(),
      ...(existing?.sources.map((s) => s.url) ?? []),
    ]);
    let generated: GeneratedPlan | undefined;
    let errors: string[] = [];
    let candidate: unknown;
    // One repair turn reuses the same retrieved evidence. Never relax user constraints.
    for (let attempt = 0; attempt < 2; attempt++) {
      const remaining = deadline - Date.now();
      if (remaining < 1000)
        throw new AppError(
          "AI_TIMEOUT",
          "Research took longer than expected. Please try a shorter outing.",
          504,
        );
      const result = await client.messages.parse(
        {
          model,
          max_tokens: 6500,
          system: plannerSystem,
          output_config: { format: zodOutputFormat(plannerOutputSchema) },
          messages: [
            {
              role: "user",
              content: JSON.stringify({
                request,
                preferences,
                research: researchText,
                sourceUrls: [...sourceUrls],
                existing: existing ?? null,
                replaceOnly: activityId ?? null,
                instruction: activityId
                  ? "Return a full plan, preserving every other activity and all plan-level constraints. Only replace the targeted activity within its existing time slot, preserving its id."
                  : undefined,
                today: currentTimeUTC.slice(0, 10),
                currentTimeUTC,
                repair: attempt
                  ? {
                      previousPlan: candidate,
                      validationErrors: errors,
                      instruction:
                        "Correct each validation error using only the supplied research and exact source URLs. Keep all user constraints, including the total budget. Do not fabricate evidence or remove requested experiences to bypass checks.",
                    }
                  : undefined,
              }),
            },
          ],
        },
        { timeout: Math.min(60000, remaining), maxRetries: 0 },
      );
      if (result.stop_reason === "max_tokens" || !result.parsed_output)
        throw new AppError(
          "INVALID_AI_OUTPUT",
          "The plan was incomplete. Try a shorter outing.",
          502,
        );
      candidate = result.parsed_output;
      const parsed = plannerOutputSchema.safeParse(candidate);
      if (!parsed.success) {
        errors = parsed.error.issues.map(
          (i) => `${i.path.join(".")}: ${i.message}`,
        );
        continue;
      }
      const output = parsed.data;
      generated = generatedPlanSchema.parse({
        ...output,
        activities: output.activities.map((a) => ({
          ...a,
          coordinates: null,
          sourceUrl:
            a.sourceUrl && sourceUrls.has(a.sourceUrl) ? a.sourceUrl : null,
        })),
      });
      errors = [];
      if (activityId && existing) {
        const replacement = generated.activities.find(
          (a) => a.id === activityId,
        );
        if (!replacement)
          errors.push("Preserve the targeted activity's exact id.");
        else {
          // Merge before checking: unrelated model changes are never applied.
          generated = {
            ...existing,
            activities: existing.activities.map((a) =>
              a.id === activityId ? replacement : a,
            ),
          };
        }
      }
      errors.push(...constraintErrors(generated));
      for (const key of [
        "location",
        "date",
        "startTime",
        "endTime",
        "budget",
        "partySize",
        "transportation",
      ] as const) {
        const requested = preferences[key];
        if (
          requested !== undefined &&
          requested !== "" &&
          (key === "location"
            ? !generated.location
                .toLowerCase()
                .includes(String(requested).toLowerCase())
            : generated[key] !== requested)
        )
          errors.push(
            `The plan did not preserve your ${key} preference (${requested}).`,
          );
      }
      for (const a of generated.activities)
        if (!a.sourceUrl)
          errors.push(
            `${a.name} needs a relevant source URL copied exactly from the supplied sourceUrls.`,
          );
      if (!errors.length) break;
    }
    if (!generated || errors.length)
      throw new AppError(
        "PLAN_CONSTRAINTS",
        `We couldn't fit a verified plan to your request. ${errors[0] ?? "Please try a shorter outing."}`,
        422,
        errors,
      );
    const allSources = new Map(
      existing?.sources.map((s) => [s.url, s.title]) ?? [],
    );
    sources.forEach((title, url) => allSources.set(url, title));
    return {
      ...generated,
      id: existing?.id ?? randomUUID(),
      revision: (existing?.revision ?? 0) + 1,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      verificationStatus: "research_backed_estimates",
      sources: [...allSources].map(([url, title]) => ({ url, title })),
    };
  } catch (error) {
    return providerError(error);
  }
}
