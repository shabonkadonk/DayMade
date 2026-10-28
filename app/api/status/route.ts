import { persistenceMode } from "@/lib/db/client";
import { connection } from "next/server";
export async function GET() {
  await connection();
  return Response.json(
    {
      planning: !!(
        process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_MODEL
      ),
      persistence: persistenceMode(),
      map: !!process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN,
      arrangements: !!(
        process.env.NEXT_PUBLIC_SUPABASE_URL &&
        (process.env.SUPABASE_SECRET_KEY ||
          process.env.SUPABASE_SERVICE_ROLE_KEY) &&
        process.env.FO_TOKEN_ENCRYPTION_KEY
      ),
      foAuthentication: "per_user_oauth",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
