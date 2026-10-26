import { planRequestSchema } from "@/lib/itinerary/validation";
import { generatePlan } from "@/lib/ai/planner";
import { saveItinerary } from "@/lib/db/repository";
import { persistenceMode } from "@/lib/db/client";
import { guestSession, rateLimit, readBody } from "@/lib/api/security";
import { AppError, errorResponse } from "@/lib/api/errors";
export const maxDuration = 180;
export async function POST(request: Request) {
  try {
    const input = planRequestSchema.parse(await readBody(request));
    const owner = await guestSession(true);
    await rateLimit(owner, request);
    if (persistenceMode() === "unavailable")
      throw new AppError(
        "STORAGE_REQUIRED",
        "Connect Supabase before generating private plans in production.",
        503,
      );
    const plan = await generatePlan(input);
    await saveItinerary(plan, owner);
    return Response.json(
      { itinerary: plan, persistence: persistenceMode() },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
