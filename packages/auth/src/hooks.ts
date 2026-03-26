import { createAuthMiddleware } from "better-auth/api";

import type { dbClient } from "@kan/db/client";
import * as memberRepo from "@kan/db/repository/member.repo";
import * as userRepo from "@kan/db/repository/user.repo";
import { createLogger } from "@kan/logger";

const log = createLogger("auth");

import { downloadImage } from "./utils";

type BetterAuthUser = {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  email: string;
  emailVerified: boolean;
  name: string;
  image?: string | null | undefined;
  stripeCustomerId?: string | null | undefined;
} & Record<string, unknown>;

/**
 * Upload an avatar image to storage.
 * Accepts the raw bytes and returns the storage key.
 */
export type AvatarUploader = (
  key: string,
  body: Uint8Array,
  contentType: string,
) => Promise<void>;

export interface DatabaseHooksOptions {
  env: (key: string) => string | undefined;
  avatarUploader?: AvatarUploader;
}

export function createDatabaseHooks(db: dbClient, options: DatabaseHooksOptions) {
  const { env, avatarUploader } = options;

  return {
    user: {
      create: {
        async before(user: BetterAuthUser, _context: unknown) {
          if (env("NEXT_PUBLIC_DISABLE_SIGN_UP")?.toLowerCase() === "true") {
            const pendingInvitation = await memberRepo.getByEmailAndStatus(
              db,
              user.email,
              "invited",
            );

            if (!pendingInvitation) {
              return Promise.resolve(false);
            }
          }
          // Enforce allowed domains (OIDC/social) if configured
          const allowed = env("BETTER_AUTH_ALLOWED_DOMAINS")?.split(",")
            .map((d) => d.trim().toLowerCase())
            .filter(Boolean);
          if (allowed && allowed.length > 0) {
            const domain = user.email.split("@")[1]?.toLowerCase();
            if (!domain || !allowed.includes(domain)) {
              return Promise.resolve(false);
            }
          }
          return Promise.resolve(true);
        },
        async after(user: BetterAuthUser, _context: unknown) {
          // Re-upload social provider avatar to our own storage
          if (user.image && avatarUploader) {
            try {
              const allowedFileExtensions = ["jpg", "jpeg", "png", "webp"];
              const fileExtension =
                user.image.split(".").pop()?.split("?")[0] ?? "jpg";
              const ext = allowedFileExtensions.includes(fileExtension)
                ? fileExtension
                : "jpg";
              const key = `${user.id}/avatar.${ext}`;
              const contentType = `image/${ext === "jpg" ? "jpeg" : ext}`;

              const imageBuffer = await downloadImage(user.image);

              await avatarUploader(key, imageBuffer, contentType);

              await userRepo.update(db, user.id, { image: key });

              log.info({ userId: user.id, key }, "Social avatar re-uploaded to storage");
            } catch (error) {
              log.error({ err: error, userId: user.id }, "Failed to re-upload social avatar");
            }
          }
        },
      },
    },
  };
}

export function createMiddlewareHooks(db: dbClient, _env: (key: string) => string | undefined) {
  return {
    after: createAuthMiddleware(async (ctx) => {
      if (
        ctx.path === "/magic-link/verify" &&
        (ctx.query?.callbackURL as string | undefined)?.includes("type=invite")
      ) {
        const userId = ctx.context.newSession?.session.userId;
        const callbackURL = ctx.query?.callbackURL as string | undefined;
        const memberPublicId = callbackURL?.split("memberPublicId=")[1];

        if (userId && memberPublicId) {
          const member = await memberRepo.getByPublicId(db, memberPublicId);

          if (member?.id) {
            await memberRepo.acceptInvite(db, {
              memberId: member.id,
              userId,
            });
          }
        }
      }
    }),
  };
}
