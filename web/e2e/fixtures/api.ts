import { expect, type APIRequestContext } from "@playwright/test";

import { E2E_API_URL } from "../env";

export { E2E_API_URL };

export type HealthResponse = { status: string };

/** Assert the FastAPI health endpoint is reachable and healthy. */
export async function checkApiHealth(request: APIRequestContext): Promise<HealthResponse> {
  const response = await request.get(`${E2E_API_URL}/health`);
  expect(response.ok(), `GET /health failed: ${response.status()}`).toBeTruthy();
  const body = (await response.json()) as HealthResponse;
  expect(body.status).toBe("ok");
  return body;
}

/** Wait until the API answers health checks (used when servers are already running). */
export async function waitForApiHealth(
  request: APIRequestContext,
  timeoutMs = 60_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      await checkApiHealth(request);
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  throw lastError ?? new Error("API health check timed out");
}
