# TODO

## Frontend requires rebuild on env change

`__ENV.js` is generated at build time by `scripts/gen-env.cjs` and served as a
static asset. Changing any `NEXT_PUBLIC_*` variable requires a full
`pnpm build:web` before the change takes effect.

**Why it's like this:** The Cloudflare Assets layer serves static files directly
— it intercepts requests before they reach Hono. So the Worker's dynamic
`GET /__ENV.js` route (in `routes/spa.ts`) never runs for pages that exist in
`out/`.

**Possible fix:** Switch `not_found_handling` back to `"single-page-application"`
in `wrangler.toml` and serve *all* HTML through the Hono SPA catch-all (which
injects `window.__ENV` into `<head>`). This would let env vars change without
rebuilding, but it means every page load goes through the Worker instead of being
served directly from the edge cache. Needs benchmarking to see if the latency
trade-off is acceptable.

**Alternative:** Use Cloudflare's asset transform rules or a custom domain with
Workers Routes to intercept only `/__ENV.js` while letting everything else be
served by the Assets layer. More complex to set up but avoids the latency hit.
