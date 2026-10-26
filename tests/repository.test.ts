import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/db/client", () => ({ getDatabase: () => null }));
import { getItinerary, saveItinerary } from "@/lib/db/repository";
import { fixture } from "./fixtures";
afterEach(() => vi.unstubAllEnvs());
describe("private guest storage", () => {
  it("protects plans from other guests", async () => {
    vi.stubEnv("NODE_ENV", "development");
    await saveItinerary(fixture(), "owner-a");
    expect(await getItinerary(fixture().id, "owner-a")).toEqual(fixture());
    await expect(getItinerary(fixture().id, "owner-b")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
  it("prevents stale writes", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const plan = fixture();
    await saveItinerary(plan, "owner");
    await saveItinerary({ ...plan, revision: 2 }, "owner", 1);
    await expect(
      saveItinerary({ ...plan, revision: 2 }, "owner", 1),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });
  it("refuses local memory as a production database", async () => {
    vi.stubEnv("NODE_ENV", "production");
    await expect(saveItinerary(fixture(), "owner")).rejects.toMatchObject({
      code: "STORAGE_REQUIRED",
    });
  });
});
