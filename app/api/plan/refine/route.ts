import { refineRequestSchema } from "@/lib/itinerary/validation";
import { generatedPlanSchema } from "@/lib/itinerary/validation";
import { generatePlan } from "@/lib/ai/planner";
import {
  getItinerary,
  saveItinerary,
  assertPlanEditable,
} from "@/lib/db/repository";
import { guestSession, rateLimit, readBody } from "@/lib/api/security";
import { AppError, errorResponse } from "@/lib/api/errors";
export const maxDuration = 180;
export async function POST(request: Request) {
  try {
    const input = refineRequestSchema.parse(await readBody(request));
    const owner = await guestSession();
    await rateLimit(owner, request);
    const plan = await getItinerary(input.itineraryId, owner);
    if (plan.revision !== input.revision)
      throw new AppError(
        "CONFLICT",
        "This plan has changed. Reload before editing.",
        409,
      );
    if (
      input.activityId &&
      !plan.activities.some((a) => a.id === input.activityId)
    )
      throw new AppError("NOT_FOUND", "Activity not found.", 404);
    await assertPlanEditable(plan.id, owner);
    let updated;
    if (input.operation === "remove") {
      if (!input.activityId || plan.activities.length < 2)
        throw new AppError(
          "INVALID_REMOVAL",
          "Keep at least one activity in your day.",
        );
      updated = {
        ...plan,
        activities: plan.activities.filter((a) => a.id !== input.activityId),
        revision: plan.revision + 1,
        updatedAt: new Date().toISOString(),
      };
      generatedPlanSchema.parse(updated);
    } else
      updated = await generatePlan(
        {
          prompt: input.instruction,
          preferences: input.activityId
            ? {
                location: plan.location,
                date: plan.date,
                startTime: plan.startTime,
                endTime: plan.endTime,
                budget: plan.budget,
                partySize: plan.partySize,
                transportation: plan.transportation,
              }
            : { location: plan.location },
        },
        plan,
        input.activityId,
      );
    await saveItinerary(updated, owner, input.revision);
    return Response.json(
      { itinerary: updated },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
