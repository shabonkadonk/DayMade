import type { BookingStatus } from "@/types/booking";
import type { FoReply } from "@/lib/fo/types";
const transitions: Record<BookingStatus, BookingStatus[]> = {
  requested: [
    "in_progress",
    "awaiting_confirmation",
    "failed",
    "requires_user_action",
  ],
  in_progress: [
    "in_progress",
    "awaiting_confirmation",
    "failed",
    "requires_user_action",
  ],
  awaiting_confirmation: ["confirmed", "failed", "requires_user_action"],
  confirmed: [],
  failed: [],
  cancelled: [],
  requires_user_action: [],
};
export function canTransition(from: BookingStatus, to: BookingStatus) {
  return transitions[from].includes(to);
}
export function statusFromFo(reply: FoReply): BookingStatus {
  if (reply.status === "failed") return "failed";
  if (reply.status === "working") return "in_progress";
  // A complete Fo turn has no typed reservation confirmation evidence in the discovered schema.
  return "requires_user_action";
}
