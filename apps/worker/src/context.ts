import type { Context } from "hono";
import { drizzle } from "drizzle-orm/d1";

import { initAuth } from "@kan/auth/server";
import * as schema from "@kan/db/schema";

import type { Env } from "./types";

export function createWorkerContext(c: Context<{ Bindings: Env }>) {
  const db = drizzle(c.env.DB, { schema });
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

  return {
    db,
    auth,
    baseAuth,
    headers,
    env: c.env,
  };
}
