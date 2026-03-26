import { initAuth } from "@kan/auth/server";
import { createD1Drizzle } from "./d1-drizzle";

import type { Env } from "./types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const ALLOWED_AVATAR_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export const MAX_AVATAR_BYTES = 2 * 1024 * 1024; // 2 MB
export const MAX_ATTACHMENT_BYTES = 50 * 1024 * 1024; // 50 MB

// ---------------------------------------------------------------------------
// Auth helper
// ---------------------------------------------------------------------------

/** Authenticate a request via Better Auth session cookie. */
export async function getAuthenticatedUser(c: { env: Env; req: { raw: Request } }) {
  const db = createD1Drizzle(c.env.DB);
  const auth = initAuth(db, c.env as unknown as Record<string, string | undefined>);
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  return { user: session?.user ?? null, db };
}

// ---------------------------------------------------------------------------
// Avatar uploader factory
// ---------------------------------------------------------------------------

/** Create an avatarUploader backed by the R2 AVATARS_BUCKET binding. */
export function makeAvatarUploader(env: Env) {
  return async (key: string, body: Uint8Array, contentType: string) => {
    await env.AVATARS_BUCKET.put(key, body, {
      httpMetadata: { contentType },
    });
  };
}
