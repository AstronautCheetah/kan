import type { CreateNextContextOptions } from "@trpc/server/adapters/next";
import type { NextApiRequest } from "next";
import type { OpenApiMeta } from "trpc-to-openapi";
import { initTRPC, TRPCError } from "@trpc/server";
import { env } from "next-runtime-env";
import superjson from "superjson";
import { ZodError } from "zod";

import type { dbClient } from "@kan/db/client";
import type { initAuth } from "@kan/auth/server";
import { createLogger } from "@kan/logger";

const log = createLogger("api");

const TRPC_STATUS_MAP: Partial<Record<TRPCError["code"], number>> = {
  PARSE_ERROR: 400,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_SUPPORTED: 405,
  TIMEOUT: 408,
  CONFLICT: 409,
  PRECONDITION_FAILED: 412,
  PAYLOAD_TOO_LARGE: 413,
  UNPROCESSABLE_CONTENT: 422,
  TOO_MANY_REQUESTS: 429,
  CLIENT_CLOSED_REQUEST: 499,
  INTERNAL_SERVER_ERROR: 500,
  NOT_IMPLEMENTED: 501,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504,
};

export interface User {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
  image?: string | null | undefined;
  stripeCustomerId?: string | null | undefined;
}

/** Shape of the auth API subset exposed to tRPC context. */
export interface AuthApi {
  api: {
    getSession: () => ReturnType<ReturnType<typeof initAuth>["api"]["getSession"]>;
    signInMagicLink: (input: {
      email: string;
      callbackURL: string;
    }) => ReturnType<ReturnType<typeof initAuth>["api"]["signInMagicLink"]>;
    listActiveSubscriptions: (input: {
      workspacePublicId: string;
    }) => ReturnType<ReturnType<typeof initAuth>["api"]["listActiveSubscriptions"]>;
  };
}

/** Storage operations passed from the Worker for R2 access. */
export interface StorageOps {
  deleteAttachment?: (key: string) => Promise<void>;
}

interface CreateContextOptions {
  user: User | null | undefined;
  db: dbClient;
  auth: AuthApi;
  headers: Headers;
  transport?: "trpc" | "rest";
  storage?: StorageOps;
}

export const createInnerTRPCContext = (opts: CreateContextOptions) => {
  return {
    user: opts.user,
    db: opts.db,
    auth: opts.auth,
    headers: opts.headers,
    transport: opts.transport ?? "trpc",
    storage: opts.storage,
    requestId: crypto.randomUUID(),
  };
};

// These context creators are used by the Next.js API routes (dead code on Workers).
// On Workers, context is created directly in apps/worker/src/index.ts.
// They preserve the return type for tRPC type inference but throw at runtime.
// Stub context creators — dead code on Workers. Kept for tRPC type inference.
export const createTRPCContext = (_opts: CreateNextContextOptions) => {
  return createInnerTRPCContext({
    db: undefined as unknown as dbClient,
    user: undefined,
    auth: undefined as unknown as AuthApi,
    headers: new Headers(),
    transport: "trpc",
  });
};

export const createNextApiContext = (_req: NextApiRequest) => {
  return createInnerTRPCContext({
    db: undefined as unknown as dbClient,
    user: undefined,
    auth: undefined as unknown as AuthApi,
    headers: new Headers(),
    transport: "trpc",
  });
};

export const createRESTContext = (_opts: CreateNextContextOptions) => {
  return createInnerTRPCContext({
    db: undefined as unknown as dbClient,
    user: undefined,
    auth: undefined as unknown as AuthApi,
    headers: new Headers(),
    transport: "rest",
  });
};

const t = initTRPC
  .context<typeof createTRPCContext>()
  .meta<OpenApiMeta>()
  .create({
    transformer: superjson,
    errorFormatter({ shape, error }) {
      return {
        ...shape,
        data: {
          ...shape.data,
          zodError:
            error.cause instanceof ZodError ? error.cause.flatten() : null,
        },
      };
    },
  });

export const createTRPCRouter = t.router;

export const createCallerFactory = t.createCallerFactory;

const loggingMiddleware = t.middleware(async ({ path, type, next, ctx, getRawInput }) => {
  const start = Date.now();
  const [result, input] = await Promise.all([next(), getRawInput().catch(() => undefined)]);
  const duration = Date.now() - start;

  const { user, transport, requestId } = ctx as {
    user?: { id: string; email: string };
    transport?: string;
    requestId?: string;
  };
  const isCloud = process.env.NEXT_PUBLIC_KAN_ENV === "cloud";
  const meta = {
    requestId,
    procedure: path,
    type,
    transport,
    duration,
    userId: user?.id,
    ...(isCloud && { email: user?.email }),
    input,
  };

  const label = transport === "rest" ? "REST" : "tRPC";

  if (result.ok) {
    log.info({ ...meta, status: 200 }, `${label} OK`);
  } else {
    const status = TRPC_STATUS_MAP[result.error.code] ?? 500;
    const errorCode = result.error.code;
    log.error(
      { ...meta, status, errorCode, err: result.error },
      `${label} error`,
    );
  }

  return result;
});

export const publicProcedure = t.procedure.use(loggingMiddleware);

const enforceUserIsAuthed = t.middleware(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  return next({
    ctx,
  });
});

const enforceUserIsAdmin = t.middleware(async ({ ctx, next }) => {
  if (ctx.headers.get("x-admin-api-key") !== env("KAN_ADMIN_API_KEY")) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  return next({
    ctx,
  });
});

export const protectedProcedure = t.procedure
  .use(loggingMiddleware)
  .use(enforceUserIsAuthed);

export const adminProtectedProcedure = t.procedure
  .use(loggingMiddleware)
  .use(enforceUserIsAdmin)
  .meta({
    openapi: {
      method: "GET",
      path: "/admin/protected",
    },
  });
