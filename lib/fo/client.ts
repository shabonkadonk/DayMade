import "server-only";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { OAuthClientProvider } from "@modelcontextprotocol/sdk/client/auth.js";
import { AppError } from "@/lib/api/errors";
import { foReplySchema } from "./types";
import { FO_URL, wajoFetch } from "./oauth";

// Provider must hold this guest's own OAuth tokens. Never use a shared account for guests.
export async function connectFo(authProvider?: OAuthClientProvider) {
  const url = new URL(FO_URL);
  if (url.protocol !== "https:")
    throw new AppError(
      "FO_CONFIGURATION",
      "Fo requires a secure MCP endpoint.",
      503,
    );
  const transport = new StreamableHTTPClientTransport(url, {
    authProvider,
    fetch: wajoFetch,
  });
  const client = new Client(
    { name: "daymade", version: "0.1.0" },
    { capabilities: {} },
  );
  try {
    await client.connect(transport, { timeout: 15000 });
    return client;
  } catch (error) {
    await client.close().catch(() => {});
    throw error;
  }
}
export async function callFo(
  client: Client,
  name: "ask_fo" | "get_fo_reply",
  args: Record<string, unknown>,
) {
  try {
    const result = await client.callTool({ name, arguments: args }, undefined, {
      timeout: 55000,
    });
    if (result.isError)
      throw new AppError(
        "FO_REQUEST_FAILED",
        "Fo could not complete the request. Review your Wajo connection before retrying.",
        502,
      );
    const content = result.structuredContent;
    if (!content)
      throw new AppError(
        "FO_INVALID_RESPONSE",
        "Fo returned an unrecognized response. The outcome needs manual review.",
        502,
      );
    return foReplySchema.parse(content);
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      "FO_UNAVAILABLE",
      "Fo's response could not be verified. Do not resubmit an action until its outcome is checked.",
      502,
    );
  }
}
