import { describe, expect, it } from "vitest";
import { bookingPresentation } from "@/lib/bookings/presentation";

describe("arrangement status clarity", () => {
  it("separates the real delayed-call wording from restaurant confirmation", () => {
    const message =
      "On it. I verified Steenbock's on Orchard and requested a table for 2 under Bob for Wednesday, Oct 21 at 4:30 PM. They're closed today and tomorrow (weekdays only, 11–7), so the call goes out Monday at 11:00 AM when they open. How this works: I place the call from my own line.";
    const result = bookingPresentation({
      status: "requires_user_action",
      message,
    });
    expect(result.title).toBe("Fo plans to call the restaurant later");
    expect(result.reservation).toBe("Reservation not confirmed");
    expect(result.evidence).toContain("Monday at 11:00 AM");
    expect(result.evidence).not.toContain("Wednesday");
    expect(result.next).toContain("stop the scheduled call in Wajo");
  });
  it.each([
    "If they are closed, I'll place the call Monday.",
    "I would make a call on Monday.",
    "The call is not scheduled.",
    "The call is scheduled but was cancelled.",
    "How this works: I place the call from my own line.",
  ])(
    "does not promote conditional, negated, or explanatory wording to scheduled: %s",
    (message) => {
      expect(
        bookingPresentation({ status: "requires_user_action", message })
          .evidence,
      ).toBeNull();
    },
  );
  it("never promotes free-form confirmation claims to a confirmed status", () => {
    const result = bookingPresentation({
      status: "requires_user_action",
      message: "Confirmed! Your table is reserved.",
    });
    expect(result.reservation).toBe("Reservation not confirmed");
    expect(result.call).toBe("Not verified");
  });
  it("preserves failed status even if old scheduling wording appears in the message", () => {
    const result = bookingPresentation({
      status: "failed",
      message: "Earlier I said the call goes out Monday. The request failed.",
    });
    expect(result.title).toBe("Fo reported a problem");
    expect(result.evidence).toBeNull();
  });
  it("explains uncertain delivery without claiming Fo received a saved request", () => {
    expect(
      bookingPresentation({ status: "requested", message: "Saved" }).title,
    ).toBe("Approval saved — delivery needs checking");
  });
});
