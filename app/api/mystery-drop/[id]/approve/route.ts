import { z } from "zod";
import { guestSession, rateLimit, readBody } from "@/lib/api/security";
import { errorResponse, AppError } from "@/lib/api/errors";
import { approveDrop } from "@/lib/mystery-drop/repository";
const schema = z.object({ confirm: z.literal(true), maximumAmountCents: z.number().int().positive() });
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const body = schema.parse(await readBody(request));
    const owner = await guestSession(); await rateLimit(owner, request);
    await approveDrop((await params).id, owner, body.maximumAmountCents);
    throw new AppError("PAYMENT_UNAVAILABLE", "Payment unavailable.", 503);
  } catch (error) { return errorResponse(error); }
}
