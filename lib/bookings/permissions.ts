import { z } from "zod";
import type { Itinerary } from "@/types/itinerary";
import { AppError } from "@/lib/api/errors";
export const bookingRequestSchema = z.object({
  itineraryId: z.uuid(),
  revision: z.number().int().positive(),
  activityId: z.string().min(1).max(100),
  idempotencyKey: z.uuid(),
  approval: z.object({
    action: z.literal("contact_and_request_reservation"),
    consent: z.literal(true),
    maximumSpend: z.literal(0),
    contact: z
      .object({
        name: z.string().trim().min(1).max(100),
        phone: z
          .string()
          .regex(
            /^\+[1-9]\d{7,14}$/,
            "Use a phone number with country code, for example +16085551234.",
          )
          .optional(),
      })
      .strict()
      .optional(),
  }),
});
export type BookingRequest = z.infer<typeof bookingRequestSchema>;
export function validateApproval(input: BookingRequest, plan: Itinerary) {
  bookingRequestSchema.parse(input);
  if (input.itineraryId !== plan.id || input.revision !== plan.revision)
    throw new AppError(
      "STALE_APPROVAL",
      "Your plan changed. Review the latest actions before approving.",
      409,
    );
  const activity = plan.activities.find((a) => a.id === input.activityId);
  if (!activity?.requiresReservation)
    throw new AppError(
      "INVALID_ACTIVITY",
      "This activity does not have a reservation action.",
    );
  return activity;
}
