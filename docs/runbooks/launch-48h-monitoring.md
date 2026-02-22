# EventTrip Launch 48h Monitoring

## Goal

Run a lightweight but explicit operating cadence for the first 48 hours after launch to detect and mitigate regressions quickly.

## Preconditions

- Preview and production deployment verification is complete.
- Required production secrets are configured (`AUTH_SECRET`, `POSTGRES_URL`, provider/model keys).
- `pnpm launch:decision` report is `GO`.

## Monitoring Windows

- `T+0` to `T+6h`: check every 30 minutes
- `T+6h` to `T+24h`: check every 2 hours
- `T+24h` to `T+48h`: check every 4 hours

## Checks Per Window

1. Availability and core path
```bash
pnpm launch:readiness:fast
pnpm exec playwright test tests/e2e/core-flow.test.ts --project=e2e --workers=1 --reporter=dot
```
2. Error and degraded-mode scan
- Review recent application logs for:
  - uncaught exceptions
  - provider timeout spikes
  - repeated `offline:*` failures in API responses
3. Funnel sanity
- Verify that key funnel events continue to emit:
  - `intent_detected`
  - `follow_up_requested`
  - package generation/selection events
4. Outbound link health
- Validate at least one outbound booking link manually from a fresh session.

## Incident Thresholds

Trigger immediate mitigation (rollback or traffic pause) if any of the following occur:

- Core flow e2e fails repeatedly in two consecutive runs.
- Error/degraded responses exceed normal baseline for more than 30 minutes.
- Outbound link generation fails for primary path.

## Mitigation Playbook

1. Freeze deployments.
2. Roll back to last healthy Vercel deployment.
3. Re-run `pnpm launch:readiness` on rollback branch.
4. Log incident summary and owner in Linear (`VEN-274` or a follow-up issue).

## Exit Criteria (48h Complete)

- No Sev-1 incidents.
- Core flow checks pass at end of monitoring window.
- Any Sev-2/Sev-3 incidents have owners and remediation issues.
