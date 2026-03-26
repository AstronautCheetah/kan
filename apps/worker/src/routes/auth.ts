import { Hono } from "hono";

import { initAuth } from "@kan/auth/server";
import { createD1Drizzle } from "../d1-drizzle";
import { polyfillProcessEnv } from "../env-polyfill";
import { makeAvatarUploader } from "../helpers";

import type { Env } from "../types";

const auth = new Hono<{ Bindings: Env }>();

// ---------------------------------------------------------------------------
// Better Auth — handles /api/auth/*
// ---------------------------------------------------------------------------

auth.all("/api/auth/*", async (c) => {
  polyfillProcessEnv(c.env);

  const db = createD1Drizzle(c.env.DB);
  const betterAuth = initAuth(
    db,
    c.env as unknown as Record<string, string | undefined>,
    { avatarUploader: makeAvatarUploader(c.env) },
  );
  return betterAuth.handler(c.req.raw);
});

export default auth;
