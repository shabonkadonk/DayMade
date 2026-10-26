import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { AppError } from "@/lib/api/errors";
export function anthropicEndpoint() {
  const testEndpoint = process.env.DAYMADE_TEST_ANTHROPIC_BASE_URL;
  if (!testEndpoint) return "https://api.anthropic.com";
  let url: URL;
  try {
    url = new URL(testEndpoint);
  } catch {
    throw new AppError(
      "AI_CONFIGURATION_REQUIRED",
      "The local test provider URL is invalid.",
      503,
    );
  }
  if (
    !["development", "test"].includes(process.env.NODE_ENV ?? "") ||
    url.protocol !== "http:" ||
    !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new AppError(
      "AI_CONFIGURATION_REQUIRED",
      "The test provider is only allowed on localhost in development or tests. Remove DAYMADE_TEST_ANTHROPIC_BASE_URL for live planning.",
      503,
    );
  }
  return url.toString().replace(/\/$/, "");
}
export function getAnthropic() {
  if (!process.env.ANTHROPIC_API_KEY || !process.env.ANTHROPIC_MODEL)
    throw new AppError(
      "AI_CONFIGURATION_REQUIRED",
      "DayMade needs its Claude connection. Add ANTHROPIC_API_KEY and ANTHROPIC_MODEL to the server environment, then restart the app.",
      503,
    );
  return new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    // The SDK otherwise honors an inherited ANTHROPIC_BASE_URL, which may silently
    // route a real API key to an unrelated gateway without web-search support.
    baseURL: anthropicEndpoint(),
    timeout: 60000,
    maxRetries: 1,
  });
}
export function providerError(error: unknown): never {
  if (error instanceof AppError) throw error;
  if (error instanceof Anthropic.RateLimitError)
    throw new AppError(
      "AI_RATE_LIMITED",
      "Claude is busy. Please wait a moment and try again.",
      429,
    );
  if (error instanceof Anthropic.AuthenticationError)
    throw new AppError(
      "AI_AUTHENTICATION_FAILED",
      "The server's Claude credentials need attention. Check the API key.",
      503,
    );
  if (error instanceof Anthropic.APIConnectionTimeoutError)
    throw new AppError(
      "AI_TIMEOUT",
      "Planning took too long. Try a smaller time window or try again.",
      504,
    );
  if (error instanceof Anthropic.APIUserAbortError)
    throw new AppError(
      "AI_TIMEOUT",
      "Research took too long. Please try a smaller request.",
      504,
    );
  if (error instanceof Anthropic.APIConnectionError)
    throw new AppError(
      "AI_CONNECTION_FAILED",
      "DayMade couldn't reach Anthropic. Check the server's internet connection and try again.",
      502,
    );
  if (error instanceof Anthropic.NotFoundError)
    throw new AppError(
      "AI_MODEL_UNAVAILABLE",
      "The configured Claude model is not available to this API key. Choose a model available in your Anthropic Console.",
      503,
    );
  throw new AppError(
    "AI_UNAVAILABLE",
    "Claude could not complete this plan. Check the configured model and web search access, then try again.",
    502,
  );
}
