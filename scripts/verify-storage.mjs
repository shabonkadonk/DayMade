// Explicit live-storage check: isolated test owner; no Fo or other external actions.
import { createClient } from "@supabase/supabase-js";
import { randomUUID, createHash } from "node:crypto";
import assert from "node:assert/strict";
const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);
const owner = createHash("sha256").update(randomUUID()).digest("hex"),
  id = randomUUID();
const approval = {
  id: randomUUID(),
  itineraryId: id,
  activityId: "isolated-storage-test",
  revision: 1,
  idempotencyKey: randomUUID(),
  status: "requested",
  approvedAt: new Date().toISOString(),
  approvedAction: "contact_and_request_reservation",
  maximumSpend: 0,
  externalTaskId: null,
  message: "Storage integrity test only; no external request.",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};
try {
  const inserted = await db.from("itineraries").insert({
    id,
    owner_hash: owner,
    revision: 1,
    payload: { title: "Storage integrity test only" },
  });
  assert.equal(inserted.error, null);
  const stale = await db.rpc("daymade_claim_booking", {
    guest_owner: owner,
    approval: { ...approval, revision: 2 },
  });
  assert.match(stale.error?.message ?? "", /STALE_APPROVAL/);
  const results = await Promise.all(
    [
      approval,
      { ...approval, id: randomUUID(), idempotencyKey: randomUUID() },
    ].map((a) =>
      db.rpc("daymade_claim_booking", { approval: a, guest_owner: owner }),
    ),
  );
  for (const result of results) assert.equal(result.error, null);
  assert.equal(results.filter((r) => r.data.inserted).length, 1);
  assert.equal(results[0].data.booking.id, results[1].data.booking.id);
  const edited = await db
    .from("itineraries")
    .update({ revision: 2 })
    .eq("id", id)
    .eq("owner_hash", owner);
  assert.match(edited.error?.message ?? "", /PLAN_HAS_APPROVALS/);
  const other = {
    ...approval,
    id: randomUUID(),
    activityId: "another-action",
    idempotencyKey: randomUUID(),
  };
  const busy = await db.rpc("daymade_claim_booking", {
    approval: other,
    guest_owner: owner,
  });
  assert.match(busy.error?.message ?? "", /FO_ACTION_IN_PROGRESS/);
  const wrongOwner = await db.rpc("daymade_claim_booking", {
    approval,
    guest_owner: "0".repeat(64),
  });
  assert.match(wrongOwner.error?.message ?? "", /PLAN_NOT_FOUND/);
  console.log(
    "Live Supabase checks passed: stale approval, concurrent deduplication, plan locking, single active action, owner isolation. No Fo calls made.",
  );
} finally {
  const removed = await db
    .from("bookings")
    .delete()
    .eq("owner_hash", owner)
    .eq("itinerary_id", id);
  const planRemoved = await db
    .from("itineraries")
    .delete()
    .eq("owner_hash", owner)
    .eq("id", id);
  if (removed.error || planRemoved.error)
    throw new Error("Isolated storage test cleanup failed.");
}
