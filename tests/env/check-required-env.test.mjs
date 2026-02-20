import assert from "node:assert/strict";
import test from "node:test";

import {
  evaluateEnvironment,
  runCli,
} from "../../scripts/check-required-env.mjs";

test("evaluateEnvironment reports missing required keys for local profile", () => {
  const result = evaluateEnvironment({
    profile: "local",
    env: {
      AUTH_SECRET: "secret-only",
    },
  });

  assert.equal(result.ok, false);
  assert.deepEqual(result.missingRequired, ["POSTGRES_URL"]);
});

test("evaluateEnvironment passes when required preview keys are present", () => {
  const result = evaluateEnvironment({
    profile: "vercel-preview",
    env: {
      AUTH_SECRET: "secret",
      POSTGRES_URL: "postgres://user:pass@db.example.com:5432/postgres",
    },
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.missingRequired, []);
});

test("runCli returns non-zero and clear message for missing keys", () => {
  const stdoutMessages = [];
  const stderrMessages = [];

  const exitCode = runCli({
    argv: ["local"],
    env: {
      AUTH_SECRET: "secret",
    },
    stdout: (message) => stdoutMessages.push(message),
    stderr: (message) => stderrMessages.push(message),
  });

  assert.equal(exitCode, 1);
  assert.equal(stdoutMessages.length, 0);
  assert.match(
    stderrMessages.join("\n"),
    /missing required environment variables/i
  );
  assert.match(stderrMessages.join("\n"), /POSTGRES_URL/);
});
