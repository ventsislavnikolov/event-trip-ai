import assert from "node:assert/strict";
import test from "node:test";

import { runEventTripPipeline } from "../../lib/eventtrip/pipeline/run-eventtrip-pipeline";

test("runEventTripPipeline returns three ranked package cards", async () => {
  const result = await runEventTripPipeline({
    intent: {
      event: "Tomorrowland",
      originCity: "Sofia",
      travelers: 2,
      maxBudgetPerPerson: 1200,
    },
  });

  assert.equal(result.degraded, false);
  assert.equal(result.packages.length, 3);
  assert.deepEqual(
    result.packages.map((pkg) => pkg.tier),
    ["Budget", "Best Value", "Premium"]
  );
});

test("runEventTripPipeline marks over-budget tiers for low budget input", async () => {
  const result = await runEventTripPipeline({
    intent: {
      event: "Tomorrowland",
      originCity: "Sofia",
      travelers: 1,
      maxBudgetPerPerson: 400,
    },
  });

  const budget = result.packages.find((pkg) => pkg.tier === "Budget");
  const premium = result.packages.find((pkg) => pkg.tier === "Premium");

  assert.equal(budget?.withinBudget, false);
  assert.equal((budget?.overBudgetAmount ?? 0) > 0, true);
  assert.equal(premium?.withinBudget, false);
});
