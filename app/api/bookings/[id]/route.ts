import { z } from "zod";
import { getBooking, publicBooking, bookingStore } from "@/lib/db/bookings";
import { guestSession, rateLimit, readBody } from "@/lib/api/security";
import { errorResponse } from "@/lib/api/errors";
import { withFo } from "@/lib/fo/service";
import { statusFromFo } from "@/lib/bookings/states";
export const maxDuration = 90;
type Context = { params: Promise<{ id: string }> };
export async function GET(_request: Request, { params }: Context) {
  try {
    const owner = await guestSession(),
      id = z.uuid().parse((await params).id);
    return Response.json(
      { booking: publicBooking(await getBooking(id, owner)) },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
// Refresh is an explicit POST because it may refresh OAuth credentials and persist progress.
export async function POST(request: Request, { params }: Context) {
  try {
    await readBody(request);
    const owner = await guestSession();
    await rateLimit(owner, request);
    const id = z.uuid().parse((await params).id),
      booking = await getBooking(id, owner);
    if (
      booking.externalTaskId &&
      ["in_progress", "requires_user_action", "awaiting_confirmation"].includes(
        booking.status,
      )
    ) {
      const reply = await withFo(owner, (fo) =>
        fo.getTaskStatus(booking.externalTaskId!),
      );
      booking.status = statusFromFo(reply);
      booking.message = reply.response ?? reply.progress ?? booking.message;
      booking.updatedAt = new Date().toISOString();
      await bookingStore.save(booking, owner);
    }
    return Response.json(
      { booking: publicBooking(booking) },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
