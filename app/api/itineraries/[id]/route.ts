import { z } from "zod";
import { getItinerary } from "@/lib/db/repository";
import { persistenceMode } from "@/lib/db/client";
import { guestSession } from "@/lib/api/security";
import { errorResponse } from "@/lib/api/errors";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const id = z.uuid().parse((await params).id);
    const owner = await guestSession();
    return Response.json(
      {
        itinerary: await getItinerary(id, owner),
        persistence: persistenceMode(),
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
