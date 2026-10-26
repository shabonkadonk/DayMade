import "server-only";
import { randomBytes } from "node:crypto";
import {
  auth,
  type OAuthClientProvider,
} from "@modelcontextprotocol/sdk/client/auth.js";
import { AppError } from "@/lib/api/errors";
import {
  loadCredentials,
  saveCredentials,
  type Credentials,
} from "./credentials";
export const FO_URL = "https://mcp.api.wajo.ai/fo";
export const foMetadata = new URL(
  "https://mcp.api.wajo.ai/.well-known/oauth-protected-resource/fo",
);
export function appOrigin(request: Request) {
  const configured = process.env.DAYMADE_APP_URL;
  const url = new URL(configured || request.url);
  if (!configured) url.host = request.headers.get("host") ?? url.host;
  if (
    url.username ||
    url.password ||
    (configured && (url.search || url.hash || url.pathname !== "/"))
  )
    throw new AppError(
      "FO_ORIGIN_REQUIRED",
      "DAYMADE_APP_URL must be your app's origin.",
      503,
    );
  if (
    process.env.NODE_ENV === "production"
      ? !configured || url.protocol !== "https:"
      : !(
          url.protocol === "https:" ||
          (url.protocol === "http:" &&
            ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))
        )
  )
    throw new AppError(
      "FO_ORIGIN_REQUIRED",
      "Wajo requires an HTTPS callback for sign-in from another device. Open DayMade through an HTTPS tunnel and set DAYMADE_APP_URL to that HTTPS origin. Localhost HTTP is allowed only on this computer.",
      503,
    );
  return url.origin;
}
// OAuth metadata and credentials are only ever exchanged with the verified Wajo host.
export const wajoFetch: typeof fetch = async (input, init) => {
  const url = new URL(input instanceof Request ? input.url : String(input));
  if (url.origin !== "https://mcp.api.wajo.ai" || url.username || url.password)
    throw new AppError(
      "FO_UNTRUSTED_ENDPOINT",
      "Wajo returned an unexpected authentication endpoint.",
      503,
    );
  const callerSignal =
    init?.signal ?? (input instanceof Request ? input.signal : undefined);
  const deadline = AbortSignal.timeout(url.pathname === "/fo" ? 60000 : 20000);
  return fetch(input, {
    ...init,
    redirect: "error",
    signal: callerSignal ? AbortSignal.any([callerSignal, deadline]) : deadline,
  });
};
export class FoOAuthProvider implements OAuthClientProvider {
  authorizationUrl?: URL;
  constructor(
    private owner: string,
    public value: Credentials,
    private interactive = false,
  ) {}
  get redirectUrl() {
    return this.value.redirectUrl;
  }
  get clientMetadata() {
    return {
      client_name: "DayMade",
      redirect_uris: [this.redirectUrl],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
      scope: "mcp",
    };
  }
  state() {
    return this.value.state ?? "";
  }
  clientInformation() {
    return this.value.client;
  }
  async saveClientInformation(value: NonNullable<Credentials["client"]>) {
    this.value.client = value;
    await this.save();
  }
  tokens() {
    return this.value.tokens;
  }
  async saveTokens(value: NonNullable<Credentials["tokens"]>) {
    this.value.tokens = value;
    this.value.expiresAt = value.expires_in
      ? Date.now() + value.expires_in * 1000
      : undefined;
    delete this.value.state;
    delete this.value.verifier;
    await this.save();
  }
  async redirectToAuthorization(url: URL) {
    if (!this.interactive)
      throw new AppError(
        "FO_RECONNECT_REQUIRED",
        "Reconnect Wajo from the Fo connection page.",
        401,
      );
    if (
      url.origin !== "https://mcp.api.wajo.ai" ||
      url.pathname !== "/oauth/authorize"
    )
      throw new AppError(
        "FO_UNTRUSTED_ENDPOINT",
        "Wajo returned an unexpected sign-in URL.",
        503,
      );
    this.authorizationUrl = url;
  }
  async saveCodeVerifier(value: string) {
    this.value.verifier = value;
    await this.save();
  }
  codeVerifier() {
    if (!this.value.verifier)
      throw new AppError("FO_INVALID_STATE", "Start Wajo sign-in again.", 400);
    return this.value.verifier;
  }
  async invalidateCredentials(scope: string) {
    if (scope === "all" || scope === "tokens") delete this.value.tokens;
    if (scope === "all" || scope === "client") delete this.value.client;
    if (scope === "all" || scope === "verifier") delete this.value.verifier;
    await this.save();
  }
  private save() {
    return saveCredentials(this.owner, this.value);
  }
}
export async function startFoLogin(
  owner: string,
  origin: string,
  returnTo: string,
) {
  const previous = await loadCredentials(owner);
  const redirectUrl = origin + "/api/fo/callback";
  const provider = new FoOAuthProvider(
    owner,
    {
      redirectUrl,
      returnTo,
      state: randomBytes(32).toString("hex"),
      client:
        previous?.redirectUrl === redirectUrl ? previous.client : undefined,
    },
    true,
  );
  await saveCredentials(owner, provider.value);
  await auth(provider, {
    serverUrl: FO_URL,
    scope: "mcp",
    resourceMetadataUrl: foMetadata,
    fetchFn: wajoFetch,
  });
  if (!provider.authorizationUrl)
    throw new AppError(
      "FO_AUTH_FAILED",
      "Wajo sign-in could not be started.",
      502,
    );
  return provider.authorizationUrl;
}
export async function authorizedProvider(owner: string) {
  const value = await loadCredentials(owner);
  if (!value?.tokens)
    throw new AppError(
      "FO_AUTHENTICATION_REQUIRED",
      "Connect your Wajo account before contacting a business.",
      401,
    );
  const provider = new FoOAuthProvider(owner, value);
  if (value.expiresAt && value.expiresAt < Date.now() + 30000)
    await auth(provider, {
      serverUrl: FO_URL,
      scope: "mcp",
      resourceMetadataUrl: foMetadata,
      fetchFn: wajoFetch,
    });
  return provider;
}
