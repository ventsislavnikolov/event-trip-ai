# EventTrip MVP Smoke Checks

## Purpose

This runbook defines the minimum checks required before preview promotion and before production release.

## Preconditions

- `.env.local` contains required values (`AUTH_SECRET`, `POSTGRES_URL`, and model/provider keys).
- Environment bootstrap is completed (`docs/runbooks/env-bootstrap.md`).
- Database migrations are up to date.
- Branch is rebased on latest mainline.
- Required environment keys are validated with `pnpm env:check:local` (see `docs/runbooks/vercel-secrets-policy.md`).

## Local Smoke Checks

Preferred single-command execution:

```bash
pnpm launch:readiness
```

Use `pnpm launch:readiness:local` when Vercel credentials/env checks are not available locally, or `pnpm launch:readiness:fast` to skip Playwright during quick iterations.

Generate a dated launch GO/NO-GO artifact:

```bash
pnpm launch:decision
```

1. Install dependencies:
```bash
pnpm install
```
2. Run schema/migration path:
```bash
pnpm env:check:local
pnpm db:migrate
```
3. Run fast local test gates:
```bash
node --test tests/smoke/template-baseline.test.js tests/smoke/mvp-surface.test.js
pnpm exec tsx --test \
  tests/db/connection.test.ts \
  tests/intent/parse-intent.test.ts \
  tests/intent/chat-intent-gate.test.ts \
  tests/eventtrip/history-summary.test.ts \
  tests/eventtrip/hydrate-messages.test.ts \
  tests/packages/ranking.test.ts \
  tests/providers/airport-code-resolver.test.ts \
  tests/providers/provider-adapters.test.ts \
  tests/providers/collector.test.ts \
  tests/ui/package-cards.test.tsx \
  tests/ui/disambiguation-picker.test.tsx \
  tests/ui/selected-event-summary.test.tsx
```
4. Run production build check:
```bash
pnpm build
```
5. Run EventTrip P95 latency benchmark gate:
```bash
pnpm perf:eventtrip:p95
```
Expected: JSON output with `p95Ms` less than `targetMs` (default `30000`).

## Core Flow E2E Smoke

Run the dedicated core-flow test:
```bash
pnpm exec playwright test tests/e2e/core-flow.test.ts --project=e2e
```

Checks covered:
- Prompt submission path is functional.
- Assistant response rendering path works.
- Degraded path displays user-visible failure state.

## Release Gate

Release is blocked unless all of the following are true:
- Lint passes.
- Typecheck passes.
- Smoke/unit tests pass.
- `pnpm build` passes.
- `tests/e2e/core-flow.test.ts` passes.
- Preview/production environment keys pass `pnpm env:check:preview` and `pnpm env:check:production`.

## Rollback Notes

If smoke checks fail after deployment:
1. Roll back to previous healthy Vercel deployment.
2. Re-run local smoke checks against the rollback branch.
3. Open/attach incident ticket with failing command output and root cause notes.

## Post-Launch Operations

After deployment is approved, execute:

- `docs/runbooks/launch-48h-monitoring.md` for first-48h operational checks.
- `docs/runbooks/launch-retrospective-template.md` to capture launch retrospective outcomes and actions.
