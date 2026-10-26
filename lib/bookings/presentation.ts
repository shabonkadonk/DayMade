import type { PublicBooking } from "@/types/booking";

// This summarizes provider wording, never upgrades it to verified call/booking evidence.
export function bookingPresentation(
  booking: Pick<PublicBooking, "status" | "message">,
) {
  const base = {
    reservation: "Reservation not confirmed",
    call: "Not verified",
    evidence: null as string | null,
  };
  if (booking.status === "confirmed")
    return {
      ...base,
      reservation: "Marked confirmed",
      title: "Review your reservation confirmation",
      explanation:
        "A confirmation is recorded for this request. Review its details in Wajo before making plans around it.",
      next: "Check the venue, date, time, and party size against the confirmation in Wajo.",
    };
  if (booking.status === "cancelled")
    return {
      ...base,
      title: "Request marked cancelled",
      explanation:
        "This request is marked cancelled. Check Wajo to verify whether any scheduled call or restaurant reservation still needs attention.",
      next: "Review the final outcome in Wajo before submitting another request.",
    };
  if (booking.status === "failed")
    return {
      ...base,
      title: "Fo reported a problem",
      explanation:
        "Fo could not complete this request. DayMade has no confirmed reservation to show.",
      next: "Check what happened in Wajo before trying again, so the venue does not receive a duplicate request.",
    };
  if (booking.status === "requested")
    return {
      ...base,
      title: "Approval saved — delivery needs checking",
      explanation:
        "Your approval was saved, but DayMade has not verified whether Fo received the request.",
      next: "Open Wajo and check for this request before sending it again.",
    };

  const scheduledSentence = booking.message
    .split(/(?<=[.!?])\s+|\n+/u)
    .find(
      (sentence) =>
        /\b(?:the call (?:goes|will go) out|(?:i['’]ll|i will|fo will|we['’]ll) (?:place|make|schedule) (?:the |a |your )?(?:reservation )?call|(?:i['’]ll|i will|fo will) call (?:on |at |tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)|(?:phone )?call (?:is |has been )?scheduled)\b/i.test(
          sentence,
        ) &&
        !/\b(?:if|would|could|might|unless|cancelled|canceled|won['’]t|will not|not scheduled)\b/i.test(
          sentence,
        ),
    );
  if (scheduledSentence)
    return {
      ...base,
      title: "Fo plans to call the restaurant later",
      call: "Planned for later, according to Fo",
      evidence: scheduledSentence.trim(),
      explanation:
        "Fo received your request and says it will call later. The restaurant has not confirmed your table in this update.",
      next: "Fo plans to call at the time quoted above and report back with the restaurant’s answer. You do not need to send another request. If this was only a test, stop the scheduled call in Wajo before it runs.",
    };
  if (booking.status === "in_progress")
    return {
      ...base,
      title: "Fo is working on your request",
      explanation:
        "Your request reached Fo. We do not yet have verified call results or a confirmed reservation.",
      next: "Check for an update, or open Wajo to see what Fo is doing. You do not need to send the request again.",
    };
  return {
    ...base,
    title: "Fo replied — reservation still needs review",
    explanation:
      "Fo has sent an update. A completed Fo response does not by itself confirm that a call happened or a table was reserved.",
    next: "Read Fo’s message and open Wajo to check the outcome or answer any questions.",
  };
}
