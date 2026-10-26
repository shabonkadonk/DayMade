import { bookingRequestSchema } from "@/lib/bookings/permissions";
import { arrangeActivity } from "@/lib/bookings/service";
import { withFo } from "@/lib/fo/service";
import { getItinerary } from "@/lib/db/repository";
import { bookingStore, publicBooking } from "@/lib/db/bookings";
import { guestSession, rateLimit, readBody } from "@/lib/api/security";
import { errorResponse } from "@/lib/api/errors";
export const maxDuration = 90;
export async function POST(request: Request) {
  try {
    const input = bookingRequestSchema.parse(await readBody(request));
    const owner = await guestSession();
    await rateLimit(owner, request);
    const plan = await getItinerary(input.itineraryId, owner);
    const booking = await withFo(owner, (fo) =>
      arrangeActivity(input, plan, owner, fo, bookingStore),
    );
    return Response.json({ booking: publicBooking(booking) }, { status: 202 });
  } catch (error) {
    return errorResponse(error);
  }
}
