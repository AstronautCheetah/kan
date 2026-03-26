import type { NextApiRequest, NextApiResponse } from "next";

export interface RateLimitOptions {
  points?: number;
  duration?: number;
  identifier?: (req: NextApiRequest) => string | Promise<string>;
  errorMessage?: string;
}

// On Cloudflare Workers, rate limiting should be handled at the
// Cloudflare level (Rate Limiting Rules) or via Upstash.
// This is a pass-through wrapper that preserves the API surface.
export function withRateLimit(
  _options: RateLimitOptions,
  handler: (
    req: NextApiRequest,
    res: NextApiResponse,
  ) => Promise<unknown> | unknown,
) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    return await handler(req, res);
  };
}
