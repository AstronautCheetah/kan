import { Hono } from "hono";

import type { Env } from "./types";

import authRoutes from "./routes/auth";
import trpcRoutes from "./routes/trpc";
import filesRoutes from "./routes/files";
import stripeRoutes from "./routes/stripe";
import spaRoutes from "./routes/spa";

const app = new Hono<{ Bindings: Env }>();

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------

app.get("/api/health", (c) => {
  return c.json({ status: "ok" });
});

// ---------------------------------------------------------------------------
// Route modules
// ---------------------------------------------------------------------------

app.route("/", authRoutes);
app.route("/", trpcRoutes);
app.route("/", filesRoutes);
app.route("/", stripeRoutes);

// SPA fallback MUST be last (catch-all)
app.route("/", spaRoutes);

export default app;
