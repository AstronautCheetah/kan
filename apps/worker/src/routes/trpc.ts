import { Hono } from "hono";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";

import { appRouter } from "@kan/api";
import { initAuth } from "@kan/auth/server";
import { createD1Drizzle } from "../d1-drizzle";
import { polyfillProcessEnv } from "../env-polyfill";

import type { Env } from "../types";

const trpc = new Hono<{ Bindings: Env }>();

// ---------------------------------------------------------------------------
// Shared: build the auth wrapper and storage used by both tRPC and REST
// ---------------------------------------------------------------------------

function buildAuthAndStorage(c: { env: Env; req: { raw: Request } }) {
  const db = createD1Drizzle(c.env.DB);
  const baseAuth = initAuth(db, c.env as unknown as Record<string, string | undefined>);
  const headers = c.req.raw.headers;

  const auth = {
    api: {
      getSession: () => baseAuth.api.getSession({ headers }),
      signInMagicLink: (input: { email: string; callbackURL: string }) =>
        baseAuth.api.signInMagicLink({
          headers,
          body: { email: input.email, callbackURL: input.callbackURL },
        }),
      listActiveSubscriptions: (input: { workspacePublicId: string }) =>
        baseAuth.api.listActiveSubscriptions({
          headers,
          query: { referenceId: input.workspacePublicId },
        }),
    },
  };

  const storage = {
    deleteAttachment: async (key: string) => {
      await c.env.ATTACHMENTS_BUCKET.delete(key);
    },
  };

  return { db, auth, headers, storage };
}

// ---------------------------------------------------------------------------
// tRPC — handles /api/trpc/*
// ---------------------------------------------------------------------------

trpc.all("/api/trpc/*", async (c) => {
  polyfillProcessEnv(c.env);

  const { db, auth, headers, storage } = buildAuthAndStorage(c);
  const session = await auth.api.getSession();

  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req: c.req.raw,
    router: appRouter,
    createContext: () => ({
      user: session?.user ?? null,
      db,
      auth,
      headers,
      transport: "trpc" as const,
      storage,
      requestId: crypto.randomUUID(),
    }),
  });
});

// ---------------------------------------------------------------------------
// REST API (OpenAPI) — handles /api/v1/*
// ---------------------------------------------------------------------------

trpc.all("/api/v1/*", async (c) => {
  polyfillProcessEnv(c.env);

  const { db, auth, headers, storage } = buildAuthAndStorage(c);

  let session: Awaited<ReturnType<typeof auth.api.getSession>> | null = null;
  try {
    session = await auth.api.getSession();
  } catch {
    // Treat as unauthenticated
  }

  return fetchRequestHandler({
    endpoint: "/api/v1",
    req: c.req.raw,
    router: appRouter,
    createContext: () => ({
      user: session?.user ?? null,
      db,
      auth,
      headers,
      transport: "rest" as const,
      storage,
      requestId: crypto.randomUUID(),
    }),
  });
});

export default trpc;
