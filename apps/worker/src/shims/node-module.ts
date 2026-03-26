/**
 * Shim for `node:module` in Cloudflare Workers.
 *
 * better-auth's bundled code calls `createRequire(import.meta.url)` at module
 * init time. In the Worker bundle, `import.meta.url` is undefined, causing a
 * crash.  Since esbuild has already resolved all imports, the resulting
 * `__require` is never actually called — so a no-op is safe.
 */
export function createRequire(_url?: string) {
  return function require(id: string) {
    throw new Error(`require("${id}") is not available in Cloudflare Workers`);
  };
}
