import type { Env } from "./types";

/**
 * Copy string-valued Worker bindings into process.env so that libraries
 * which read process.env (Better Auth, its plugins, shared utils) work
 * correctly in the Cloudflare Workers runtime.
 *
 * Call this once at the start of handlers that need it (auth, tRPC) —
 * NOT on every request.
 */
export function polyfillProcessEnv(env: Env) {
  for (const [key, value] of Object.entries(env)) {
    if (typeof value === "string") {
      process.env[key] = value;
    }
  }
}
