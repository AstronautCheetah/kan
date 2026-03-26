export interface Env {
  // D1 database
  DB: D1Database;

  // R2 buckets
  AVATARS_BUCKET: R2Bucket;
  ATTACHMENTS_BUCKET: R2Bucket;

  // KV namespaces
  RATE_LIMIT: KVNamespace;

  // Workers Assets binding
  ASSETS: Fetcher;

  // Secrets (set via `wrangler secret put`)
  BETTER_AUTH_SECRET: string;
  ENCRYPTION_KEY: string;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  STRIPE_WEBHOOK_SECRET_LEGACY?: string;
  STRIPE_PRO_PLAN_MONTHLY_PRICE_ID?: string;

  // Email (fetch-based service)
  EMAIL_API_KEY?: string;
  EMAIL_FROM?: string;

  // App config
  BASE_URL: string;
  KAN_ENV?: string;
  KAN_ADMIN_API_KEY?: string;

  // S3-compatible storage (R2 via S3 API)
  S3_REGION?: string;
  S3_ENDPOINT?: string;
  S3_ACCESS_KEY_ID?: string;
  S3_SECRET_ACCESS_KEY?: string;
  AVATARS_BUCKET_NAME?: string;
  ATTACHMENTS_BUCKET_NAME?: string;
  STORAGE_DOMAIN?: string;
}
