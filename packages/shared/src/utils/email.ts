import { SignJWT } from "jose";

const encoder = new TextEncoder();

/**
 * Creates a long-lived unsubscribe link for a given user/subscriber.
 *
 * Disabled for self-hosted Workers deployment (Novu is cloud-only).
 * Kept for API compatibility but always returns null when secrets are absent.
 */
export async function createEmailUnsubscribeLink(
  userId: string,
): Promise<string | null> {
  let baseUrl: string | undefined;
  let secret: string | undefined;

  try {
    baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
    secret = process.env.EMAIL_UNSUBSCRIBE_SECRET;
  } catch {
    return null;
  }

  if (!baseUrl || !secret) {
    return null;
  }

  const token = await new SignJWT({ subscriberId: userId })
    .setProtectedHeader({ alg: "HS256" })
    .sign(encoder.encode(secret));

  return `${baseUrl}/unsubscribe?token=${encodeURIComponent(token)}`;
}
