import { guestSession, readBody, rateLimit } from "@/lib/api/security";
import { AppError, errorResponse } from "@/lib/api/errors";
import { appOrigin, startFoLogin } from "@/lib/fo/oauth";
import { z } from "zod";
export const maxDuration = 60;
export async function POST(request: Request) {
  try {
    const input = z
      .object({ returnTo: z.string().max(100).default("/connections/fo") })
      .parse(await readBody(request));
    if (
      !/^\/plan\/[a-f0-9-]{36}$/.test(input.returnTo) &&
      input.returnTo !== "/connections/fo"
    )
      throw new AppError(
        "INVALID_RETURN_PATH",
        "Open the Fo connection page to sign in.",
      );
    const owner = await guestSession(true);
    await rateLimit(owner, request);
    const url = await startFoLogin(owner, appOrigin(request), input.returnTo);
    return Response.json(
      { authorizationUrl: url.toString() },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
