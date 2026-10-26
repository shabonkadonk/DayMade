import "server-only";
import { randomUUID } from "node:crypto";
import { getDatabase } from "@/lib/db/client";
import { AppError } from "@/lib/api/errors";
import type { DropInput, DropProduct, MysteryDrop } from "./types";
import { purchaseableTotal } from "./policy";
import { requireFoPurchaseSupport } from "./fo-adapter";

const g = globalThis as typeof globalThis & { mysteryDrops?: Map<string, MysteryDrop> };
function storageError(error: { code?: string }, operation: "save" | "load") {
  // Log only the provider error code; never serialize a database error object or row data.
  if (error.code) console.error("Mystery Drop storage error", { operation, code: error.code });
  if (error.code === "42P01" || error.code === "PGRST205")
    return new AppError(
      "MYSTERY_DROP_MIGRATION_REQUIRED",
      "Mystery Drop storage is not installed yet. Apply supabase/migrations/003_mystery_drops.sql in your Supabase SQL Editor, then try again.",
      503,
    );
  if (error.code === "42501")
    return new AppError(
      "MYSTERY_DROP_STORAGE_PERMISSION",
      "Supabase denied access to Mystery Drop storage. Check that the server uses the Supabase service key and that migration 003 has been applied.",
      503,
    );
  return new AppError(
    "STORAGE_UNAVAILABLE",
    operation === "save"
      ? "Mystery Drop could not be saved. Check Supabase connectivity and apply migration 003 if you have not already."
      : "Mystery Drop could not be loaded. Check Supabase connectivity and migration 003.",
    503,
  );
}
export async function createDrop(ownerHash: string, input: DropInput, candidates: DropProduct[]) {
  const selected = [...candidates].sort((a, b) => b.score - a.score)[0];
  if (!selected) throw new AppError("NO_CANDIDATES", "No suitable listings were found within the budget.", 422);
  const drop: MysteryDrop = {
    id: randomUUID(), ownerHash, createdAt: new Date().toISOString(), input, candidates,
    selected, status: "BLOCKED_UNSUPPORTED",
    events: [
      { at: new Date().toISOString(), type: "discovery", detail: `Reviewed ${candidates.length} sourced listings.` },
      { at: new Date().toISOString(), type: "selection", detail: `Selected ${selected.name} at ${selected.merchant}.` },
    ],
  };
  const db = getDatabase();
  if (db) {
    const { error } = await db.from("mystery_drops").insert({ id: drop.id, owner_hash: ownerHash, payload: drop });
    if (error) throw storageError(error, "save");
  } else {
    if (process.env.NODE_ENV === "production") throw new AppError("STORAGE_REQUIRED", "Connect Supabase to save Mystery Drops.", 503);
    (g.mysteryDrops ??= new Map()).set(drop.id, drop);
  }
  return drop;
}
export async function getDrop(id: string, ownerHash: string) {
  const db = getDatabase();
  if (db) {
    const { data, error } = await db.from("mystery_drops").select("payload").eq("id", id).eq("owner_hash", ownerHash).maybeSingle();
    if (error) throw storageError(error, "load");
    if (!data) throw new AppError("NOT_FOUND", "Mystery Drop was not found for this session.", 404);
    return data.payload as MysteryDrop;
  }
  const drop = g.mysteryDrops?.get(id);
  if (!drop || drop.ownerHash !== ownerHash) throw new AppError("NOT_FOUND", "Mystery Drop was not found for this session.", 404);
  return drop;
}
export async function approveDrop(id: string, ownerHash: string, amountCents: number): Promise<never> {
  const drop = await getDrop(id, ownerHash);
  if (drop.status === "BLOCKED_UNSUPPORTED") throw new AppError("PAYMENT_UNAVAILABLE", "Fo does not expose the card and transaction capabilities needed to execute this purchase. No payment was attempted.", 503);
  if (drop.status !== "AWAITING_APPROVAL") throw new AppError("INVALID_STATE", "This Mystery Drop is no longer awaiting review.", 409);
  if (amountCents > drop.input.budgetCents || !purchaseableTotal(drop.selected, amountCents))
    throw new AppError("PRICE_UNVERIFIED", "The complete delivered price is not verified within your hard spending limit. No payment was attempted.", 409);
  try { requireFoPurchaseSupport(); } catch (e) { throw new AppError("PAYMENT_UNAVAILABLE", e instanceof Error ? e.message : "Payment unavailable.", 503); }
}
