import { beforeEach, describe, expect, it, vi } from "vitest";
import { fixture } from "./fixtures";
import { bookingRequestSchema } from "@/lib/bookings/permissions";
import { arrangeActivity, type BookingStore } from "@/lib/bookings/service";
import { canTransition, statusFromFo } from "@/lib/bookings/states";
import type { Booking } from "@/types/booking";
import type { FoService } from "@/lib/fo/types";
const input = () => ({
  itineraryId: fixture().id,
  revision: 1,
  activityId: "lunch",
  idempotencyKey: "17f24125-28fe-4eb7-a6a2-dd77879f490f",
  approval: {
    action: "contact_and_request_reservation" as const,
    consent: true as const,
    maximumSpend: 0 as const,
  },
});
let records: Map<string, Booking>, fo: FoService, store: BookingStore;
beforeEach(() => {
  records = new Map();
  fo = {
    getCapabilities: () => ({ available: true }),
    requestReservation: vi.fn(async () => ({
      status: "working" as const,
      conversationId: "server-issued-task",
      progress: "Checking details",
    })),
    getTaskStatus: vi.fn(),
  };
  store = {
    async claim(booking, owner) {
      const key = `${owner}:${booking.itineraryId}:${booking.activityId}`;
      const prior = records.get(key);
      if (prior) return { booking: prior, inserted: false };
      records.set(key, structuredClone(booking));
      return { booking, inserted: true };
    },
    async save(booking, owner) {
      records.set(
        `${owner}:${booking.itineraryId}:${booking.activityId}`,
        structuredClone(booking),
      );
    },
  };
});
describe("approval enforcement", () => {
  it("shares only explicitly approved contact fields and rejects extra personal data", async () => {
    const request = {
      ...input(),
      approval: {
        ...input().approval,
        contact: { name: "Test Guest", phone: "+16085551234" },
      },
    };
    const booking = await arrangeActivity(
      request,
      fixture(),
      "owner",
      fo,
      store,
    );
    expect(booking.approvedContact).toEqual(request.approval.contact);
    expect(
      JSON.parse(vi.mocked(fo.requestReservation).mock.calls[0][0])
        .approvedContact,
    ).toEqual(request.approval.contact);
    expect(
      bookingRequestSchema.safeParse({
        ...request,
        approval: {
          ...request.approval,
          contact: {
            ...request.approval.contact,
            email: "unapproved@example.org",
          },
        },
      }).success,
    ).toBe(false);
  });
  it("rejects absent consent and payment authorization", () => {
    expect(
      bookingRequestSchema.safeParse({
        ...input(),
        approval: { ...input().approval, consent: false },
      }).success,
    ).toBe(false);
    expect(
      bookingRequestSchema.safeParse({
        ...input(),
        approval: { ...input().approval, maximumSpend: 10 },
      }).success,
    ).toBe(false);
  });
  it("rejects stale plan approvals before any external call", async () => {
    await expect(
      arrangeActivity(
        { ...input(), revision: 2 },
        fixture(),
        "owner",
        fo,
        store,
      ),
    ).rejects.toMatchObject({ code: "STALE_APPROVAL" });
    expect(fo.requestReservation).not.toHaveBeenCalled();
  });
  it("rejects activities without a reservation action", async () => {
    await expect(
      arrangeActivity(
        { ...input(), activityId: "walk" },
        fixture(),
        "owner",
        fo,
        store,
      ),
    ).rejects.toMatchObject({ code: "INVALID_ACTIVITY" });
  });
  it("fails honestly when OAuth is unavailable without saving an approval", async () => {
    fo.getCapabilities = () => ({ available: false, reason: "Connect OAuth" });
    await expect(
      arrangeActivity(input(), fixture(), "owner", fo, store),
    ).rejects.toMatchObject({ code: "FO_AUTHENTICATION_REQUIRED" });
    expect(records.size).toBe(0);
    expect(fo.requestReservation).not.toHaveBeenCalled();
  });
  it("records the immutable action before sending to Fo", async () => {
    fo.requestReservation = vi.fn(async (message: string) => {
      expect([...records.values()][0]).toMatchObject({
        status: "requested",
        maximumSpend: 0,
        approvedAction: "contact_and_request_reservation",
      });
      expect(JSON.parse(message)).toMatchObject({
        venue: "Fixture venue",
        maximumSpend: 0,
        partySize: 2,
      });
      return {
        status: "complete" as const,
        conversationId: "real-task",
        response: "Request complete",
      };
    });
    const booking = await arrangeActivity(
      input(),
      fixture(),
      "owner",
      fo,
      store,
    );
    expect(booking.status).toBe("requires_user_action");
  });
});
describe("retry and state protection", () => {
  it("deduplicates concurrent requests even with different keys", async () => {
    await Promise.all([
      arrangeActivity(input(), fixture(), "owner", fo, store),
      arrangeActivity(
        { ...input(), idempotencyKey: "4d73c7e1-697b-41fe-aac4-c1bc490957a9" },
        fixture(),
        "owner",
        fo,
        store,
      ),
    ]);
    expect(fo.requestReservation).toHaveBeenCalledTimes(1);
  });
  it("does not call Fo when approval persistence fails", async () => {
    store.claim = vi.fn(async () => {
      throw new Error("DB down");
    });
    await expect(
      arrangeActivity(input(), fixture(), "owner", fo, store),
    ).rejects.toThrow("DB down");
    expect(fo.requestReservation).not.toHaveBeenCalled();
  });
  it("does not resend an ambiguous external failure", async () => {
    fo.requestReservation = vi.fn(async () => {
      throw new Error("network timeout");
    });
    const first = await arrangeActivity(input(), fixture(), "owner", fo, store);
    const second = await arrangeActivity(
      input(),
      fixture(),
      "owner",
      fo,
      store,
    );
    expect(first.status).toBe("requires_user_action");
    expect(second.id).toBe(first.id);
    expect(fo.requestReservation).toHaveBeenCalledTimes(1);
  });
  it("never turns a completed Fo turn into a confirmed booking", () =>
    expect(
      statusFromFo({
        status: "complete",
        conversationId: "real",
        response: "Confirmed!",
      }),
    ).toBe("requires_user_action"));
  it("handles working and failed Fo replies", () => {
    expect(statusFromFo({ status: "working", conversationId: "real" })).toBe(
      "in_progress",
    );
    expect(statusFromFo({ status: "failed", conversationId: "real" })).toBe(
      "failed",
    );
  });
  it("forbids invalid terminal transitions", () => {
    expect(canTransition("confirmed", "requested")).toBe(false);
    expect(canTransition("requested", "confirmed")).toBe(false);
    expect(canTransition("in_progress", "awaiting_confirmation")).toBe(true);
  });
});
