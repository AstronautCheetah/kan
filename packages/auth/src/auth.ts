import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

import type { dbClient } from "@kan/db/client";
import * as schema from "@kan/db/schema";
import { sendEmail } from "@kan/email";

import {  createDatabaseHooks, createMiddlewareHooks } from "./hooks";
import type {AvatarUploader} from "./hooks";
import { createPlugins } from "./plugins";
import { configuredProviders } from "./providers";

export type { AvatarUploader };

// Environment accessor — supports both next-runtime-env and plain env objects
function getEnv(envObj?: Record<string, string | undefined>): (key: string) => string | undefined {
  if (envObj) {
    return (key: string) => envObj[key];
  }
  // Fallback to process.env for non-Worker environments
  return (key: string) => {
    try {
      return process.env[key];
    } catch {
      return undefined;
    }
  };
}

export interface InitAuthOptions {
  avatarUploader?: AvatarUploader;
}

export const initAuth = (
  db: dbClient,
  envObj?: Record<string, string | undefined>,
  options?: InitAuthOptions,
) => {
  const env = getEnv(envObj);
  const baseURL = env("NEXT_PUBLIC_BASE_URL") ?? env("BETTER_AUTH_URL") ?? env("BASE_URL");
  const trustedOrigins =
    env("BETTER_AUTH_TRUSTED_ORIGINS")?.split(",").filter(Boolean) ?? [];

  return betterAuth({
    secret: env("BETTER_AUTH_SECRET"),
    baseURL,
    trustedOrigins: [...(baseURL ? [baseURL] : []), ...trustedOrigins],
    database: drizzleAdapter(db, {
      provider: "sqlite",
      schema: {
        ...schema,
        user: schema.users,
      },
    }),
    session: {
      expiresIn: 60 * 60 * 24 * 30, // 30 days
      updateAge: 60 * 60 * 24 * 2, // Update session expiry every 48 hours if user is active
      freshAge: 0,
    },
    emailAndPassword: {
      enabled: env("NEXT_PUBLIC_ALLOW_CREDENTIALS")?.toLowerCase() === "true",
      // Sign-up restriction is handled by the user.create.before database
      // hook which checks for pending invitations, allowing invited users
      // to register even when public sign-up is disabled.
      disableSignUp: false,
      sendResetPassword: async (data) => {
        await sendEmail(data.user.email, "Reset Password", "RESET_PASSWORD", {
          resetPasswordUrl: data.url,
          resetPasswordToken: data.token,
        });
      },
    },
    socialProviders: configuredProviders,
    user: {
      deleteUser: {
        enabled: true,
      },
      additionalFields: {
        stripeCustomerId: {
          type: "string",
          required: false,
          defaultValue: null,
          input: false,
        },
      },
    },
    plugins: createPlugins(db),
    databaseHooks: createDatabaseHooks(db, {
      env,
      avatarUploader: options?.avatarUploader,
    }),
    hooks: createMiddlewareHooks(db, env),
    advanced: {
      cookiePrefix: "kan",
      database: {
        generateId: false,
      },
    },
  });
};
