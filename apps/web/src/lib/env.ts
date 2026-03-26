/**
 * Read a NEXT_PUBLIC_* environment variable.
 *
 * In the browser, values come from window.__ENV which is populated by the
 * static /__ENV.js file generated at build time (see scripts/gen-env.cjs)
 * and also served dynamically by the Worker.
 *
 * On the server (or during SSG), values come from process.env.
 */
export function env(key: string): string | undefined {
  if (typeof window !== "undefined" && (window as Record<string, unknown>).__ENV) {
    return ((window as Record<string, unknown>).__ENV as Record<string, string>)[key];
  }
  // Server-side / build-time fallback
  try {
    return (process.env as Record<string, string | undefined>)[key];
  } catch {
    return undefined;
  }
}
