import { Hono } from "hono";

import { assertPermission } from "@kan/api/utils/permissions";
import * as userRepo from "@kan/db/repository/user.repo";
import * as cardRepo from "@kan/db/repository/card.repo";
import * as cardActivityRepo from "@kan/db/repository/cardActivity.repo";
import * as cardAttachmentRepo from "@kan/db/repository/cardAttachment.repo";
import { generateUID } from "@kan/shared/utils";

import { getAuthenticatedUser, ALLOWED_AVATAR_TYPES, MAX_AVATAR_BYTES, MAX_ATTACHMENT_BYTES } from "../helpers";

import type { Env } from "../types";

const files = new Hono<{ Bindings: Env }>();

// ---------------------------------------------------------------------------
// File upload — avatar (authenticated, stores to R2, updates user.image)
// ---------------------------------------------------------------------------

files.post("/api/upload/avatar", async (c) => {
  const { user, db } = await getAuthenticatedUser(c);
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const contentType = c.req.header("content-type") ?? "";
  if (!ALLOWED_AVATAR_TYPES.has(contentType)) {
    return c.json({ error: "Invalid content type" }, 400);
  }

  const body = await c.req.raw.arrayBuffer();
  if (body.byteLength > MAX_AVATAR_BYTES) {
    return c.json({ error: "File too large" }, 400);
  }

  // Build key from user ID + original filename header (or fallback)
  const originalFilename =
    (c.req.header("x-original-filename") ?? "file")
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .substring(0, 200);
  const key = `${user.id}/${originalFilename}`;

  await c.env.AVATARS_BUCKET.put(key, body, {
    httpMetadata: { contentType },
  });

  // Persist the R2 key in the user record
  await userRepo.update(db, user.id, { image: key });

  return c.json({ key });
});

// ---------------------------------------------------------------------------
// File serving — avatar (public, cached)
// ---------------------------------------------------------------------------

files.get("/api/avatar/*", async (c) => {
  const key = c.req.path.replace("/api/avatar/", "");
  if (!key) {
    return c.json({ error: "Missing key" }, 400);
  }

  const object = await c.env.AVATARS_BUCKET.get(key);
  if (!object) {
    return c.json({ error: "Not found" }, 404);
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  // Cache avatars for 1 hour, allow stale for 1 day
  headers.set("cache-control", "public, max-age=3600, stale-while-revalidate=86400");

  return new Response(object.body, { headers });
});

// ---------------------------------------------------------------------------
// File upload — attachment (authenticated, stores to R2, creates DB record)
// ---------------------------------------------------------------------------

files.post("/api/upload/attachment", async (c) => {
  const { user, db } = await getAuthenticatedUser(c);
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const cardPublicId = c.req.query("cardPublicId");
  if (!cardPublicId || cardPublicId.length < 12) {
    return c.json({ error: "Invalid cardPublicId" }, 400);
  }

  const contentType = c.req.header("content-type") ?? "application/octet-stream";
  const body = await c.req.raw.arrayBuffer();
  if (body.byteLength > MAX_ATTACHMENT_BYTES) {
    return c.json({ error: "File too large" }, 400);
  }

  const rawFilename = c.req.header("x-original-filename") ?? "file";
  const sanitizedFilename = rawFilename
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .substring(0, 200);

  // Verify card exists and user has permission
  const card = await cardRepo.getWorkspaceAndCardIdByCardPublicId(db, cardPublicId);
  if (!card) {
    return c.json({ error: "Card not found" }, 404);
  }

  try {
    await assertPermission(db, user.id, card.workspaceId, "card:edit");
  } catch {
    return c.json({ error: "Permission denied" }, 403);
  }

  const s3Key = `${card.workspaceId}/${cardPublicId}/${generateUID()}-${sanitizedFilename}`;

  await c.env.ATTACHMENTS_BUCKET.put(s3Key, body, {
    httpMetadata: { contentType },
  });

  // Create attachment record and log activity
  const attachment = await cardAttachmentRepo.create(db, {
    cardId: card.id,
    filename: sanitizedFilename,
    originalFilename: rawFilename,
    contentType,
    size: body.byteLength,
    s3Key,
    createdBy: user.id,
  });

  if (!attachment) {
    return c.json({ error: "Failed to create attachment record" }, 500);
  }

  await cardActivityRepo.create(db, {
    type: "card.updated.attachment.added",
    cardId: card.id,
    attachmentId: attachment.id,
    toTitle: rawFilename,
    createdBy: user.id,
  });

  return c.json({ attachment });
});

// ---------------------------------------------------------------------------
// File download — attachment
// ---------------------------------------------------------------------------

files.get("/api/download/attachment", async (c) => {
  const key = c.req.query("key");
  if (!key) {
    return c.json({ error: "Missing key parameter" }, 400);
  }

  const object = await c.env.ATTACHMENTS_BUCKET.get(key);
  if (!object) {
    return c.json({ error: "Not found" }, 404);
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);

  return new Response(object.body, { headers });
});

export default files;
