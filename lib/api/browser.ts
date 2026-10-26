export async function apiRequest<T>(
  url: string,
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(url, {
    method: body ? "POST" : "GET",
    credentials: "same-origin",
    cache: "no-store",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    signal,
  });
  if (!response.headers.get("content-type")?.includes("application/json"))
    throw new Error(
      "DayMade is temporarily unavailable. Please refresh the page and try again.",
    );
  const result = await response.json();
  if (!response.ok) {
    const error = new Error(
      [
        result.error?.message ?? "This request could not be completed.",
        ...(result.error?.code === "PLAN_CONSTRAINTS"
          ? (result.error.details ?? [])
              .filter(
                (detail: string) => !result.error.message?.includes(detail),
              )
              .slice(0, 2)
          : []),
      ].join(" "),
    );
    Object.assign(error, {
      code: result.error?.code,
      details: result.error?.details,
    });
    throw error;
  }
  return result;
}
