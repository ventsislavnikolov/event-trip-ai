import assert from "node:assert/strict";
import test from "node:test";
import { calculatePercentile } from "../../lib/eventtrip/performance/percentiles";

test("calculatePercentile returns p95 from sorted sample values", () => {
  const values = [100, 120, 140, 160, 180, 200, 220, 240, 260, 280];
  const p95 = calculatePercentile(values, 0.95);

  assert.equal(p95, 280);
});
