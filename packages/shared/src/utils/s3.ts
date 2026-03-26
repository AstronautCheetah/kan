/**
 * Storage URL helpers for Cloudflare Workers deployment.
 *
 * The Worker serves files from R2 buckets via its own endpoints:
 *   - Avatars:      GET /api/avatar/{key}
 *   - Attachments:  GET /api/download/attachment?key={key}
 *
 * The old S3 presigned-URL functions (createS3Client, generateUploadUrl,
 * generateDownloadUrl, deleteObject) have been removed because uploads and
 * deletes now go through R2 bindings in the Worker directly.
 *
 * These functions return plain strings (not Promises) but callers may still
 * `await` the result — awaiting a non-Promise is a no-op in JS.
 */

/**
 * Generate a browser-usable URL for an avatar image.
 *
 * - Full URLs (http/https, e.g. from OAuth providers) are returned as-is.
 * - R2 keys are converted to the Worker's serving path: `/api/avatar/{key}`.
 * - Null/undefined → null.
 */
export function generateAvatarUrl(
  imageKey: string | null | undefined,
): string | null {
  if (!imageKey) {
    return null;
  }

  if (imageKey.startsWith("http://") || imageKey.startsWith("https://")) {
    return imageKey;
  }

  // R2 key — return the Worker-served path
  return `/api/avatar/${imageKey}`;
}

/**
 * Generate a browser-usable URL for an attachment.
 *
 * Attachments are served by the Worker at:
 *   GET /api/download/attachment?key={key}
 */
export function generateAttachmentUrl(
  attachmentKey: string | null | undefined,
): string | null {
  if (!attachmentKey) {
    return null;
  }

  return `/api/download/attachment?key=${encodeURIComponent(attachmentKey)}`;
}
