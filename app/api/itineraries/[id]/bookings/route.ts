import { z } from "zod";
import { guestSession } from "@/lib/api/security";
import { errorResponse } from "@/lib/api/errors";
import { getItinerary } from "@/lib/db/repository";
import { getDatabase } from "@/lib/db/client";
import { listBookings, publicBooking } from "@/lib/db/bookings";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const id = z.uuid().parse((await params).id),
      owner = await guestSession();
    await getItinerary(id, owner);
    const records = getDatabase() ? await listBookings(id, owner) : [];
    return Response.json(
      { bookings: records.map(publicBooking) },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
