import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { AppError } from "./errors";
import { getDatabase } from "@/lib/db/client";
export async function guestSession(create = false) {
  const jar = await cookies();
  let token = jar.get("daymade_guest")?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) {
    if (!create)
      throw new AppError(
        "NOT_FOUND",
        "This plan is unavailable in this browser session.",
        404,
      );
    token = randomBytes(32).toString("hex");
    jar.set("daymade_guest", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
  }
  return createHash("sha256").update(token).digest("hex");
}
const rateGlobal = globalThis as typeof globalThis & {
  daymadeRates?: Map<string, { count: number; reset: number }>;
};
export async function rateLimit(owner: string, request: Request) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const ipHash = createHash("sha256").update(ip).digest("hex");
  const database = getDatabase();
  if (database) {
    for (const key of [`session:${owner}`, `ip:${ipHash}`]) {
      const { data, error } = await database.rpc("daymade_rate_limit", {
        rate_key: key,
        max_requests: key.startsWith("ip:") ? 30 : 8,
      });
      if (error)
        throw new AppError(
          "STORAGE_UNAVAILABLE",
          "Request protection is unavailable. Please try again later.",
          503,
        );
      if (!data)
        throw new AppError(
          "RATE_LIMITED",
          "A few too many requests. Please wait a minute and try again.",
          429,
        );
    }
    return;
  }
  const rates = (rateGlobal.daymadeRates ??= new Map()),
    now = Date.now();
  for (const [key, value] of rates) if (value.reset <= now) rates.delete(key);
  for (const key of [owner, ipHash]) {
    const entry = rates.get(key) ?? { count: 0, reset: now + 60000 };
    entry.count += 1;
    rates.set(key, entry);
    if (entry.count > (key === owner ? 8 : 30))
      throw new AppError(
        "RATE_LIMITED",
        "Please wait a minute before planning again.",
        429,
      );
  }
}
export async function readBody(request: Request): Promise<unknown> {
  const origin = request.headers.get("origin");
  // Next's internal URL may use localhost even when the browser visits 127.0.0.1.
  // Host is set by the browser; never accept an arbitrary forwarded-host header.
  // Behind an HTTPS tunnel, the request reaches the dev server over localhost,
  // while the browser Origin is the public tunnel URL. Use the explicitly
  // configured public origin in that case.
  const configuredOrigin = process.env.DAYMADE_APP_URL;
  const expectedOrigin = new URL(configuredOrigin || request.url);
  if (!configuredOrigin)
    expectedOrigin.host = request.headers.get("host") ?? expectedOrigin.host;
  if (origin && origin !== expectedOrigin.origin)
    throw new AppError(
      "INVALID_ORIGIN",
      "Please submit this action from DayMade.",
      403,
    );
  if (!request.headers.get("content-type")?.includes("application/json"))
    throw new AppError(
      "INVALID_CONTENT_TYPE",
      "A JSON request is required.",
      415,
    );
  const reader = request.body?.getReader();
  if (!reader)
    throw new AppError("INVALID_REQUEST", "A request body is required.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 16384) {
      await reader.cancel();
      throw new AppError(
        "REQUEST_TOO_LARGE",
        "Please use a shorter request.",
        413,
      );
    }
    chunks.push(value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new AppError("INVALID_JSON", "The request could not be read.");
  }
}
