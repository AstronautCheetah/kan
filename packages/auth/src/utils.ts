import type { dbClient } from "@kan/db/client";
import { createLogger } from "@kan/logger";

const log = createLogger("auth");

export async function downloadImage(url: string): Promise<Uint8Array> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.statusText}`);
  }
  return new Uint8Array(await response.arrayBuffer());
}

/**
 * Trigger a Novu notification workflow.
 * Disabled for self-hosted Workers deployment (Novu is cloud-only).
 * Kept as a no-op so plugins.ts can import it without changes.
 */
export function triggerWorkflow(
  _db: dbClient,
  workflowId: string,
  _subscription: unknown,
  _cancellationDetails?: unknown,
) {
  log.debug({ workflowId }, "triggerWorkflow is a no-op in self-hosted mode");
}
