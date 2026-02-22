import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDecisionSummary,
  extractFailedChecks,
  formatLaunchDecisionMarkdown,
} from "../../scripts/launch-decision-report.mjs";

test("extractFailedChecks reads failed checks from readiness output", () => {
  const output = `
Failed checks:
- vercel-auth: Vercel authentication
- env-check-preview: Preview environment keys
`;

  assert.deepEqual(extractFailedChecks(output), [
    "vercel-auth: Vercel authentication",
    "env-check-preview: Preview environment keys",
  ]);
});

test("buildDecisionSummary returns NO-GO when command exits non-zero", () => {
  const summary = buildDecisionSummary({
    exitCode: 1,
    output: `
Failed checks:
- vercel-auth: Vercel authentication
`,
  });

  assert.equal(summary.decision, "NO-GO");
  assert.deepEqual(summary.failedChecks, [
    "vercel-auth: Vercel authentication",
  ]);
});

test("buildDecisionSummary returns GO with no failures on success", () => {
  const summary = buildDecisionSummary({
    exitCode: 0,
    output: "All launch readiness checks passed.",
  });

  assert.equal(summary.decision, "GO");
  assert.deepEqual(summary.failedChecks, []);
});

test("formatLaunchDecisionMarkdown renders key decision fields", () => {
  const markdown = formatLaunchDecisionMarkdown({
    generatedAt: "2026-02-22T12:00:00.000Z",
    gitBranch: "main",
    gitSha: "abc1234",
    command: "pnpm -s launch:readiness -- --skip-e2e",
    summary: {
      decision: "NO-GO",
      failedChecks: ["vercel-auth: Vercel authentication"],
      exitCode: 1,
    },
    rawOutput: "Failed checks:\n- vercel-auth: Vercel authentication",
  });

  assert.match(markdown, /# Launch Decision Review/);
  assert.match(markdown, /Decision: `NO-GO`/);
  assert.match(markdown, /- `vercel-auth: Vercel authentication`/);
  assert.match(markdown, /```text/);
});
