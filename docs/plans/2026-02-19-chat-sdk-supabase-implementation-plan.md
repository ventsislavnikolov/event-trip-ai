# Chat SDK + Supabase MVP Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ship EventTrip.ai MVP faster by bootstrapping from `vercel/ai-chatbot`, then layering only the required EventTrip flow and selective Supabase integration.

**Architecture:** Use the Chat SDK app as the runtime baseline (auth, chat transport, streaming, deployment defaults), then replace domain logic with deterministic EventTrip pipeline services. Keep AI usage narrow (intent parsing + disambiguation), while package generation/ranking remains deterministic in server code. Use Supabase primarily as managed Postgres first, then add Supabase Auth/Storage only where it materially reduces implementation effort.

**Tech Stack:** Next.js App Router, React, Vercel AI SDK, TypeScript, Drizzle ORM, Supabase Postgres, Vercel

---

## Execution Status (2026-02-20)

Completed on `main`:
- Task 1: Template bootstrap
- Task 2: MVP surface pruning
- Task 3: Supabase Postgres wiring + base migration
- Task 4: Intent parsing + strict schema validation + follow-up interruption
- Task 5: Deterministic package engine
- Task 6: Provider collector orchestration (timeouts/retries/degraded mode)
- Task 7: Package cards + disambiguation UI integration
- Task 8: Verification gates + smoke runbook + CI stabilization

Outstanding follow-ups:
- Harden provider data normalization (event resolution and airport code mapping) for higher live-query hit rate.
- Expand client/product usage of persisted EventTrip rows (`et_trip_requests`, `et_package_options`) and connect `et_events` linkage.
- Keep docs/checklists in sync with implementation deltas.

---

**Skill references:** @writing-plans @linear @test-driven-development @verification-before-completion

## Preconditions

1. Create isolated branch/worktree:
```bash
git worktree add ../event-trip-ai-chat-sdk -b codex/chat-sdk-baseline
cd ../event-trip-ai-chat-sdk
```
2. Confirm Node and package manager:
```bash
node -v
pnpm -v
```
3. Capture env bootstrap checklist in `docs/runbooks/env-bootstrap.md`.

### Task 1: Bootstrap from `vercel/ai-chatbot` Template

**Files:**
- Create/replace: `package.json`
- Create/replace: `app/**`
- Create/replace: `lib/**`
- Create: `.env.example`
- Test: `tests/smoke/template-baseline.test.ts`

**Step 1: Write the failing smoke test**

```ts
import { existsSync } from 'node:fs';

test('template baseline files exist', () => {
  expect(existsSync('app')).toBe(true);
  expect(existsSync('lib')).toBe(true);
});
```

**Step 2: Run test and verify failure**

Run: `pnpm test tests/smoke/template-baseline.test.ts`
Expected: FAIL because template files are not present.

**Step 3: Import baseline template**

Run: `npx create-next-app@latest --example https://github.com/vercel/ai-chatbot .`

**Step 4: Run test and verify pass**

Run: `pnpm test tests/smoke/template-baseline.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add .
git commit -m "feat: bootstrap app from vercel ai-chatbot template"
```

### Task 2: Prune Template Features Not Needed for MVP

**Files:**
- Modify: `app/(chat)/**`
- Modify: `app/(auth)/**`
- Modify: `lib/db/schema.ts`
- Modify: `README.md`
- Test: `tests/smoke/mvp-surface.test.ts`

**Step 1: Write failing test for required MVP routes/components**

```ts
test('mvp surface excludes non-mvp pages', () => {
  // Assert removed routes/features are not imported or exposed
});
```

**Step 2: Remove non-MVP entities (documents/history tooling not needed now)**

**Step 3: Run test suite for app routing + build**

Run: `pnpm test tests/smoke/mvp-surface.test.ts && pnpm build`
Expected: PASS and build succeeds.

**Step 4: Commit**

```bash
git add app lib README.md tests/smoke/mvp-surface.test.ts
git commit -m "refactor: prune template features to mvp scope"
```

### Task 3: Wire Supabase Postgres as Primary Data Store

**Files:**
- Modify: `.env.example`
- Modify: `lib/db/*`
- Create: `supabase/migrations/0001_initial.sql`
- Create: `tests/db/connection.test.ts`

**Step 1: Write failing DB connection test**

```ts
test('database connects using POSTGRES_URL', async () => {
  // connect and run select 1
});
```

**Step 2: Configure Drizzle/Postgres connection to use Supabase URL**

**Step 3: Add first migration for EventTrip core tables**

**Step 4: Verify migration and connection**

Run: `pnpm drizzle-kit migrate && pnpm test tests/db/connection.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add .env.example lib/db supabase/migrations tests/db/connection.test.ts
git commit -m "feat: connect app to supabase postgres and initial schema"
```

### Task 4: Implement EventTrip Intent + Validation Flow with AI SDK

**Files:**
- Create: `lib/eventtrip/intent/schema.ts`
- Create: `lib/eventtrip/intent/parse-intent.ts`
- Modify: `app/api/chat/route.ts`
- Test: `tests/intent/parse-intent.test.ts`

**Step 1: Write failing schema validation tests for required fields**

**Step 2: Implement AI SDK prompt + structured output extraction**

**Step 3: Add single missing-field follow-up behavior**

**Step 4: Run tests**

Run: `pnpm test tests/intent/parse-intent.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add lib/eventtrip/intent app/api/chat/route.ts tests/intent/parse-intent.test.ts
git commit -m "feat: add intent parsing with schema validation"
```

### Task 5: Build Deterministic Package Engine (No AI Ranking)

**Files:**
- Create: `lib/eventtrip/packages/build-packages.ts`
- Create: `lib/eventtrip/packages/ranking.ts`
- Test: `tests/packages/ranking.test.ts`

**Step 1: Write failing ranking tests for `Budget`, `Best Value`, `Premium`**

**Step 2: Implement deterministic scoring and selection**

**Step 3: Add over-budget labeling and fallback behavior**

**Step 4: Run tests**

Run: `pnpm test tests/packages/ranking.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add lib/eventtrip/packages tests/packages/ranking.test.ts
git commit -m "feat: add deterministic package engine"
```

### Task 6: Add Provider Collectors with Deadlines and Degraded Mode

**Files:**
- Create: `lib/eventtrip/providers/ticketmaster.ts`
- Create: `lib/eventtrip/providers/seatgeek.ts`
- Create: `lib/eventtrip/providers/travelpayouts.ts`
- Create: `lib/eventtrip/providers/collector.ts`
- Test: `tests/providers/collector.test.ts`

**Step 1: Write failing timeout/degraded-mode tests**

**Step 2: Implement per-provider timeout + bounded retries**

**Step 3: Ensure orchestration returns partial results when possible**

**Step 4: Run tests**

Run: `pnpm test tests/providers/collector.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add lib/eventtrip/providers tests/providers/collector.test.ts
git commit -m "feat: add provider collectors with resilient orchestration"
```

### Task 7: Shape MVP UI on Top of Template Chat Shell

**Files:**
- Modify: `app/(chat)/**`
- Create: `components/eventtrip/package-cards.tsx`
- Create: `components/eventtrip/disambiguation-picker.tsx`
- Test: `tests/ui/package-cards.test.tsx`

**Step 1: Write failing UI tests for package card rendering and labels**

**Step 2: Implement 3-tier result cards with line-item pricing**

**Step 3: Implement event disambiguation selection UI**

**Step 4: Run tests and accessibility checks**

Run: `pnpm test tests/ui/package-cards.test.tsx && pnpm lint`
Expected: PASS.

**Step 5: Commit**

```bash
git add app components/eventtrip tests/ui/package-cards.test.tsx
git commit -m "feat: implement mvp trip result and disambiguation ui"
```

### Task 8: Verification Gate and Launch-Readiness Checklist

**Files:**
- Create: `docs/runbooks/mvp-smoke-checks.md`
- Modify: `.github/workflows/ci.yml`
- Test: `tests/e2e/core-flow.test.ts`

**Step 1: Write failing end-to-end happy-path + degraded-path test**

**Step 2: Implement CI gates (typecheck/lint/unit/e2e smoke)**

**Step 3: Run full verification**

Run: `pnpm typecheck && pnpm lint && pnpm test && pnpm test:e2e`
Expected: all PASS.

**Step 4: Commit**

```bash
git add .github/workflows/ci.yml docs/runbooks/mvp-smoke-checks.md tests/e2e/core-flow.test.ts
git commit -m "chore: add verification gates and launch smoke checklist"
```

## Linear Task Alignment

Update existing MVP backlog to reflect this architecture:
- M1 focuses on template bootstrap, pruning, and Supabase DB wiring.
- M2 uses AI SDK structured intent parsing (no custom provider-abstraction framework yet).
- M3-M4 stay deterministic/resilience-first with UI integration on template shell.

## Exit Criteria

- Template baseline is running in local and preview environments.
- Supabase Postgres is wired and migrated.
- Core prompt-to-3-tier-package flow passes automated smoke tests.
- Linear backlog is aligned to the template-first implementation sequence.
