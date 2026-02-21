import assert from "node:assert/strict";
import test from "node:test";
import {
  DeadlineExceededError,
  runWithDeadline,
} from "../../lib/eventtrip/pipeline/deadline";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

test("runWithDeadline returns the operation result when it finishes before deadline", async () => {
  const result = await runWithDeadline(async () => {
    await sleep(5);
    return "ok";
  }, 50);

  assert.equal(result, "ok");
});

test("runWithDeadline throws DeadlineExceededError when deadline elapses", async () => {
  await assert.rejects(
    () =>
      runWithDeadline(async () => {
        await sleep(50);
        return "late";
      }, 10),
    (error: unknown) =>
      error instanceof DeadlineExceededError && error.deadlineMs === 10
  );
});
