import "server-only";
import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type { FoService } from "./types";
import { callFo } from "./client";
import { AppError } from "@/lib/api/errors";
import { authorizedProvider } from "./oauth";
import { connectFo } from "./client";

export class AuthenticatedFoService implements FoService {
  constructor(private client: Client) {}
  getCapabilities() {
    return { available: true };
  }
  requestReservation(message: string) {
    return callFo(this.client, "ask_fo", { message, newConversation: true });
  }
  getTaskStatus(conversationId: string) {
    return callFo(this.client, "get_fo_reply", {
      conversationId,
      waitSeconds: 0,
    });
  }
}
export async function withFo<T>(
  owner: string,
  run: (service: FoService) => Promise<T>,
): Promise<T> {
  const provider = await authorizedProvider(owner);
  const client = await connectFo(provider);
  try {
    return await run(new AuthenticatedFoService(client));
  } finally {
    await client.close().catch(() => {});
  }
}

export async function verifyFoConnection(owner: string) {
  const client = await connectFo(await authorizedProvider(owner));
  try {
    const result = await client.callTool(
      { name: "list_fo_conversations", arguments: {} },
      undefined,
      { timeout: 20000 },
    );
    if (result.isError)
      throw new AppError(
        "FO_AUTH_FAILED",
        "Wajo could not verify this connection. Reconnect before approving any requests.",
        502,
      );
    // Deliberately discard account conversation content: this is only an authentication check.
    return { verified: true };
  } finally {
    await client.close().catch(() => {});
  }
}
