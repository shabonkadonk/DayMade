import "server-only";
import type { Itinerary } from "@/types/itinerary";
import { itinerarySchema } from "@/lib/itinerary/validation";
import { AppError } from "@/lib/api/errors";
import { getDatabase } from "./client";
type Stored = { owner: string; plan: Itinerary; expires: number };
const state = globalThis as typeof globalThis & {
  daymadePlans?: Map<string, Stored>;
};
function memory() {
  if (process.env.NODE_ENV === "production")
    throw new AppError(
      "STORAGE_REQUIRED",
      "Connect Supabase to save and protect plans in production.",
      503,
    );
  const store = (state.daymadePlans ??= new Map());
  for (const [id, item] of store)
    if (item.expires < Date.now()) store.delete(id);
  return store;
}
export async function getItinerary(
  id: string,
  owner: string,
): Promise<Itinerary> {
  const db = getDatabase();
  if (db) {
    const { data, error } = await db
      .from("itineraries")
      .select("payload")
      .eq("id", id)
      .eq("owner_hash", owner)
      .maybeSingle();
    if (error)
      throw new AppError(
        "STORAGE_UNAVAILABLE",
        "Your plan could not be loaded. Please try again.",
        503,
      );
    if (data) return itinerarySchema.parse(data.payload);
  } else {
    const item = memory().get(id);
    if (item?.owner === owner) return structuredClone(item.plan);
  }
  throw new AppError(
    "NOT_FOUND",
    "This plan was not found in your session. Create a new day to get started.",
    404,
  );
}
export async function saveItinerary(
  plan: Itinerary,
  owner: string,
  expectedRevision?: number,
) {
  const db = getDatabase();
  if (db) {
    if (expectedRevision) {
      const { data, error } = await db
        .from("itineraries")
        .update({
          payload: plan,
          revision: plan.revision,
          updated_at: plan.updatedAt,
        })
        .eq("id", plan.id)
        .eq("owner_hash", owner)
        .eq("revision", expectedRevision)
        .select("id");
      if (error?.message.includes("PLAN_HAS_APPROVALS"))
        throw new AppError(
          "PLAN_HAS_APPROVALS",
          "This day has approved requests and is locked. Create a new day for changes; existing requests are not cancelled.",
          409,
        );
      if (error)
        throw new AppError(
          "STORAGE_UNAVAILABLE",
          "Your changes could not be saved.",
          503,
        );
      if (!data?.length)
        throw new AppError(
          "CONFLICT",
          "This plan changed in another tab. Reload before editing.",
          409,
        );
    } else {
      const { error } = await db.from("itineraries").insert({
        id: plan.id,
        owner_hash: owner,
        payload: plan,
        revision: plan.revision,
      });
      if (error)
        throw new AppError(
          "STORAGE_UNAVAILABLE",
          "Your plan could not be saved.",
          503,
        );
    }
  } else {
    const store = memory();
    if (
      expectedRevision &&
      (store.get(plan.id)?.owner !== owner ||
        store.get(plan.id)?.plan.revision !== expectedRevision)
    )
      throw new AppError(
        "CONFLICT",
        "This plan has changed. Reload before editing.",
        409,
      );
    if (store.size >= 500 && !store.has(plan.id))
      throw new AppError(
        "STORAGE_FULL",
        "Development storage is full. Restart the server to clear it.",
        503,
      );
    store.set(plan.id, {
      owner,
      plan: structuredClone(plan),
      expires: Date.now() + 24 * 60 * 60 * 1000,
    });
  }
}

export async function assertPlanEditable(id: string, owner: string) {
  const db = getDatabase();
  if (!db) return;
  const { data, error } = await db
    .from("bookings")
    .select("id")
    .eq("owner_hash", owner)
    .eq("itinerary_id", id)
    .limit(1);
  if (error)
    throw new AppError(
      "STORAGE_UNAVAILABLE",
      "Approval status could not be checked. Please try again.",
      503,
    );
  if (data?.length)
    throw new AppError(
      "PLAN_HAS_APPROVALS",
      "This day has approved requests and is locked. Create a new day for changes; existing requests are not cancelled.",
      409,
    );
}
