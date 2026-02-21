import assert from "node:assert/strict";
import test from "node:test";
import { formatEventTripHistorySummary } from "../../lib/eventtrip/persistence/history-summary";

test("formatEventTripHistorySummary formats event and location details", () => {
  const label = formatEventTripHistorySummary({
    eventQuery: "Tomorrowland",
    originCity: "Sofia",
    travelers: 2,
    maxBudgetPerPerson: 1200,
    event: {
      name: "Tomorrowland 2026",
      city: "Boom",
      country: "BE",
      startsAt: "2026-07-20T18:00:00.000Z",
    },
  });

  assert.match(label, /Tomorrowland 2026/);
  assert.match(label, /from Sofia/);
  assert.match(label, /2 travelers/);
  assert.match(label, /budget 1200 pp/);
  assert.match(label, /Boom, BE/);
});

test("formatEventTripHistorySummary falls back to query and singular traveler", () => {
  const label = formatEventTripHistorySummary({
    eventQuery: "US Open",
    originCity: "Sofia",
    travelers: 1,
    maxBudgetPerPerson: null,
    event: null,
  });

  assert.match(label, /^US Open/);
  assert.match(label, /1 traveler/);
  assert.doesNotMatch(label, /budget/i);
});
