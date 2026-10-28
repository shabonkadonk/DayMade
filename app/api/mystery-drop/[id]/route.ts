import { guestSession } from "@/lib/api/security";
import { errorResponse } from "@/lib/api/errors";
import { getDrop } from "@/lib/mystery-drop/repository";
import { AppError } from "@/lib/api/errors";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new AppError("INVALID_ID", "Invalid Mystery Drop ID.", 400);
    const drop = await getDrop(id, await guestSession());
    const { ownerHash: _owner, ...publicDrop } = drop; void _owner;
    return Response.json({ drop: publicDrop }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return errorResponse(error); }
}
