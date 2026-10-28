export type BookingStatus =
  | "requested"
  | "in_progress"
  | "awaiting_confirmation"
  | "confirmed"
  | "failed"
  | "cancelled"
  | "requires_user_action";
export interface Booking {
  id: string;
  itineraryId: string;
  activityId: string;
  revision: number;
  idempotencyKey: string;
  status: BookingStatus;
  approvedAt: string;
  approvedAction: "contact_and_request_reservation";
  maximumSpend: 0;
  approvedContact?: { name: string; phone?: string };
  externalTaskId: string | null;
  message: string;
  createdAt: string;
  updatedAt: string;
}

export type PublicBooking = Omit<Booking, "externalTaskId" | "idempotencyKey">;
