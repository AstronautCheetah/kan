![github-background](https://github.com/user-attachments/assets/f728f52e-bf67-4357-9ba2-c24c437488e3)

> **Cloudflare Workers fork of [Kan](https://github.com/kanbn/kan).** This fork replaces PostgreSQL with D1 (SQLite), S3 with R2, and Node.js with Hono — running entirely on Cloudflare's edge network as a single Worker. See the [original project](https://github.com/kanbn/kan) for the standard Docker/Railway deployment.

<div align="center">
  <h3 align="center">Kan</h3>
  <p>The open-source project management alternative to Trello.</p>
</div>

<p align="center">
  <a href="https://kan.bn/kan/roadmap">Roadmap</a>
  ·
  <a href="https://kan.bn">Website</a>
  ·
  <a href="https://docs.kan.bn">Docs</a>
  ·
  <a href="https://discord.gg/e6ejRb6CmT">Discord</a>
</p>

<div align="center">
  <a href="https://github.com/kanbn/kan/blob/main/LICENSE"><img alt="License" src="https://img.shields.io/badge/license-AGPLv3-purple"></a>
</div>

## Features 💫

- 👁️ **Board Visibility**: Control who can view and edit your boards
- 🤝 **Workspace Members**: Invite members and collaborate with your team
- 🚀 **Trello Imports**: Easily import your Trello boards
- 🔍 **Labels & Filters**: Organise and find cards quickly
- 💬 **Comments**: Discuss and collaborate with your team
- 📝 **Activity Log**: Track all card changes with detailed activity history
- 🎨 **Templates** : Save time with reusable custom board templates
- ⚡️ **Integrations (coming soon)** : Connect your favourite tools

See our [roadmap](https://kan.bn/kan/roadmap) for upcoming features.

## Screenshot 👁️

<img width="1507" alt="hero-dark" src="https://github.com/user-attachments/assets/8490104a-cd5d-49de-afc2-152fd8a93119" />

## Made With

- [Next.js](https://nextjs.org/?ref=kan.bn) (static export for frontend)
- [Hono](https://hono.dev/) (API on Cloudflare Workers)
- [tRPC](https://trpc.io/?ref=kan.bn)
- [Better Auth](https://better-auth.com/?ref=kan.bn)
- [Tailwind CSS](https://tailwindcss.com/?ref=kan.bn)
- [Drizzle ORM](https://orm.drizzle.team/?ref=kan.bn) + [Cloudflare D1](https://developers.cloudflare.com/d1/)
- [Cloudflare R2](https://developers.cloudflare.com/r2/) (file storage)
- [React Email](https://react.email/?ref=kan.bn)

## Self Hosting on Cloudflare Workers

This fork runs entirely on a single Cloudflare Worker that serves both the static frontend and the API. No containers, no VMs, no PostgreSQL — just Cloudflare's edge network.

| Component | Cloudflare Service | Purpose |
|-----------|-------------------|---------|
| Database | D1 (SQLite) | All application data |
| File storage | R2 | Avatars and attachments |
| Rate limiting | KV | Optional request throttling |
| Compute | Workers | API + static site serving |

### Prerequisites

- [Node.js](https://nodejs.org/) >= 20
- [pnpm](https://pnpm.io/) >= 9.14
- A [Cloudflare account](https://dash.cloudflare.com/sign-up) (the free tier is sufficient to get started)

### 1. Clone and install

```bash
git clone https://github.com/AstronautCheetah/kan.git
cd kan
git checkout cloudflare-workers
pnpm install
```

### 2. Create Cloudflare resources

Log in to Wrangler, then create the resources your Worker needs:

```bash
npx wrangler login

# Database
npx wrangler d1 create kan-db

# File storage
npx wrangler r2 bucket create kan-avatars
npx wrangler r2 bucket create kan-attachments

# Rate limiting (optional)
npx wrangler kv namespace create RATE_LIMIT
```

Each command prints an ID. You'll need these in the next step.

### 3. Configure wrangler.toml

Copy the example and fill in your IDs:

```bash
cd apps/worker
cp wrangler.toml.example wrangler.toml
```

Edit `apps/worker/wrangler.toml` and replace the placeholder IDs:

```toml
[[d1_databases]]
binding = “DB”
database_name = “kan-db”
database_id = “<your-database-id>”       # from `wrangler d1 create`

[[kv_namespaces]]
binding = “RATE_LIMIT”
id = “<your-kv-id>”                      # from `wrangler kv namespace create`
```

The R2 bucket names (`kan-avatars`, `kan-attachments`) don't need IDs — just matching names.

### 4. Set secrets

Secrets are encrypted values stored by Cloudflare, never committed to git:

```bash
cd apps/worker

# Required — auth encryption key (random 32+ character string)
npx wrangler secret put BETTER_AUTH_SECRET

# Required — data encryption key (random 32+ character string)
npx wrangler secret put ENCRYPTION_KEY
```

Optional secrets for additional features:

```bash
# Email (Resend API — https://resend.com)
npx wrangler secret put EMAIL_API_KEY
npx wrangler secret put EMAIL_FROM

# Google OAuth
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET

# Stripe payments
npx wrangler secret put STRIPE_SECRET_KEY
npx wrangler secret put STRIPE_WEBHOOK_SECRET
npx wrangler secret put STRIPE_PRO_PLAN_MONTHLY_PRICE_ID

# See “Environment Variables” section below for all options
```

Non-secret configuration goes in the `[vars]` section of `wrangler.toml`:

```toml
[vars]
BASE_URL = “https://your-domain.com”
NEXT_PUBLIC_BASE_URL = “https://your-domain.com”
NEXT_PUBLIC_ALLOW_CREDENTIALS = “true”
```

### 5. Apply database migrations

From the repo root:

```bash
# Apply to your remote D1 database
pnpm db:migrate:remote

# Or for local development
pnpm db:migrate:local
```

Migrations are generated by [Drizzle Kit](https://orm.drizzle.team/docs/migrations) and applied via Wrangler's `d1 migrations apply`, which tracks what's been applied automatically.

If you later modify the schema, generate a new migration then apply it:

```bash
cd packages/db
npx drizzle-kit generate
cd ../..
pnpm db:migrate:remote
```

### 6. Build the frontend

`NEXT_PUBLIC_*` variables are baked into the static export at build time:

```bash
cd apps/web

NEXT_PUBLIC_BASE_URL=https://your-domain.com \
NEXT_PUBLIC_ALLOW_CREDENTIALS=true \
BETTER_AUTH_SECRET=any-value-here \  # build-time stub; the real secret is set via `wrangler secret put`
pnpm build
```

This produces `apps/web/out/` which the Worker serves as static assets.

### 7. Deploy

```bash
cd apps/worker
npx wrangler deploy
```

Your app is live at `https://kan.<your-subdomain>.workers.dev`.

### Custom domain

Option A — add to `wrangler.toml`:

```toml
routes = [
  { pattern = “kan.yourdomain.com”, custom_domain = true }
]
```

Option B — configure in the [Cloudflare dashboard](https://dash.cloudflare.com/) under Workers & Pages > your worker > Settings > Domains & Routes.

After adding a custom domain, update `BASE_URL` and `NEXT_PUBLIC_BASE_URL` in `[vars]` and rebuild the frontend.

### Local development

```bash
# Build the frontend first (only needed once, or after frontend changes)
cd apps/web && pnpm build

# Apply migrations to local D1 (from the repo root)
pnpm db:migrate:local

# Start the Worker locally
cd apps/worker
cp .dev.vars.example .dev.vars  # Edit with your local secrets
npx wrangler dev
```

This starts a local Worker at `http://localhost:8787` with simulated D1, R2, and KV.

### Updating from upstream

This fork tracks [kanbn/kan](https://github.com/kanbn/kan). To pull in new features:

```bash
git fetch upstream
git merge upstream/main
# Resolve any conflicts (see MERGE_STRATEGY.md for guidance)
```

See [MERGE_STRATEGY.md](./MERGE_STRATEGY.md) for details on which files conflict and how to resolve them.

---

> **Looking for Docker or Railway?** The original [kanbn/kan](https://github.com/kanbn/kan) project supports Docker Compose and one-click Railway deployment with PostgreSQL. This fork replaces PostgreSQL with D1 and is designed exclusively for Cloudflare Workers.

## Environment Variables

Variables are set in `apps/worker/wrangler.toml` under `[vars]` (non-secret) or via `wrangler secret put` (secret). For local development, use `apps/worker/.dev.vars`.

### Required

| Variable | Description | Example |
|----------|-------------|---------|
| `BETTER_AUTH_SECRET` | Auth encryption secret (secret) | Random 32+ char string |
| `ENCRYPTION_KEY` | Data encryption key (secret) | Random 32+ char string |
| `BASE_URL` | Base URL of your deployment | `https://kan.yourdomain.com` |
| `NEXT_PUBLIC_BASE_URL` | Same as BASE_URL (used at frontend build time) | `https://kan.yourdomain.com` |
| `NEXT_PUBLIC_ALLOW_CREDENTIALS` | Enable email & password login | `true` |

### Email (Resend API)

| Variable | Description | Example |
|----------|-------------|---------|
| `EMAIL_API_KEY` | Resend API key (secret) | `re_xxxx` |
| `EMAIL_FROM` | Sender address | `”Kan <noreply@yourdomain.com>”` |

### OAuth providers

| Variable | Description |
|----------|-------------|
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | GitHub OAuth |
| `DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET` | Discord OAuth |
| `OIDC_CLIENT_ID` / `OIDC_CLIENT_SECRET` / `OIDC_DISCOVERY_URL` | Generic OIDC |

### Stripe (optional)

| Variable | Description |
|----------|-------------|
| `STRIPE_SECRET_KEY` | Stripe API secret key |
| `STRIPE_WEBHOOK_SECRET` | Webhook signing secret |
| `STRIPE_PRO_PLAN_MONTHLY_PRICE_ID` | Price ID for the Pro plan |

### Other

| Variable | Description | Default |
|----------|-------------|---------|
| `BETTER_AUTH_TRUSTED_ORIGINS` | Comma-separated allowed callback origins | Base URL |
| `BETTER_AUTH_ALLOWED_DOMAINS` | Restrict OIDC logins to specific email domains | All domains |
| `NEXT_PUBLIC_DISABLE_SIGN_UP` | Disable public registration | `false` |
| `NEXT_PUBLIC_WHITE_LABEL_HIDE_POWERED_BY` | Hide “Powered by kan.bn” on public boards | `false` |
| `KAN_ADMIN_API_KEY` | Admin API key for stats endpoints | None |
| `LOG_LEVEL` | Log verbosity (debug, info, warn, error) | `info` |
| `TRELLO_APP_API_KEY` / `TRELLO_APP_API_SECRET` | For Trello board imports | None |

## Contributing

We welcome contributions! Please read the [contribution guidelines](CONTRIBUTING.md) before submitting a pull request.

## Contributors

<a href=”https://github.com/kanbn/kan/graphs/contributors”>
  <img src=”https://contrib.rocks/image?repo=kanbn/kan” />
</a>

## License

Kan is licensed under the [AGPLv3 license](LICENSE).

## Contact

For the original Kan project, email [henry@kan.bn](mailto:henry@kan.bn) or join the [Discord server](https://discord.gg/e6ejRb6CmT).
