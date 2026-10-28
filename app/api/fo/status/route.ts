import { guestSession } from "@/lib/api/security";
import { AppError, errorResponse } from "@/lib/api/errors";
import { loadCredentials } from "@/lib/fo/credentials";
import { connection } from "next/server";
export async function GET() {
  await connection();
  try {
    if (
      !process.env.NEXT_PUBLIC_SUPABASE_URL ||
      !(
        process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
      ) ||
      !process.env.FO_TOKEN_ENCRYPTION_KEY
    )
      return Response.json(
        {
          connected: false,
          ready: false,
          message:
            "Add the Supabase values to .env.local and apply the SQL migrations to enable Fo sign-in.",
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    let owner: string;
    try {
      owner = await guestSession();
    } catch {
      return Response.json(
        { connected: false, ready: true },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    const value = await loadCredentials(owner);
    return Response.json(
      { connected: !!value?.tokens, ready: true },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return errorResponse(
      error instanceof AppError
        ? error
        : new AppError(
            "FO_STORAGE_UNAVAILABLE",
            "The Fo connection could not be checked.",
            503,
          ),
    );
  }
}
