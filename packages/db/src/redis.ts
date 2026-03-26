// Redis replaced with no-op for Cloudflare Workers compatibility.
// Rate limiting uses Cloudflare KV or is handled externally.

export function getRedisClient(): null {
  return null;
}

export async function closeRedisClient(): Promise<void> {
  // no-op
}
