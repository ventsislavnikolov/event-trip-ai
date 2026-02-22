# Launch Decision Review

- Generated at: `2026-02-22T09:02:33.196Z`
- Branch: `main`
- Commit: `f9cf8e3`
- Command: `pnpm -s launch:readiness -- --skip-e2e`
- Decision: `NO-GO`
- Exit code: `1`

## Failed Checks

- `vercel-auth: Vercel authentication`
- `env-check-preview: Preview environment keys`
- `env-check-production: Production environment keys`

## Raw Output

```text
Running 7 launch readiness checks...

[lint] Lint
PASS

[typecheck] Typecheck
PASS

[smoke-and-unit] Smoke and unit suite
PASS

[build] Production build
PASS

[vercel-auth] Vercel authentication

[env-check-preview] Preview environment keys

[env-check-production] Production environment keys

FAIL
Vercel CLI 50.22.1
Error: No existing credentials found. Please run `vercel login` or pass "--token"
Learn More: https://err.sh/vercel/no-credentials-found
FAIL
Missing required environment variables for profile 'vercel-preview':
- AUTH_SECRET
- POSTGRES_URL

Set missing values in your local shell/.env.local or in Vercel env configuration.
Reference: docs/runbooks/vercel-secrets-policy.md
FAIL
Missing required environment variables for profile 'vercel-production':
- AUTH_SECRET
- POSTGRES_URL

Set missing values in your local shell/.env.local or in Vercel env configuration.
Reference: docs/runbooks/vercel-secrets-policy.md

Failed checks:
- vercel-auth: Vercel authentication
- env-check-preview: Preview environment keys
- env-check-production: Production environment keys

Resolve blockers and rerun `pnpm launch:readiness`.
```
