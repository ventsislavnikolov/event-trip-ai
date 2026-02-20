# Vercel Secrets Policy

## Purpose

Define the canonical EventTrip secrets policy for local development, Vercel preview, and Vercel production.

## Canonical Variables

| Variable | Local | Preview | Production | Owner | Rotation |
| --- | --- | --- | --- | --- | --- |
| `AUTH_SECRET` | Required | Required | Required | App owner | 90 days or incident-triggered |
| `POSTGRES_URL` | Required | Required | Required | App owner | On Supabase credential rotation |
| `AI_GATEWAY_API_KEY` | Required for non-Vercel runtime; optional on Vercel OIDC | Optional | Optional | App owner | 90 days |
| `REDIS_URL` | Optional | Optional | Optional | App owner | On provider credential rotation |
| `BLOB_READ_WRITE_TOKEN` | Optional | Optional | Optional | App owner | 90 days |
| `EVENTTRIP_INTENT_PRIMARY_MODEL` | Optional | Optional | Optional | App owner | On model strategy changes |
| `EVENTTRIP_INTENT_FALLBACK_MODEL` | Optional | Optional | Optional | App owner | On model strategy changes |
| `TICKETMASTER_API_KEY` | Optional until provider integration | Optional until provider integration | Optional until provider integration | App owner | 90 days |
| `SEATGEEK_CLIENT_ID` | Optional until provider integration | Optional until provider integration | Optional until provider integration | App owner | 90 days |
| `SEATGEEK_CLIENT_SECRET` | Optional until provider integration | Optional until provider integration | Optional until provider integration | App owner | 90 days |
| `TRAVELPAYOUTS_API_TOKEN` | Optional until provider integration | Optional until provider integration | Optional until provider integration | App owner | 90 days |
| `TRAVELPAYOUTS_MARKER` | Optional until provider integration | Optional until provider integration | Optional until provider integration | App owner | On program/account changes |

` .env.example` is the canonical source for key names.

## Provisioning on Vercel

Add/update environment variables for each target:

```bash
# Example (interactive value entry)
vercel env add AUTH_SECRET preview
vercel env add AUTH_SECRET production

vercel env add POSTGRES_URL preview
vercel env add POSTGRES_URL production
```

Repeat for any enabled optional integrations.

## Verification Commands

### Local required keys

```bash
pnpm env:check:local
```

### Preview required keys

```bash
vercel env pull .env.preview.local --environment=preview
set -a; source .env.preview.local; set +a
pnpm env:check:preview
pnpm build
```

### Production required keys

```bash
vercel env pull .env.production.local --environment=production
set -a; source .env.production.local; set +a
pnpm env:check:production
pnpm build
```

### Provider integration gate (when enabled)

```bash
pnpm env:check:providers
```

## Missing-Key Failure Behavior

`pnpm env:check:*` exits with code `1` when required keys are missing and prints:

- missing profile
- exact missing key names
- pointer to this runbook

This is the required pre-deploy guard before preview and production promotion.

## Security Rules

- Never commit real secrets in repository files.
- Keep `.env.local`, `.env.preview.local`, `.env.production.local` out of version control.
- Rotate any secret immediately after accidental exposure.
