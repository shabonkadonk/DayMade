import { auth } from "@modelcontextprotocol/sdk/client/auth.js";
import { guestSession } from "@/lib/api/security";
import { AppError, errorResponse } from "@/lib/api/errors";
import { consumeCredentials } from "@/lib/fo/credentials";
import {
  appOrigin,
  FoOAuthProvider,
  FO_URL,
  foMetadata,
  wajoFetch,
} from "@/lib/fo/oauth";
export async function GET(request: Request) {
  try {
    const url = new URL(request.url),
      owner = await guestSession(),
      state = url.searchParams.get("state");
    if (!state || !/^[a-f0-9]{64}$/.test(state))
      throw new AppError(
        "FO_INVALID_STATE",
        "Start Wajo sign-in again from DayMade.",
        400,
      );
    const origin = appOrigin(request);
    const value = await consumeCredentials(owner, state);
    if (value.redirectUrl !== origin + "/api/fo/callback")
      throw new AppError(
        "FO_INVALID_STATE",
        "Return to the DayMade address where you started sign-in.",
        400,
      );
    if (url.searchParams.has("error"))
      return Response.redirect(
        origin + "/connections/fo?result=cancelled",
        303,
      );
    const code = url.searchParams.get("code");
    if (!code || code.length > 4096)
      throw new AppError(
        "FO_AUTH_FAILED",
        "Wajo did not return an authorization code.",
        400,
      );
    const provider = new FoOAuthProvider(owner, value);
    const result = await auth(provider, {
      serverUrl: FO_URL,
      authorizationCode: code,
      resourceMetadataUrl: foMetadata,
      fetchFn: wajoFetch,
    });
    if (result !== "AUTHORIZED")
      throw new AppError(
        "FO_AUTH_FAILED",
        "Wajo sign-in needs to be restarted.",
        401,
      );
    return Response.redirect(origin + value.returnTo, 303);
  } catch (error) {
    return errorResponse(
      error instanceof AppError
        ? error
        : new AppError(
            "FO_AUTH_FAILED",
            "Wajo sign-in could not be completed. Return to DayMade and try connecting again.",
            502,
          ),
    );
  }
}
