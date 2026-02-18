# Linear MVP Bootstrap Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a repeatable, tested workflow that creates all required Linear artifacts for EventTrip.ai MVP (project, milestones, labels, and initial issue backlog) from a repository-managed seed file.

**Architecture:** Keep one source-of-truth YAML seed in the repo under `ops/linear/`, then use a small Python CLI that supports `dry-run` and `apply` modes. The CLI must read existing Linear objects first and only create missing project/milestones/labels/issues so it is idempotent and safe to re-run. Tests must validate seed schema, operation planning, and API behavior before real writes.

**Tech Stack:** Python 3.12, pytest, requests, pyyaml, Linear GraphQL API, Git

---

**Skill references:** @linear @test-driven-development @verification-before-completion @systematic-debugging

## Preconditions

1. Create dedicated worktree before implementation:
```bash
git worktree add ../event-trip-ai-linear-bootstrap -b codex/linear-bootstrap
cd ../event-trip-ai-linear-bootstrap
```
2. Create virtualenv and install test dependencies:
```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
pip install pytest requests pyyaml
```

### Task 1: Bootstrap CLI Skeleton

**Files:**
- Create: `scripts/linear/bootstrap.py`
- Create: `scripts/linear/__init__.py`
- Create: `tests/linear/test_bootstrap_cli.py`
- Create: `pytest.ini`

**Step 1: Write the failing test**

```python
# tests/linear/test_bootstrap_cli.py
from scripts.linear.bootstrap import parse_args


def test_parse_args_defaults_to_dry_run():
    args = parse_args([])
    assert args.mode == "dry-run"
```

**Step 2: Run test to verify it fails**

Run: `python -m pytest tests/linear/test_bootstrap_cli.py::test_parse_args_defaults_to_dry_run -v`
Expected: FAIL with `ModuleNotFoundError` for `scripts.linear.bootstrap`

**Step 3: Write minimal implementation**

```python
# scripts/linear/bootstrap.py
from __future__ import annotations

import argparse


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", choices=["dry-run", "apply"], default="dry-run")
    return parser.parse_args(argv)
```

**Step 4: Run test to verify it passes**

Run: `python -m pytest tests/linear/test_bootstrap_cli.py::test_parse_args_defaults_to_dry_run -v`
Expected: PASS

**Step 5: Commit**

```bash
git add pytest.ini scripts/linear/__init__.py scripts/linear/bootstrap.py tests/linear/test_bootstrap_cli.py
git commit -m "test(linear): scaffold bootstrap cli parser"
```

### Task 2: Add Seed Schema Loader and Validation

**Files:**
- Create: `scripts/linear/seed_loader.py`
- Create: `scripts/linear/models.py`
- Test: `tests/linear/test_seed_loader.py`

**Step 1: Write the failing test**

```python
# tests/linear/test_seed_loader.py
import pytest
from scripts.linear.seed_loader import load_seed


def test_load_seed_rejects_missing_project_name(tmp_path):
    bad = tmp_path / "bad.yaml"
    bad.write_text("team_key: EVT\n", encoding="utf-8")

    with pytest.raises(ValueError, match="project_name"):
        load_seed(bad)
```

**Step 2: Run test to verify it fails**

Run: `python -m pytest tests/linear/test_seed_loader.py::test_load_seed_rejects_missing_project_name -v`
Expected: FAIL with `ModuleNotFoundError` for `scripts.linear.seed_loader`

**Step 3: Write minimal implementation**

```python
# scripts/linear/seed_loader.py
from __future__ import annotations

from pathlib import Path
import yaml


def load_seed(path: Path) -> dict:
    data = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    if "project_name" not in data:
        raise ValueError("project_name is required")
    if "team_key" not in data:
        raise ValueError("team_key is required")
    if "milestones" not in data:
        raise ValueError("milestones is required")
    if "issues" not in data:
        raise ValueError("issues is required")
    return data
```

**Step 4: Run test to verify it passes**

Run: `python -m pytest tests/linear/test_seed_loader.py::test_load_seed_rejects_missing_project_name -v`
Expected: PASS

**Step 5: Commit**

```bash
git add scripts/linear/seed_loader.py scripts/linear/models.py tests/linear/test_seed_loader.py
git commit -m "test(linear): add seed loader validation"
```

### Task 3: Plan Deterministic Operations (Project, Milestones, Labels, Issues)

**Files:**
- Create: `scripts/linear/plan_ops.py`
- Modify: `scripts/linear/bootstrap.py`
- Test: `tests/linear/test_plan_ops.py`

**Step 1: Write the failing test**

```python
# tests/linear/test_plan_ops.py
from scripts.linear.plan_ops import build_operations


def test_build_operations_order_and_counts():
    seed = {
        "project_name": "EventTrip.ai MVP",
        "team_key": "EVT",
        "labels": ["frontend", "backend"],
        "milestones": [{"name": "M1 Foundation"}],
        "issues": [{"title": "Set up Next.js baseline", "milestone": "M1 Foundation", "labels": ["backend"]}],
    }

    ops = build_operations(seed)
    assert [op["kind"] for op in ops[:3]] == ["project", "label", "milestone"]
    assert ops[-1]["kind"] == "issue"
```

**Step 2: Run test to verify it fails**

Run: `python -m pytest tests/linear/test_plan_ops.py::test_build_operations_order_and_counts -v`
Expected: FAIL with `ModuleNotFoundError` for `scripts.linear.plan_ops`

**Step 3: Write minimal implementation**

```python
# scripts/linear/plan_ops.py
from __future__ import annotations


def build_operations(seed: dict) -> list[dict]:
    ops: list[dict] = []
    ops.append({"kind": "project", "name": seed["project_name"]})
    for label in seed.get("labels", []):
        ops.append({"kind": "label", "name": label})
    for milestone in seed.get("milestones", []):
        ops.append({"kind": "milestone", "name": milestone["name"]})
    for issue in seed.get("issues", []):
        ops.append({"kind": "issue", **issue})
    return ops
```

**Step 4: Run test to verify it passes**

Run: `python -m pytest tests/linear/test_plan_ops.py::test_build_operations_order_and_counts -v`
Expected: PASS

**Step 5: Commit**

```bash
git add scripts/linear/plan_ops.py scripts/linear/bootstrap.py tests/linear/test_plan_ops.py
git commit -m "test(linear): add deterministic operation planner"
```

### Task 4: Add Linear GraphQL Client with Authentication and Typed Mutations

**Files:**
- Create: `scripts/linear/linear_client.py`
- Test: `tests/linear/test_linear_client.py`

**Step 1: Write the failing test**

```python
# tests/linear/test_linear_client.py
from unittest.mock import Mock, patch
from scripts.linear.linear_client import LinearClient


def test_query_sends_bearer_token():
    fake_response = Mock()
    fake_response.json.return_value = {"data": {}}
    fake_response.raise_for_status.return_value = None

    with patch("scripts.linear.linear_client.requests.post", return_value=fake_response) as mocked:
        client = LinearClient(api_token="token-123")
        client.query("query { viewer { id } }")

    headers = mocked.call_args.kwargs["headers"]
    assert headers["Authorization"] == "Bearer token-123"
```

**Step 2: Run test to verify it fails**

Run: `python -m pytest tests/linear/test_linear_client.py::test_query_sends_bearer_token -v`
Expected: FAIL with `ModuleNotFoundError` for `scripts.linear.linear_client`

**Step 3: Write minimal implementation**

```python
# scripts/linear/linear_client.py
from __future__ import annotations

import requests


class LinearClient:
    def __init__(self, api_token: str) -> None:
        self.api_token = api_token
        self.endpoint = "https://api.linear.app/graphql"

    def query(self, query: str, variables: dict | None = None) -> dict:
        response = requests.post(
            self.endpoint,
            headers={
                "Authorization": f"Bearer {self.api_token}",
                "Content-Type": "application/json",
            },
            json={"query": query, "variables": variables or {}},
            timeout=20,
        )
        response.raise_for_status()
        payload = response.json()
        if "errors" in payload:
            raise RuntimeError(payload["errors"])
        return payload.get("data", {})
```

**Step 4: Run test to verify it passes**

Run: `python -m pytest tests/linear/test_linear_client.py::test_query_sends_bearer_token -v`
Expected: PASS

**Step 5: Commit**

```bash
git add scripts/linear/linear_client.py tests/linear/test_linear_client.py
git commit -m "test(linear): add authenticated graphql client"
```

### Task 5: Implement Idempotent Apply Engine

**Files:**
- Create: `scripts/linear/apply_ops.py`
- Modify: `scripts/linear/bootstrap.py`
- Test: `tests/linear/test_apply_ops.py`

**Step 1: Write the failing test**

```python
# tests/linear/test_apply_ops.py
from scripts.linear.apply_ops import apply_operations


class FakeClient:
    def __init__(self):
        self.created = []

    def find_project_by_name(self, name):
        return {"id": "prj_1"}

    def create_project(self, name, team_id):
        self.created.append((name, team_id))


def test_apply_skips_project_creation_when_project_exists():
    client = FakeClient()
    operations = [{"kind": "project", "name": "EventTrip.ai MVP", "team_id": "team_1"}]

    apply_operations(client, operations)
    assert client.created == []
```

**Step 2: Run test to verify it fails**

Run: `python -m pytest tests/linear/test_apply_ops.py::test_apply_skips_project_creation_when_project_exists -v`
Expected: FAIL with `ModuleNotFoundError` for `scripts.linear.apply_ops`

**Step 3: Write minimal implementation**

```python
# scripts/linear/apply_ops.py
from __future__ import annotations


def apply_operations(client, operations: list[dict]) -> None:
    for op in operations:
        if op["kind"] != "project":
            continue
        existing = client.find_project_by_name(op["name"])
        if existing:
            continue
        client.create_project(op["name"], op["team_id"])
```

**Step 4: Run test to verify it passes**

Run: `python -m pytest tests/linear/test_apply_ops.py::test_apply_skips_project_creation_when_project_exists -v`
Expected: PASS

**Step 5: Commit**

```bash
git add scripts/linear/apply_ops.py scripts/linear/bootstrap.py tests/linear/test_apply_ops.py
git commit -m "test(linear): add idempotent apply engine"
```

### Task 6: Add EventTrip.ai MVP Seed (All Linear Artifacts)

**Files:**
- Create: `ops/linear/eventtrip-mvp-seed.yaml`
- Test: `tests/linear/test_eventtrip_seed.py`

**Step 1: Write the failing test**

```python
# tests/linear/test_eventtrip_seed.py
from pathlib import Path
from scripts.linear.seed_loader import load_seed


def test_eventtrip_seed_has_five_milestones_and_minimum_issue_count():
    seed = load_seed(Path("ops/linear/eventtrip-mvp-seed.yaml"))

    assert len(seed["milestones"]) == 5
    assert len(seed["issues"]) >= 30
```

**Step 2: Run test to verify it fails**

Run: `python -m pytest tests/linear/test_eventtrip_seed.py::test_eventtrip_seed_has_five_milestones_and_minimum_issue_count -v`
Expected: FAIL with file not found for `ops/linear/eventtrip-mvp-seed.yaml`

**Step 3: Write minimal implementation**

```yaml
# ops/linear/eventtrip-mvp-seed.yaml
project_name: EventTrip.ai MVP
project_description: Feature-complete MVP delivery for event-first travel planning.
team_key: EVT
labels:
  - frontend
  - backend
  - infra
  - ai
  - api
  - blocked
milestones:
  - name: M1 Foundation and Delivery Ops
    description: Baseline project setup and team workflow.
  - name: M2 Intent Parsing and Event Resolution
    description: Prompt parsing and event matching.
  - name: M3 Package Engine Ticket Flight Hotel
    description: Deterministic package builder.
  - name: M4 UX Reliability and Performance
    description: Complete anonymous flow and latency work.
  - name: M5 Launch Hardening
    description: Feature-complete release readiness.
issues:
  - title: Initialize Next.js repository baseline
    milestone: M1 Foundation and Delivery Ops
    labels: [backend, infra]
    priority: 2
  - title: Set up Supabase project and base migrations
    milestone: M1 Foundation and Delivery Ops
    labels: [backend, infra]
    priority: 1
  - title: Configure Vercel environments and secrets policy
    milestone: M1 Foundation and Delivery Ops
    labels: [infra]
    priority: 2
  - title: Add CI typecheck lint and test workflow
    milestone: M1 Foundation and Delivery Ops
    labels: [infra, backend]
    priority: 2
  - title: Define API error envelope and response contracts
    milestone: M1 Foundation and Delivery Ops
    labels: [backend, api]
    priority: 1

  - title: Implement AI adapter interface and provider routing
    milestone: M2 Intent Parsing and Event Resolution
    labels: [ai, backend]
    priority: 1
  - title: Implement OpenAI adapter parseIntent
    milestone: M2 Intent Parsing and Event Resolution
    labels: [ai, backend]
    priority: 1
  - title: Implement Anthropic adapter parseIntent
    milestone: M2 Intent Parsing and Event Resolution
    labels: [ai, backend]
    priority: 2
  - title: Build strict intent schema validator
    milestone: M2 Intent Parsing and Event Resolution
    labels: [backend, api]
    priority: 1
  - title: Build missing-field follow-up question flow
    milestone: M2 Intent Parsing and Event Resolution
    labels: [backend, frontend]
    priority: 1
  - title: Integrate Ticketmaster event search client
    milestone: M2 Intent Parsing and Event Resolution
    labels: [api, backend]
    priority: 1
  - title: Integrate SeatGeek event search client
    milestone: M2 Intent Parsing and Event Resolution
    labels: [api, backend]
    priority: 2
  - title: Implement top-3 event disambiguation endpoint
    milestone: M2 Intent Parsing and Event Resolution
    labels: [backend, api]
    priority: 1

  - title: Build flight provider collector with timeout controls
    milestone: M3 Package Engine Ticket Flight Hotel
    labels: [backend, api]
    priority: 1
  - title: Build hotel provider collector with timeout controls
    milestone: M3 Package Engine Ticket Flight Hotel
    labels: [backend, api]
    priority: 1
  - title: Build ticket provider collector with timeout controls
    milestone: M3 Package Engine Ticket Flight Hotel
    labels: [backend, api]
    priority: 1
  - title: Implement normalized domain models for package components
    milestone: M3 Package Engine Ticket Flight Hotel
    labels: [backend]
    priority: 1
  - title: Implement package ranking Budget Best Value Premium
    milestone: M3 Package Engine Ticket Flight Hotel
    labels: [backend]
    priority: 1
  - title: Implement soft-budget annotation and over-budget badges
    milestone: M3 Package Engine Ticket Flight Hotel
    labels: [backend, frontend]
    priority: 1
  - title: Add package engine integration tests for degraded providers
    milestone: M3 Package Engine Ticket Flight Hotel
    labels: [backend]
    priority: 1

  - title: Build smart prompt input page and state model
    milestone: M4 UX Reliability and Performance
    labels: [frontend]
    priority: 1
  - title: Build follow-up question UI flow
    milestone: M4 UX Reliability and Performance
    labels: [frontend]
    priority: 1
  - title: Build event disambiguation picker UI
    milestone: M4 UX Reliability and Performance
    labels: [frontend]
    priority: 1
  - title: Build 3-tier package result cards with line-item pricing
    milestone: M4 UX Reliability and Performance
    labels: [frontend]
    priority: 1
  - title: Add outbound booking link tracking
    milestone: M4 UX Reliability and Performance
    labels: [frontend, backend]
    priority: 2
  - title: Implement request deadline and graceful fallback states
    milestone: M4 UX Reliability and Performance
    labels: [backend]
    priority: 1
  - title: Add observability logs for parse and provider latency
    milestone: M4 UX Reliability and Performance
    labels: [backend, infra]
    priority: 2

  - title: Add regression suite for core prompt-to-package flow
    milestone: M5 Launch Hardening
    labels: [backend, frontend]
    priority: 1
  - title: Add production smoke checks and rollback notes
    milestone: M5 Launch Hardening
    labels: [infra]
    priority: 1
  - title: Add analytics events for funnel and errors
    milestone: M5 Launch Hardening
    labels: [backend, frontend]
    priority: 2
  - title: Add SEO metadata and sharing previews
    milestone: M5 Launch Hardening
    labels: [frontend]
    priority: 2
  - title: Run launch readiness checklist and close blockers
    milestone: M5 Launch Hardening
    labels: [infra, blocked]
    priority: 1
```

**Step 4: Run test to verify it passes**

Run: `python -m pytest tests/linear/test_eventtrip_seed.py::test_eventtrip_seed_has_five_milestones_and_minimum_issue_count -v`
Expected: PASS

**Step 5: Commit**

```bash
git add ops/linear/eventtrip-mvp-seed.yaml tests/linear/test_eventtrip_seed.py
git commit -m "feat(linear): add full mvp seed for project milestones labels and issues"
```

### Task 7: Add Issue Body Renderer for Consistent Acceptance Criteria

**Files:**
- Create: `scripts/linear/issue_body.py`
- Modify: `scripts/linear/plan_ops.py`
- Test: `tests/linear/test_issue_body.py`

**Step 1: Write the failing test**

```python
# tests/linear/test_issue_body.py
from scripts.linear.issue_body import render_issue_body


def test_render_issue_body_contains_required_sections():
    body = render_issue_body(
        problem="Implement parser",
        scope="Only prompt parsing",
        acceptance=["Returns valid schema"],
        tests=["Unit test parser"],
    )

    assert "## Problem" in body
    assert "## Scope" in body
    assert "## Acceptance Criteria" in body
    assert "## Tests" in body
```

**Step 2: Run test to verify it fails**

Run: `python -m pytest tests/linear/test_issue_body.py::test_render_issue_body_contains_required_sections -v`
Expected: FAIL with `ModuleNotFoundError` for `scripts.linear.issue_body`

**Step 3: Write minimal implementation**

```python
# scripts/linear/issue_body.py
from __future__ import annotations


def render_issue_body(problem: str, scope: str, acceptance: list[str], tests: list[str]) -> str:
    acceptance_lines = "\n".join(f"- {item}" for item in acceptance)
    test_lines = "\n".join(f"- {item}" for item in tests)
    return (
        f"## Problem\n{problem}\n\n"
        f"## Scope\n{scope}\n\n"
        f"## Acceptance Criteria\n{acceptance_lines}\n\n"
        f"## Tests\n{test_lines}\n"
    )
```

**Step 4: Run test to verify it passes**

Run: `python -m pytest tests/linear/test_issue_body.py::test_render_issue_body_contains_required_sections -v`
Expected: PASS

**Step 5: Commit**

```bash
git add scripts/linear/issue_body.py scripts/linear/plan_ops.py tests/linear/test_issue_body.py
git commit -m "test(linear): enforce issue body structure"
```

### Task 8: Add Operator Runbook and Final Verification Flow

**Files:**
- Create: `docs/linear/README.md`
- Test: `tests/linear/test_runbook.py`

**Step 1: Write the failing test**

```python
# tests/linear/test_runbook.py
from pathlib import Path


def test_runbook_includes_required_commands():
    text = Path("docs/linear/README.md").read_text(encoding="utf-8")

    assert "LINEAR_API_KEY" in text
    assert "--mode dry-run" in text
    assert "--mode apply" in text
```

**Step 2: Run test to verify it fails**

Run: `python -m pytest tests/linear/test_runbook.py::test_runbook_includes_required_commands -v`
Expected: FAIL with file not found for `docs/linear/README.md`

**Step 3: Write minimal implementation**

````markdown
# Linear Bootstrap Runbook

## Prerequisites
- Export `LINEAR_API_KEY`
- Confirm team key in `ops/linear/eventtrip-mvp-seed.yaml`

## Dry Run
```bash
python scripts/linear/bootstrap.py --mode dry-run --seed ops/linear/eventtrip-mvp-seed.yaml
```

## Apply
```bash
python scripts/linear/bootstrap.py --mode apply --seed ops/linear/eventtrip-mvp-seed.yaml
```

## Verify
- Project exists: `EventTrip.ai MVP`
- Milestones count: `5`
- Labels count: `6`
- Issue count: `>=30`
````

**Step 4: Run test to verify it passes**

Run: `python -m pytest tests/linear/test_runbook.py::test_runbook_includes_required_commands -v`
Expected: PASS

**Step 5: Commit**

```bash
git add docs/linear/README.md tests/linear/test_runbook.py
git commit -m "docs(linear): add bootstrap runbook and verification"
```

## Final Verification Checklist

Run the full suite before applying to Linear:

```bash
python -m pytest tests/linear -v
```

Expected: all tests PASS.

Run dry-run and inspect planned operations:

```bash
python scripts/linear/bootstrap.py --mode dry-run --seed ops/linear/eventtrip-mvp-seed.yaml
```

Expected: prints plan for project + 5 milestones + 6 labels + >=30 issues, with no API writes.

Apply to Linear:

```bash
python scripts/linear/bootstrap.py --mode apply --seed ops/linear/eventtrip-mvp-seed.yaml
```

Expected: creates missing objects and skips existing objects on re-run.

## Rollback Strategy

1. Use Linear UI bulk actions to archive mistakenly created issues in the MVP project.
2. Keep script idempotent to prevent duplicate writes.
3. Re-run in `dry-run` after rollback to validate expected create/update counts before another `apply`.
