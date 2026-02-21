import assert from "node:assert/strict";
import test from "node:test";

import {
  buildLaunchReadinessChecks,
  parseLaunchReadinessArgs,
  runLaunchReadiness,
} from "../../scripts/launch-readiness.mjs";

test("parseLaunchReadinessArgs supports local-only and skip-e2e flags", () => {
  const parsed = parseLaunchReadinessArgs(["--local-only", "--skip-e2e"]);

  assert.equal(parsed.localOnly, true);
  assert.equal(parsed.skipE2E, true);
});

test("parseLaunchReadinessArgs ignores standalone double-dash separator", () => {
  const parsed = parseLaunchReadinessArgs(["--", "--skip-e2e"]);

  assert.equal(parsed.skipE2E, true);
});

test("buildLaunchReadinessChecks excludes deploy checks for local-only mode", () => {
  const checks = buildLaunchReadinessChecks({
    localOnly: true,
    skipE2E: false,
  });

  assert.equal(
    checks.some((check) => check.id === "vercel-auth"),
    false
  );
  assert.equal(
    checks.some((check) => check.id === "env-check-preview"),
    false
  );
  assert.equal(
    checks.some((check) => check.id === "env-check-production"),
    false
  );
});

test("runLaunchReadiness returns 0 when all checks pass", () => {
  const messages = [];
  const executedChecks = [];

  const exitCode = runLaunchReadiness({
    argv: ["--local-only", "--skip-e2e"],
    runCheck: (check) => {
      executedChecks.push(check.id);
      return { exitCode: 0, stdout: "ok", stderr: "" };
    },
    stdout: (line) => messages.push(line),
    stderr: (line) => messages.push(line),
  });

  assert.equal(exitCode, 0);
  assert.equal(executedChecks.length > 0, true);
  assert.match(messages.join("\n"), /all launch readiness checks passed/i);
});

test("runLaunchReadiness returns 1 and lists failed checks", () => {
  const messages = [];

  const exitCode = runLaunchReadiness({
    argv: ["--local-only", "--skip-e2e"],
    runCheck: (check) => {
      if (check.id === "build") {
        return {
          exitCode: 1,
          stdout: "",
          stderr: "simulated build failure",
        };
      }
      return { exitCode: 0, stdout: "ok", stderr: "" };
    },
    stdout: (line) => messages.push(line),
    stderr: (line) => messages.push(line),
  });

  assert.equal(exitCode, 1);
  assert.match(messages.join("\n"), /failed checks/i);
  assert.match(messages.join("\n"), /build/);
});
