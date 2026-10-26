import { guestSession, readBody } from "@/lib/api/security";
import { errorResponse, AppError } from "@/lib/api/errors";
import { foDatabase } from "@/lib/fo/credentials";
export async function POST(request: Request) {
  try {
    await readBody(request);
    const owner = await guestSession();
    const { error } = await foDatabase()
      .from("fo_credentials")
      .delete()
      .eq("owner_hash", owner);
    if (error)
      throw new AppError(
        "FO_STORAGE_UNAVAILABLE",
        "Wajo could not be disconnected. Try again.",
        503,
      );
    return Response.json(
      { disconnected: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
