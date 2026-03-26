import { Hono } from "hono";

import { createLogger } from "@kan/logger";
import { createStripeClient } from "@kan/stripe";
import * as workspaceRepo from "@kan/db/repository/workspace.repo";

import { createD1Drizzle } from "../d1-drizzle";
import { getAuthenticatedUser } from "../helpers";

import type { Env } from "../types";

const stripe = new Hono<{ Bindings: Env }>();

const stripeLog = createLogger("stripe-webhook");

// ---------------------------------------------------------------------------
// Stripe — legacy webhook handler
//
// Better Auth's Stripe plugin already handles webhooks via
// POST /api/auth/stripe/webhook (subscription lifecycle events).
//
// This legacy endpoint handles checkout.session.completed with a separate
// secret (STRIPE_WEBHOOK_SECRET_LEGACY) for backwards compatibility with
// existing Stripe dashboard webhook configurations.
//
// Point Stripe dashboard to POST /api/auth/stripe/webhook for the primary
// webhook, and optionally keep this endpoint during migration.
// ---------------------------------------------------------------------------

stripe.post("/api/stripe/webhook", async (c) => {
  const webhookSecret = c.env.STRIPE_WEBHOOK_SECRET_LEGACY ?? c.env.STRIPE_WEBHOOK_SECRET;
  if (!c.env.STRIPE_SECRET_KEY || !webhookSecret) {
    return c.json({ error: "Stripe not configured" }, 500);
  }

  const sig = c.req.header("stripe-signature");
  if (!sig) {
    return c.json({ error: "No signature found" }, 400);
  }

  try {
    const stripeClient = createStripeClient();

    // On Workers: use request.text() instead of Node.js stream buffering
    const rawBody = await c.req.raw.text();

    // Stripe SDK v18+ has constructEventAsync; older versions only have sync constructEvent
    const event = typeof stripeClient.webhooks.constructEventAsync === "function"
      ? await stripeClient.webhooks.constructEventAsync(rawBody, sig, webhookSecret)
      : stripeClient.webhooks.constructEvent(rawBody, sig, webhookSecret);

    const db = createD1Drizzle(c.env.DB);

    stripeLog.info({ eventType: event.type, eventId: event.id }, "Stripe webhook received");

    switch (event.type) {
      case "checkout.session.completed": {
        const checkoutSession = event.data.object;
        const metaData = checkoutSession.metadata;

        if (metaData?.workspacePublicId) {
          await workspaceRepo.update(db, metaData.workspacePublicId, {
            ...(metaData.workspaceSlug && { slug: metaData.workspaceSlug }),
            plan: "pro",
          });
        }
        break;
      }
      default:
        stripeLog.warn({ eventType: event.type }, "Unhandled Stripe event type");
    }

    return c.json({ received: true });
  } catch (err) {
    stripeLog.error({ err }, "Stripe webhook handler failed");
    return c.json({ error: "Webhook handler failed" }, 400);
  }
});

// ---------------------------------------------------------------------------
// Stripe — create checkout session (authenticated)
// ---------------------------------------------------------------------------

stripe.post("/api/stripe/create-checkout-session", async (c) => {
  const { user } = await getAuthenticatedUser(c);
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  if (!c.env.STRIPE_SECRET_KEY) {
    return c.json({ error: "Stripe not configured" }, 500);
  }

  try {
    const stripeClient = createStripeClient();

    const body = await c.req.json<{
      successUrl?: string;
      cancelUrl?: string;
      slug?: string;
      workspacePublicId?: string;
    }>();

    const { successUrl, cancelUrl, workspacePublicId, slug } = body;
    if (!successUrl || !cancelUrl || !workspacePublicId) {
      return c.json({ error: "Missing required fields" }, 400);
    }

    const baseUrl = c.env.BASE_URL ?? "";

    const session = await stripeClient.checkout.sessions.create({
      mode: "subscription",
      payment_method_collection: "always",
      line_items: [
        {
          price: c.env.STRIPE_PRO_PLAN_MONTHLY_PRICE_ID,
          quantity: 1,
        },
      ],
      subscription_data: { trial_period_days: 14 },
      success_url: `${baseUrl}${successUrl}`,
      cancel_url: `${baseUrl}${cancelUrl}`,
      client_reference_id: workspacePublicId,
      customer: (user as Record<string, unknown>).stripeCustomerId as string | undefined,
      metadata: {
        ...(slug && { workspaceSlug: slug }),
        workspacePublicId,
        userId: user.id,
      },
    });

    return c.json({ url: session.url });
  } catch (error) {
    stripeLog.error({ err: error }, "Error creating checkout session");
    return c.json({ error: "Error creating checkout session" }, 500);
  }
});

// ---------------------------------------------------------------------------
// Stripe — create billing portal session (authenticated)
// ---------------------------------------------------------------------------

stripe.post("/api/stripe/create-billing-session", async (c) => {
  const { user } = await getAuthenticatedUser(c);
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const stripeCustomerId = (user as Record<string, unknown>).stripeCustomerId as string | undefined;
  if (!stripeCustomerId) {
    return c.json({ error: "No billing account found" }, 404);
  }

  if (!c.env.STRIPE_SECRET_KEY) {
    return c.json({ error: "Stripe not configured" }, 500);
  }

  try {
    const stripeClient = createStripeClient();
    const baseUrl = c.env.BASE_URL ?? "";

    const session = await stripeClient.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: `${baseUrl}/settings`,
    });

    return c.json({ url: session.url });
  } catch (error) {
    stripeLog.error({ err: error }, "Error creating billing portal session");
    return c.json({ error: "Error creating portal session" }, 500);
  }
});

export default stripe;
