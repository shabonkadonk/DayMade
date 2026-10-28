import { ZodError } from "zod";
export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 400,
    public details?: string[],
  ) {
    super(message);
  }
}
export function errorResponse(error: unknown) {
  if (error instanceof AppError)
    return Response.json(
      {
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
        },
      },
      { status: error.status, headers: { "Cache-Control": "no-store" } },
    );
  if (error instanceof ZodError)
    return Response.json(
      {
        error: {
          code: "INVALID_REQUEST",
          message: "Check the request details and try again.",
          details: error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
        },
      },
      { status: 400 },
    );
  console.error("DayMade request failed", {
    type: error instanceof Error ? error.name : "UnknownError",
    ...(process.env.NODE_ENV !== "production" && error instanceof Error
      ? { message: error.message }
      : {}),
  });
  return Response.json(
    {
      error: {
        code: "INTERNAL_ERROR",
        message: "Something went wrong. Please try again.",
      },
    },
    { status: 500 },
  );
}
