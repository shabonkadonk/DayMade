import { guestSession, rateLimit, readBody } from "@/lib/api/security";
import { errorResponse } from "@/lib/api/errors";
import { dropInputSchema } from "@/lib/mystery-drop/types";
import { discoverProducts } from "@/lib/mystery-drop/discover";
import { createDrop } from "@/lib/mystery-drop/repository";
export const maxDuration = 120;
export async function POST(request: Request) {
  try {
    const input = dropInputSchema.parse(await readBody(request));
    const owner = await guestSession(true);
    await rateLimit(owner, request);
    const candidates = await discoverProducts(input);
    const drop = await createDrop(owner, input, candidates);
    const { ownerHash: _owner, ...publicDrop } = drop;
    void _owner;
    return Response.json({ drop: publicDrop }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return errorResponse(error); }
}
