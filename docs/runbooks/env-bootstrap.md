# EventTrip Env Bootstrap

## Purpose

Provide a single, concrete bootstrap flow for local, preview, and production environment values required by launch readiness.

## Current Project Context

- Supabase project: `event-trip-ai`
- Project ref: `iwqflbjsqyuaooxtszhb`
- Region: `eu-central-1` (Germany)

## Required Keys for Launch Gate

- `AUTH_SECRET`
- `POSTGRES_URL`

## Step 1: Generate `AUTH_SECRET`

Use a strong random value and keep it consistent per environment unless rotating intentionally.

```bash
openssl rand -base64 32
```

Set locally in `.env.local`:

```bash
AUTH_SECRET=<generated-value>
```

## Step 2: Retrieve `POSTGRES_URL` from Supabase

From Supabase dashboard:

1. Open project `event-trip-ai` (`iwqflbjsqyuaooxtszhb`).
2. Go to `Settings` -> `Database`.
3. Copy the connection string (direct connection string preferred for migrations).
4. Set:

```bash
POSTGRES_URL=<supabase-connection-string>
```

## Step 3: Local Validation

```bash
pnpm env:check:local
pnpm launch:readiness:local
```

## Step 4: Push to Vercel Preview + Production

After `vercel login` (or using `--token`):

```bash
vercel env add AUTH_SECRET preview
vercel env add AUTH_SECRET production
vercel env add POSTGRES_URL preview
vercel env add POSTGRES_URL production
```

## Step 5: Launch Gate Re-check

```bash
pnpm launch:readiness -- --skip-e2e
pnpm launch:decision
```

Expected for unblock:

- `vercel-auth` passes
- `env-check-preview` passes
- `env-check-production` passes

## Notes

- Never commit real secret values to git.
- Rotate `AUTH_SECRET` and `POSTGRES_URL` per policy in `docs/runbooks/vercel-secrets-policy.md`.
