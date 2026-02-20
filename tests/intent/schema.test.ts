import assert from "node:assert/strict";
import test from "node:test";

import { validateEventTripIntent } from "../../lib/eventtrip/intent/schema";

test("validateEventTripIntent accepts valid values and normalizes strings", () => {
  const result = validateEventTripIntent({
    event: " Tomorrowland ",
    originCity: " Sofia ",
    travelers: "2",
    maxBudgetPerPerson: "1200 EUR",
    selectedEventCandidateId: " ticketmaster:tm-1 ",
  });

  assert.equal(result.success, true);

  if (!result.success) {
    assert.fail("Expected validator to accept a valid intent payload");
  }

  assert.deepEqual(result.data, {
    event: "Tomorrowland",
    originCity: "Sofia",
    travelers: 2,
    maxBudgetPerPerson: 1200,
    selectedEventCandidateId: "ticketmaster:tm-1",
  });
});

test("validateEventTripIntent rejects unknown fields under strict schema", () => {
  const result = validateEventTripIntent({
    event: "Tomorrowland",
    originCity: "Sofia",
    travelers: 2,
    maxBudgetPerPerson: 1200,
    selectedEventCandidateId: "ticketmaster:tm-1",
    currency: "EUR",
  });

  assert.equal(result.success, false);
});

test("validateEventTripIntent rejects invalid traveler values", () => {
  const result = validateEventTripIntent({
    event: "Tomorrowland",
    originCity: "Sofia",
    travelers: 0,
    maxBudgetPerPerson: 1200,
  });

  assert.equal(result.success, false);
});
