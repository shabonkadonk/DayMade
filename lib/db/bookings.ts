import "server-only";
import type { Booking } from "@/types/booking";
import type { BookingStore } from "@/lib/bookings/service";
import { getDatabase } from "./client";
import { AppError } from "@/lib/api/errors";
function database() {
  const db = getDatabase();
  if (!db)
    throw new AppError(
      "BOOKING_STORAGE_REQUIRED",
      "Connect Supabase before enabling real-world actions.",
      503,
    );
  return db;
}
export const bookingStore: BookingStore = {
  async claim(booking, owner) {
    const db = database();
    const { data, error } = await db.rpc("daymade_claim_booking", {
      approval: booking,
      guest_owner: owner,
    });
    if (!error && data) return data as { booking: Booking; inserted: boolean };
    const message = error?.message ?? "";
    if (message.includes("STALE_APPROVAL"))
      throw new AppError(
        "STALE_APPROVAL",
        "Your plan changed. Reload and review it before approving.",
        409,
      );
    if (message.includes("FO_ACTION_IN_PROGRESS"))
      throw new AppError(
        "FO_ACTION_IN_PROGRESS",
        "Review the current Fo request before starting another one.",
        409,
      );
    if (message.includes("IDEMPOTENCY_CONFLICT"))
      throw new AppError(
        "IDEMPOTENCY_CONFLICT",
        "This approval key was already used. Reload before approving.",
        409,
      );
    throw new AppError(
      "STORAGE_UNAVAILABLE",
      "Approval could not be safely recorded. Apply both Supabase migrations. No request was sent.",
      503,
    );
  },
  async save(booking, owner) {
    const { error } = await database()
      .from("bookings")
      .update({ payload: booking })
      .eq("id", booking.id)
      .eq("owner_hash", owner);
    if (error)
      throw new AppError(
        "STORAGE_UNAVAILABLE",
        "The external result needs review. Do not submit another request.",
        503,
      );
  },
};
export async function getBooking(id: string, owner: string): Promise<Booking> {
  const { data, error } = await database()
    .from("bookings")
    .select("payload")
    .eq("id", id)
    .eq("owner_hash", owner)
    .maybeSingle();
  if (error)
    throw new AppError(
      "STORAGE_UNAVAILABLE",
      "Booking details are unavailable.",
      503,
    );
  if (!data)
    throw new AppError("NOT_FOUND", "Booking not found in this session.", 404);
  return data.payload;
}
export function publicBooking(booking: Booking) {
  const {
    externalTaskId: _task,
    idempotencyKey: _key,
    ...publicData
  } = booking;
  void _task;
  void _key;
  return publicData;
}

export async function listBookings(
  itineraryId: string,
  owner: string,
): Promise<Booking[]> {
  const { data, error } = await database()
    .from("bookings")
    .select("payload")
    .eq("owner_hash", owner)
    .eq("itinerary_id", itineraryId)
    .order("created_at");
  if (error)
    throw new AppError(
      "STORAGE_UNAVAILABLE",
      "Requests could not be loaded.",
      503,
    );
  return (data ?? []).map((row) => row.payload as Booking);
}
