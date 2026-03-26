import { Hono } from "hono";

import type { Env } from "../types";

const spa = new Hono<{ Bindings: Env }>();

// ---------------------------------------------------------------------------
// Runtime env injection for the static frontend (next-runtime-env)
// The static export includes <script src="/__ENV.js"> which expects
// window.__ENV to contain all NEXT_PUBLIC_* variables.
// ---------------------------------------------------------------------------

function buildEnvScript(env: Env): string {
  const publicEnv: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    if (key.startsWith("NEXT_PUBLIC_") && typeof value === "string") {
      publicEnv[key] = value;
    }
  }
  return `<script>window.__ENV = ${JSON.stringify(publicEnv)};</script>`;
}

spa.get("/__ENV.js", (c) => {
  const publicEnv: Record<string, string> = {};
  for (const [key, value] of Object.entries(c.env)) {
    if (key.startsWith("NEXT_PUBLIC_") && typeof value === "string") {
      publicEnv[key] = value;
    }
  }
  return new Response(`window.__ENV = ${JSON.stringify(publicEnv)};`, {
    headers: {
      "content-type": "application/javascript; charset=utf-8",
      "cache-control": "no-cache",
    },
  });
});

// ---------------------------------------------------------------------------
// SPA fallback — serve static assets, mapping dynamic URLs to the correct
// pre-rendered HTML shell from Next.js static export.
//
// Next.js Pages Router static export produces files like:
//   boards/[...boardId].html   — for /boards/<anything>
//   [workspaceSlug].html       — for /<slug> and /<slug>/<board>
//   templates/[boardId].html   — for /templates/<id>
//   cards/[cardId].html        — for /cards/<id>
//   invite/[code].html         — for /invite/<code>
//
// Each file contains __NEXT_DATA__ with the correct page identifier so the
// React app hydrates the right component. Serving index.html as a fallback
// would hydrate the home/marketing page instead of the requested route.
//
// Injects window.__ENV into HTML responses so the env() shim can read
// NEXT_PUBLIC_* vars on the client.
// This MUST be the last route (catch-all).
// ---------------------------------------------------------------------------

// Maps URL path patterns to their pre-rendered HTML files.
// Order matters — first match wins.
const DYNAMIC_ROUTES: Array<{ match: RegExp; file: string }> = [
  { match: /^\/boards\/.+/, file: "/boards/[...boardId].html" },
  { match: /^\/templates\/[^/]+\/cards\/.+/, file: "/templates/[boardId]/cards/[cardId].html" },
  { match: /^\/templates\/.+/, file: "/templates/[boardId].html" },
  { match: /^\/cards\/.+/, file: "/cards/[cardId].html" },
  { match: /^\/invite\/.+/, file: "/invite/[code].html" },
  // /<workspaceSlug>/... must be last (catch-all for workspace routes)
  { match: /^\/[^/]+\/.*/, file: "/[workspaceSlug]/[...boardSlug].html" },
  { match: /^\/[^/]+$/, file: "/[workspaceSlug].html" },
];

function resolveHtmlFile(pathname: string): string {
  for (const route of DYNAMIC_ROUTES) {
    if (route.match.test(pathname)) {
      return route.file;
    }
  }
  return "/index.html";
}

spa.all("*", async (c) => {
  if (c.req.method !== "GET") {
    return c.json({ error: "Not found" }, 404);
  }

  // Try serving the exact static asset from the ASSETS binding
  let response: Response;
  try {
    response = await c.env.ASSETS.fetch(c.req.raw.clone());
  } catch {
    response = new Response("Not found", { status: 404 });
  }

  // If exact asset not found, resolve to the correct dynamic route HTML
  if (response.status === 404) {
    const url = new URL(c.req.url);
    url.pathname = resolveHtmlFile(url.pathname);
    try {
      response = await c.env.ASSETS.fetch(new Request(url.toString()));
    } catch {
      // Final fallback
      url.pathname = "/index.html";
      response = await c.env.ASSETS.fetch(new Request(url.toString()));
    }
  }

  // Inject window.__ENV into HTML responses
  const ct = response.headers.get("content-type") ?? "";
  if (ct.includes("text/html")) {
    const html = await response.text();
    const injected = html.replace("<head>", `<head>${buildEnvScript(c.env)}`);
    return new Response(injected, {
      status: response.status,
      headers: response.headers,
    });
  }

  return response;
});

export default spa;
