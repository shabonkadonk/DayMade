// Explicit no-contact integration test. Never imported by the application.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdir, writeFile } from "node:fs/promises";
import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type { Booking } from "@/types/booking";
import type { Itinerary } from "@/types/itinerary";
import { fixture } from "./fixtures";

const sandbox = vi.hoisted(() => ({
  plan: null as Itinerary | null,
  records: new Map<string, { owner: string; booking: Booking }>(),
  callTool: vi.fn(),
  fetch: vi.fn(),
}));
vi.mock("@/lib/api/security", async (original) => ({
  ...(await original<typeof import("@/lib/api/security")>()),
  guestSession: vi.fn(async () => "madison-simulation-owner"),
  rateLimit: vi.fn(async () => {}),
}));
vi.mock("@/lib/db/repository", () => ({
  getItinerary: vi.fn(async () => structuredClone(sandbox.plan)),
}));
vi.mock("@/lib/db/bookings", async (original) => ({
  ...(await original<typeof import("@/lib/db/bookings")>()),
  bookingStore: {
    async claim(booking: Booking, owner: string) {
      const key = `${owner}:${booking.itineraryId}:${booking.activityId}`;
      const prior = sandbox.records.get(key);
      if (prior)
        return { booking: structuredClone(prior.booking), inserted: false };
      sandbox.records.set(key, { owner, booking: structuredClone(booking) });
      return { booking, inserted: true };
    },
    async save(booking: Booking, owner: string) {
      sandbox.records.set(
        `${owner}:${booking.itineraryId}:${booking.activityId}`,
        {
          owner,
          booking: structuredClone(booking),
        },
      );
    },
  },
  async getBooking(id: string, owner: string) {
    const stored = [...sandbox.records.values()].find(
      (r) => r.owner === owner && r.booking.id === id,
    );
    if (!stored) throw new Error("No simulation booking found");
    return structuredClone(stored.booking);
  },
}));
vi.mock("@/lib/fo/service", async (original) => {
  const real = await original<typeof import("@/lib/fo/service")>();
  return {
    ...real,
    // The real adapter and response validator run; the MCP transport cannot connect.
    withFo: async (
      _owner: string,
      run: (
        fo: InstanceType<typeof real.AuthenticatedFoService>,
      ) => Promise<unknown>,
    ) =>
      run(
        new real.AuthenticatedFoService({
          callTool: sandbox.callTool,
        } as unknown as Client),
      ),
  };
});
import { POST as approve } from "@/app/api/bookings/route";
import { POST as refresh, GET as read } from "@/app/api/bookings/[id]/route";

function request(body: unknown) {
  return new Request("http://localhost:3000/api/bookings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "http://localhost:3000",
    },
    body: JSON.stringify(body),
  });
}
beforeEach(() => {
  sandbox.records.clear();
  sandbox.fetch.mockImplementation(() => {
    throw new Error("Network forbidden in this no-contact dry run");
  });
  vi.stubGlobal("fetch", sandbox.fetch);
  const plan = fixture();
  Object.assign(plan, {
    title: "SIMULATION — Madison reservation",
    location: "Madison, Wisconsin",
    date: "2026-10-18",
    startTime: "18:30",
    endTime: "20:00",
    partySize: 3,
  });
  plan.activities = [
    {
      ...plan.activities[0],
      id: "simulation-dinner",
      name: "SIMULATION — vegetarian dinner",
      venueName: "Madison Test Bistro (fictional)",
      address: "Fictional venue in Madison, Wisconsin — test only",
      startTime: "18:30",
      endTime: "19:30",
      sourceUrl: "https://example.org/simulation-only",
    },
  ];
  sandbox.plan = plan;
  sandbox.callTool.mockImplementation(async ({ name, arguments: args }) => {
    if (name === "ask_fo") {
      expect(sandbox.records.size).toBe(1);
      expect([...sandbox.records.values()][0].booking.status).toBe("requested");
      expect(args.newConversation).toBe(true);
      expect(JSON.parse(args.message)).toMatchObject({
        venue: "Madison Test Bistro (fictional)",
        date: "2026-10-18",
        startTime: "18:30",
        partySize: 3,
        maximumSpend: 0,
        approvedContact: { name: "Simulation Guest" },
      });
      return {
        structuredContent: {
          status: "working",
          conversationId: "simulation-only-no-real-fo-task",
          progress:
            "SIMULATION: checking a table for three. No restaurant was contacted.",
        },
      };
    }
    expect(name).toBe("get_fo_reply");
    expect(args).toEqual({
      conversationId: "simulation-only-no-real-fo-task",
      waitSeconds: 0,
    });
    return {
      structuredContent: {
        status: "complete",
        conversationId: "simulation-only-no-real-fo-task",
        response:
          "SIMULATION: the fictional host can accommodate three diners at 6:30 PM and would request a reservation name. No call occurred and no reservation exists.",
      },
    };
  });
});
afterEach(() => vi.unstubAllGlobals());

describe("Madison reservation dry run — zero external contact", () => {
  it("runs approval → real Fo adapter → progress → review, rejecting missing consent and deduplicating retries", async () => {
    const input = {
      itineraryId: sandbox.plan!.id,
      revision: 1,
      activityId: "simulation-dinner",
      idempotencyKey: "17f24125-28fe-4eb7-a6a2-dd77879f490f",
      approval: {
        action: "contact_and_request_reservation",
        consent: true,
        maximumSpend: 0,
        contact: { name: "Simulation Guest" },
      },
    };
    const rejected = await approve(
      request({ ...input, approval: { ...input.approval, consent: false } }),
    );
    expect(rejected.status).toBe(400);
    expect(sandbox.callTool).not.toHaveBeenCalled();

    const response = await approve(request(input));
    expect(response.status).toBe(202);
    const first = (await response.json()).booking;
    expect(first.status).toBe("in_progress");
    expect(first).not.toHaveProperty("externalTaskId");
    expect(first).not.toHaveProperty("idempotencyKey");

    const context = { params: Promise.resolve({ id: first.id }) };
    const updated = await refresh(request({}), context);
    expect(updated.status).toBe(200);
    const completed = (await updated.json()).booking;
    expect(completed.status).toBe("requires_user_action");
    expect(completed.message).toContain(
      "No call occurred and no reservation exists",
    );
    const retry = await approve(
      request({
        ...input,
        idempotencyKey: "4d73c7e1-697b-41fe-aac4-c1bc490957a9",
      }),
    );
    expect(retry.status).toBe(202);
    expect((await retry.json()).booking.id).toBe(first.id);
    const restored = await read(
      new Request("http://localhost:3000/api/bookings/" + first.id),
      context,
    );
    expect((await restored.json()).booking.status).toBe("requires_user_action");
    expect(sandbox.callTool.mock.calls.map(([call]) => call.name)).toEqual([
      "ask_fo",
      "get_fo_reply",
    ]);
    expect(sandbox.records.size).toBe(1);
    expect(sandbox.fetch).not.toHaveBeenCalled();

    if (process.env.DAYMADE_WRITE_DRY_RUN_REPORT === "1") {
      await mkdir("artifacts", { recursive: true });
      await writeFile(
        "artifacts/madison-reservation-dry-run.md",
        `# Madison reservation dry run\n\n**SIMULATION ONLY. Zero network requests, real calls, or reservations.**\n\nScenario: a fictional Madison restaurant, three diners, Sunday October 18, 2026 at 6:30 PM, under the name “Simulation Guest.” Maximum authorized spend: $0.\n\n| Step | Actual test result |\n| --- | --- |\n| Missing consent | HTTP 400; no tool invocation |\n| Approved request | HTTP 202; approval stored before simulated ask_fo |\n| Initial progress | in_progress |\n| Explicit refresh | HTTP 200; simulated get_fo_reply |\n| Completed response | requires_user_action; never marked confirmed |\n| Retry with a different approval key | Same booking; no second ask_fo |\n| Reload stored request | Preserved review status |\n| Network requests | 0 |\n\nSimulated host response:\n\n> ${completed.message}\n\nThis ran the real booking API handlers, approval validation, booking service, Fo adapter, MCP argument construction, structured response parsing, and public result serialization. Guest authentication, persistence, and the MCP transport were controlled test doubles. It does not establish how live Fo or a real restaurant would respond.\n`,
      );
    }
  });
});
