import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import type {
  OAuthClientInformationMixed,
  OAuthTokens,
} from "@modelcontextprotocol/sdk/shared/auth.js";
import { getDatabase } from "@/lib/db/client";
import { AppError } from "@/lib/api/errors";
export interface Credentials {
  redirectUrl: string;
  returnTo: string;
  client?: OAuthClientInformationMixed;
  tokens?: OAuthTokens;
  expiresAt?: number;
  state?: string;
  verifier?: string;
}
function key() {
  const value = process.env.FO_TOKEN_ENCRYPTION_KEY;
  if (!value || !/^[a-f0-9]{64}$/i.test(value))
    throw new AppError(
      "FO_SETUP_REQUIRED",
      "Set FO_TOKEN_ENCRYPTION_KEY to a random 64-character hex value before connecting Wajo.",
      503,
    );
  return Buffer.from(value, "hex");
}
export function encryptCredentials(owner: string, value: Credentials) {
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", key(), iv);
  cipher.setAAD(Buffer.from(owner));
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(value), "utf8"),
    cipher.final(),
  ]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64");
}
export function decryptCredentials(owner: string, value: string): Credentials {
  const data = Buffer.from(value, "base64"),
    decipher = createDecipheriv("aes-256-gcm", key(), data.subarray(0, 12));
  decipher.setAAD(Buffer.from(owner));
  decipher.setAuthTag(data.subarray(12, 28));
  return JSON.parse(
    Buffer.concat([
      decipher.update(data.subarray(28)),
      decipher.final(),
    ]).toString("utf8"),
  );
}
export function foDatabase() {
  key();
  const db = getDatabase();
  if (!db)
    throw new AppError(
      "FO_SETUP_REQUIRED",
      "Add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to .env.local, then apply the Supabase migrations before connecting Fo.",
      503,
    );
  return db;
}
export async function loadCredentials(owner: string) {
  const { data, error } = await foDatabase()
    .from("fo_credentials")
    .select("encrypted_payload")
    .eq("owner_hash", owner)
    .maybeSingle();
  if (error)
    throw new AppError(
      "FO_STORAGE_REQUIRED",
      "Apply the DayMade Supabase migrations before connecting Fo.",
      503,
    );
  return data ? decryptCredentials(owner, data.encrypted_payload) : undefined;
}
export async function saveCredentials(owner: string, value: Credentials) {
  const { error } = await foDatabase()
    .from("fo_credentials")
    .upsert({
      owner_hash: owner,
      encrypted_payload: encryptCredentials(owner, value),
      pending_state: value.state ?? null,
      pending_expires_at: value.state
        ? new Date(Date.now() + 600000).toISOString()
        : null,
      updated_at: new Date().toISOString(),
    });
  if (error)
    throw new AppError(
      "FO_STORAGE_UNAVAILABLE",
      "Your Wajo connection could not be saved securely.",
      503,
    );
}
export async function consumeCredentials(owner: string, state: string) {
  const { data, error } = await foDatabase()
    .from("fo_credentials")
    .update({ pending_state: null, pending_expires_at: null })
    .eq("owner_hash", owner)
    .eq("pending_state", state)
    .gt("pending_expires_at", new Date().toISOString())
    .select("encrypted_payload")
    .maybeSingle();
  if (error || !data)
    throw new AppError(
      "FO_INVALID_STATE",
      "This Wajo sign-in expired or was already used. Start again from DayMade.",
      400,
    );
  const value = decryptCredentials(owner, data.encrypted_payload);
  delete value.state;
  return value;
}
