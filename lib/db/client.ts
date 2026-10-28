import "server-only";
import { createClient } from "@supabase/supabase-js";
export function getDatabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key =
      process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key
    ? createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null;
}
export function persistenceMode() {
  return getDatabase()
    ? "supabase"
    : process.env.NODE_ENV === "production"
      ? "unavailable"
      : "development_memory";
}
