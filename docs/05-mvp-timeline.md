# EventTrip.ai MVP Timeline

## Timeline (1 Developer, 7 Weeks)

### Week 1-2: Template Baseline + Data Foundation
- [x] Bootstrap from `vercel/ai-chatbot` template
- [x] Remove non-MVP template features
- [x] Configure Vercel environments and required secrets
- [x] Set up Supabase Postgres and base migrations
- [x] Add CI baseline (typecheck, lint, unit tests)
- [x] Establish core API error envelope and response contracts

### Week 3-4: Intent + Data Providers + Package Engine
- [x] AI SDK intent parsing with strict schema validation
- [x] Missing-field follow-up flow
- [x] Event resolution across Ticketmaster, SeatGeek, curated index
- [x] Travel collectors (flight + hotel) with timeout controls
- [x] Deterministic package ranking (`Budget`, `Best Value`, `Premium`)
- [x] Over-budget fallback and annotations

### Week 5: Product UX and Reliability
- [x] Smart prompt UI and conversation state model
- [x] Event disambiguation picker UI
- [x] Package result cards with line-item pricing
- [x] Outbound booking link tracking
- [x] Observability logs for parse, provider latency, and package generation
- [x] Request deadline and graceful fallback states

### Week 6: Hardening and Launch Readiness
- [x] Regression suite for core prompt-to-package flow
- [x] Production smoke checks and rollback notes
- [x] SEO metadata and sharing previews
- [x] Funnel analytics events
- [x] Performance pass (P95 within target budget)
- [x] Preview and production deployment verification

### Week 7: Launch Week
- [x] Final bug triage and blocker burn-down
- [x] Validate outbound links and affiliate instrumentation
- [x] Freeze MVP scope and close remaining must-have issues
- [x] Launch decision review
- [ ] Publish and monitor first 48h
- [ ] Launch retrospective

## Current Launch Status (2026-02-22)

Validated locally:

- `pnpm lint`
- `pnpm exec tsc --noEmit`
- smoke tests (`node --test ...`)
- CI unit suite (`pnpm exec tsx --test ...`)
- `pnpm build`
- core flow e2e (`CI=1 pnpm exec playwright test tests/e2e/core-flow.test.ts --project=e2e --workers=1 --reporter=dot`)

Deployment verification status:

- `pnpm launch:readiness -- --skip-e2e` is passing end-to-end.
- Vercel auth check is passing.
- Preview/production env checks are passing for required keys (`AUTH_SECRET`, `POSTGRES_URL`).

Latest launch decision artifact:

- `docs/runbooks/launch-decision-2026-02-22.md` (`GO`, generated from `pnpm launch:decision`)
- launch readiness quality gates are passing (`lint`, `typecheck`, `smoke-and-unit`, `build`, `vercel-auth`, env checks)
- launch-week execution docs are prepared:
  - `docs/runbooks/launch-48h-monitoring.md`
  - `docs/runbooks/launch-retrospective-template.md`
- final bug triage report: `docs/runbooks/launch-bug-triage-2026-02-22.md`
- env bootstrap runbook: `docs/runbooks/env-bootstrap.md`

Linear status alignment:

- Launch-hardening blocker issue `VEN-274` is ready to close after this verification update.
- No remaining `Backlog` or `In Review` items in the Event Trip AI project.

## Launch Strategy

1. ProductHunt
2. Reddit (`r/festivals`, `r/travel`, `r/solotravel`, `r/formula1`)
3. TikTok/Reels short demos
4. SEO pages for high-intent event travel searches
5. Festival communities (Facebook/Discord)

## Startup Costs (Monthly)

```
Ticketmaster API:     Free
SeatGeek API:         Free
Travelpayouts:        Free
Booking.com API:      Free (after approval)
Google Maps:          $0-5
AI API usage:         $50-150
Supabase:             Free tier to start
Vercel:               Free tier to start
Domain:               $1/month
─────────────────────
TOTAL:                ~$50-160/month
```

## MVP Scope Notes

- Keep anonymous-first experience for MVP.
- Do not add save/share/group checkout features before launch.
- Preserve deterministic package logic; use AI only where NLP is needed.
