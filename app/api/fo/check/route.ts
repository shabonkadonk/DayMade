import { guestSession, readBody, rateLimit } from "@/lib/api/security";
import { AppError, errorResponse } from "@/lib/api/errors";
import { verifyFoConnection } from "@/lib/fo/service";
export const maxDuration = 60;
export async function POST(request: Request) {
  try {
    await readBody(request);
    const owner = await guestSession();
    await rateLimit(owner, request);
    return Response.json(await verifyFoConnection(owner), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return errorResponse(
      error instanceof AppError
        ? error
        : new AppError(
            "FO_AUTH_FAILED",
            "The Wajo connection check failed. Try reconnecting.",
            502,
          ),
    );
  }
}
