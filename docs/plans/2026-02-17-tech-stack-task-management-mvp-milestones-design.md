# EventTrip.ai Tech Stack, Task Management, MVP, and Milestones Design

Date: 2026-02-17
Topic: Solo founder + Codex delivery system (feature-complete MVP)

## 1) Validated Decisions

### Delivery model
- Team mode: Solo founder with Codex
- Task management platform: Linear
- Planning structure: 1 Linear project for MVP with milestones as phases
- Issue granularity: small issues (0.5-1 day), strict acceptance criteria
- Review cadence: twice-weekly milestone reviews + daily execution
- Launch gate: feature-complete (all in-scope MVP issues closed)

### MVP boundary
- Core user outcome: known event -> full trip estimate in under 30 seconds
- Anonymous usage only for MVP
- Output: 3 tiers (`Budget`, `Best Value`, `Premium`) with outbound booking links
- Inputs via smart prompt: event, origin city, travelers, max budget per person

## 2) Recommended Tech Stack Blueprint

### Application platform
- Frontend + backend: Next.js (App Router) + TypeScript
- Database: Supabase (PostgreSQL)
- Hosting: Vercel
- Styling/UI: Tailwind CSS + component library as needed

This stack is optimized for speed of execution, low ops burden, and strong deployment workflow for a solo builder.

### AI architecture (provider-agnostic)
Implement a thin internal AI adapter layer in `src/lib/ai/`.

Stable internal interface:
- `parseIntent(prompt) -> ParsedIntent`
- `rankEventMatches(query, candidates) -> RankedCandidates`
- optional `summarizePackages(packages) -> string`

Provider adapters:
- `openai.adapter.ts`
- `anthropic.adapter.ts`
- `index.ts` for provider routing via environment config

Key rule:
- AI handles natural-language edges only (intent parsing, disambiguation help)
- Business logic remains deterministic (package generation/ranking in code)

This gives flexibility to switch providers without refactoring product logic.

### Data and integrations
- Event providers: Ticketmaster + SeatGeek + curated EU DB
- Travel providers: Travelpayouts flights/hotels
- Internal normalization models for event/ticket/flight/hotel records
- Shared wrappers for timeout/retry/circuit-breaker behavior
- Search/cache layer in Supabase for expensive calls

## 3) Task Management System in Linear

### Project topology
- Single Linear project: `EventTrip.ai MVP`
- Milestones represent delivery phases (M1-M5)
- Issues are deliverables with explicit acceptance criteria

Suggested labels:
- `frontend`
- `backend`
- `infra`
- `ai`
- `api`
- `blocked`

### Issue template (mandatory)
Every issue must include:
1. Problem statement
2. Scope boundaries (explicit non-goals)
3. Acceptance criteria (binary pass/fail)
4. Test requirements
5. Dependencies/blockers

### Operational rules
- One active issue in `In Progress` at a time
- No issue starts without acceptance criteria and test requirements
- If blocked >30 min: create blocker issue and switch to next ready item
- Done state requires:
  - code complete
  - verification output captured
  - docs updated when applicable

### Review rhythm
- Twice-weekly milestone review sessions
- Daily Codex execution loop
- Scope changes allowed only during milestone reviews, except urgent blockers

## 4) MVP Milestones (5 Phases)

### M1: Foundation and Delivery Ops
Goal: baseline app + delivery pipeline

Deliverables:
- Next.js project baseline
- Supabase project and initial migrations
- Vercel env setup
- Linear project + milestone + issue templates
- CI baseline (typecheck/lint/test scaffold)

Exit criteria:
- app runs locally and on preview
- migrations apply cleanly
- Linear workflow is operational

### M2: Intent Parsing and Event Resolution
Goal: prompt -> validated trip request -> selected event

Deliverables:
- AI adapter interface + provider adapters
- prompt parsing with strict schema validation
- missing-field follow-up behavior
- event resolver across providers/curated DB
- top-3 disambiguation flow for low-confidence matches

Exit criteria:
- parse/resolve paths covered by tests
- ambiguous event flow works end-to-end

### M3: Package Engine (Ticket + Flight + Hotel)
Goal: resolved event -> deterministic 3-tier packages

Deliverables:
- provider collector with parallel calls
- normalized component schemas
- deterministic ranking engine (`Budget`, `Best Value`, `Premium`)
- soft-budget annotations (`within budget` / `over budget`)
- over-budget fallback behavior

Exit criteria:
- API returns consistent 3-tier packages
- degraded mode works when one provider is slow/down

### M4: UX, Reliability, and Performance
Goal: fully usable anonymous flow with stable latency

Deliverables:
- smart prompt UX
- follow-up question UX
- event disambiguation selector
- results UI with line-item pricing + outbound links
- loading/error/fallback states
- observability logs and timeout controls

Exit criteria:
- no dead-end errors on core paths
- performance target verified in test conditions

### M5: Launch Hardening
Goal: feature-complete production readiness

Deliverables:
- regression pass and bug fix sweep
- analytics events
- SEO metadata baseline
- production config and runbook
- rollback notes

Exit criteria:
- all in-scope MVP issues done
- smoke checks pass
- launch decision documented

## 5) Risk Controls and Success Metrics

### Primary risks
1. External API instability or quota limits
2. AI parsing variance
3. Latency spikes above target
4. Scope creep under feature-complete gate
5. Solo bandwidth bottlenecks

### Mitigations
- Timeouts/retries/circuit-breakers per provider
- strict schema validation + follow-up questions
- hard orchestration deadline + graceful degradation
- milestone review authority to defer scope
- small issue slicing and priority by user impact

### Delivery metrics
- milestone completion percentage
- blocked issue count
- core flow pass rate
- planner P95 latency
- production error rate during launch prep

## 6) Execution Standard

Codex should implement issues sequentially with evidence-based closure:
- implementation summary
- files changed
- verification output
- residual risk note

This keeps a feature-complete strategy realistic by forcing measurable progress and preventing hidden work.
