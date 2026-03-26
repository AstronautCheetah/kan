# Upstream Merge Strategy

This fork adapts [kanbn/kan](https://github.com/kanbn/kan) to run on Cloudflare Workers (D1 + R2 + Hono) instead of the original Next.js server deployment.

## Git Setup

```bash
# Our fork (set this to your fork URL after creating it)
git remote set-url origin https://github.com/AstronautCheetah/kan.git

# Upstream (the original kanbn/kan repo)
git remote add upstream https://github.com/kanbn/kan.git
git fetch upstream
```

## Merge Procedure

```bash
git fetch upstream
git checkout main
git merge upstream/main
# Resolve conflicts, then commit
```

## Conflict Zones

Files modified by this fork that are likely to conflict on upstream merge:

### HIGH risk (core architecture changes)
| File | What we changed | Why it conflicts |
|------|----------------|------------------|
| `packages/shared/src/utils/s3.ts` | Replaced S3 presigned URLs with Worker-served paths | Upstream may add S3 features |
| `packages/auth/src/hooks.ts` | Removed S3/Novu imports, added `AvatarUploader` abstraction | Upstream adds auth hooks |
| `packages/auth/src/auth.ts` | Added `InitAuthOptions` with `avatarUploader` | Upstream changes auth config |
| `packages/api/src/trpc.ts` | Added `StorageOps` to context | Upstream changes tRPC context |
| `packages/api/src/routers/attachment.ts` | Uses `ctx.storage` instead of S3 SDK | Upstream changes attachment handling |
| `apps/worker/src/index.ts` | Our entire Worker — new file, no upstream equivalent | Safe from conflicts but needs new upstream routes added |

### MEDIUM risk (dependency/config changes)
| File | What we changed |
|------|----------------|
| `packages/email/package.json` | Removed nodemailer, @novu/api |
| `packages/shared/package.json` | Removed @aws-sdk, next-runtime-env |
| `apps/web/package.json` | Removed @aws-sdk, @novu/api |
| `packages/api/src/routers/health.ts` | Removed S3 health check |
| `packages/api/src/routers/integration.ts` | Replaced `env()` with `process.env`, lazy getter for apiKeys |

### LOW risk (additive or isolated changes)
| File | What we changed |
|------|----------------|
| `apps/web/src/pages/settings/index.tsx` | New file — client-side redirect |
| `apps/web/src/utils/helpers.ts` | `getAvatarUrl` constructs `/api/avatar/` paths |
| `packages/auth/src/utils.ts` | Added no-op `triggerWorkflow` |
| `packages/api/src/utils/encryption.ts` | Added secret-aware cache guard |

## Strategy for Each Conflict Type

### Upstream adds new S3/storage features
Accept upstream code, then port to R2 bindings. Key pattern:
- `createS3Client()` → use R2 binding from Worker
- `generateUploadUrl()` → direct R2 PUT in Worker endpoint
- `deleteObject()` → `ctx.storage.deleteAttachment()` or R2 binding

### Upstream adds new auth hooks/plugins
Accept upstream, then wrap with our `env` accessor pattern. If they add S3 imports, replace with `avatarUploader`.

### Upstream adds new tRPC routes
These flow through automatically — the Worker's `/api/trpc/*` catch-all forwards to the same `appRouter`. No action needed unless the new route uses S3 directly.

### Upstream changes package.json deps
Accept upstream, then re-remove deps we've eliminated (@aws-sdk, nodemailer, @novu/api). Use `git checkout --ours` for package.json if needed, then manually reconcile.

## Files Safe to Always Accept Upstream ("theirs")
- `apps/docs/` — documentation, no fork changes
- `cloud/` — cloud-only infrastructure
- `tooling/` — ESLint, Prettier, TypeScript configs
- `packages/db/src/schema/` — schema changes (we don't modify schemas)
- `packages/db/src/repository/` — repository queries
- `apps/web/src/views/` (except settings/Avatar.tsx, card/AttachmentUpload.tsx)
- `apps/web/src/components/` (except SettingsLayout.tsx)

## CI Conflict Detection (Future)

Add to `.github/workflows/upstream-check.yml`:
```yaml
name: Upstream Conflict Check
on:
  schedule:
    - cron: '0 6 * * 1'  # Weekly Monday 6am
  workflow_dispatch:

jobs:
  check-merge:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - run: |
          git remote add upstream https://github.com/kanbn/kan.git || true
          git fetch upstream main
          if git merge --no-commit --no-ff upstream/main 2>&1 | grep -q "CONFLICT"; then
            echo "::warning::Upstream merge has conflicts"
            git diff --name-only --diff-filter=U
            git merge --abort
            exit 1
          else
            echo "Clean merge possible"
            git merge --abort
          fi
```
