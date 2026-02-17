# EventTrip.ai MVP Scope Design

Date: 2026-02-17
Topic: Event-first trip planning MVP (known event -> full trip estimate in <30s)

## 1) Validated Product Decisions

### Core job-to-be-done
Given a known event, generate a complete travel package estimate in under 30 seconds.

### In-scope for MVP
- Input via single smart prompt (natural language)
- Required extracted fields: event, origin city, travelers, max budget per person
- If fields are missing, ask one targeted follow-up question
- Europe event coverage across categories (music, sports, concerts, conferences, etc.)
- Output: 3 package tiers (`Budget`, `Best Value`, `Premium`)
- Package components: event ticket + flight + hotel
- Dates auto-derived from event (`arrive = start - 1 day`, `depart = end + 1 day`)
- Budget treated as soft preference (not hard filter)
- If event match is uncertain, show top 3 candidates for user selection
- If all options exceed budget, still return 3 cheapest valid packages with over-budget badges
- Fully anonymous flow (no account)
- Outbound booking/affiliate links only

### Out of scope for MVP (deferred)
- Save trip
- Share trip link
- Group planning/invites
- Direct booking checkout

## 2) Architecture Approach

Selected approach: deterministic pipeline with minimal AI.

AI is used only for:
- prompt-to-structured-data parsing
- event name disambiguation support

All package ranking/composition logic stays deterministic in code.

Why this approach:
- Better latency control for the <30s requirement
- Predictable outputs and easier debugging
- Lower cost and lower variance than an AI-heavy orchestrator
- Easier to test with stable unit/integration expectations

### High-level pipeline
1. Parse prompt to strict schema
2. Validate required fields; return targeted follow-up if missing
3. Resolve event across providers and curated DB
4. Return top 3 matches if confidence below threshold
5. Derive dates and destination airport context
6. Fetch ticket/flight/hotel in parallel with strict timeouts
7. Normalize provider payloads
8. Build + rank 3 deterministic tiers
9. Apply budget badges and return outbound links

## 3) Service Components and Contracts

### `intent-parser`
Input: raw prompt string
Output:
- `event_query`
- `origin_city`
- `travelers`
- `max_budget_per_person`
- `missing_fields[]`
- parser confidence metadata (internal)

Behavior:
- strict schema validation
- one follow-up question when required fields are missing

### `event-resolver`
Sources: Ticketmaster + SeatGeek + curated EU event index

Output modes:
- `resolved_event` (high-confidence match)
- `needs_disambiguation` with top 3 candidates

### `travel-collector`
Input: resolved event + origin + derived dates
Calls in parallel:
- ticket source
- flights source
- hotels source

Behavior:
- per-provider timeout + bounded retries
- partial failure handling
- normalized component output format

### `package-engine`
Deterministic package generation:
- `Budget`: minimum per-person total
- `Best Value`: weighted quality/price tradeoff
- `Premium`: highest quality within sane outlier bounds

Budget handling:
- annotate each package as `within_budget` or `over_budget`
- include absolute overage amount per person

### `response-presenter`
Returns UI-ready payload:
- three tier cards with line-item prices and totals
- outbound booking links
- explanation tags (why selected)
- user-facing error/fallback states

## 4) Error Handling and Latency Strategy

### Typed error states
- `INPUT_MISSING`
- `EVENT_AMBIGUOUS`
- `NO_RESULTS`
- `PARTIAL_PROVIDER_FAILURE`
- `SYSTEM_ERROR`

### Degradation rules
- If one provider is slow/down, continue if complete packages can still be built
- If complete package cannot be formed, return recoverable guidance (adjust origin/date/budget)
- Never fail silently

### Performance controls
- strict provider timeouts
- bounded retry budget
- orchestration hard deadline (<25s internal budget)
- return controlled fallback if deadline approaches

### Observability
Per request log:
- parser confidence
- event match confidence
- provider latency and timeout counts
- package engine duration
- final status/error code

## 5) Testing Strategy

### Unit tests
- parser validation and missing-field behavior
- event match confidence threshold behavior
- package ranking and tier assignment
- soft-budget labeling

### Contract tests
- provider adapters against saved fixtures
- normalized schema guarantees

### Integration tests
- happy path with complete data
- missing field follow-up path
- ambiguous event selection path
- all options over budget path
- provider timeout/degraded mode path

### Performance check
- lightweight benchmark for planner P95 latency under mocked provider timings

## 6) MVP Success Criteria

- User can input one natural-language prompt and get 3 package tiers in under 30s
- Output always includes transparent per-person and total pricing
- System handles ambiguous events and missing fields without dead-end failures
- Over-budget results are still returned with clear labeling
- Result contains outbound booking links for ticket, flight, and hotel
