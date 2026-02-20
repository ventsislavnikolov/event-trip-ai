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

test("runEventTripPipeline uses provider-derived package options when available", async () => {
  const result = await runEventTripPipeline({
    intent: {
      event: "Tomorrowland",
      originCity: "SOF",
      travelers: 1,
      maxBudgetPerPerson: 1200,
    },
    providers: {
      ticketmaster: async () => [
        {
          id: "tm-1",
          name: "Tomorrowland 2026",
          city: "Boom",
          country: "BE",
        },
      ],
      seatgeek: async () => [],
      travelpayouts: async () => ({
        flights: [
          {
            id: "f-1",
            origin: "SOF",
            destination: "BRU",
            price: 140,
            currency: "EUR",
          },
          {
            id: "f-2",
            origin: "SOF",
            destination: "BRU",
            price: 220,
            currency: "EUR",
          },
          {
            id: "f-3",
            origin: "SOF",
            destination: "BRU",
            price: 330,
            currency: "EUR",
          },
        ],
        hotels: [
          {
            id: "h-1",
            name: "Stay 1",
            city: "Boom",
            pricePerNight: 160,
            currency: "EUR",
          },
          {
            id: "h-2",
            name: "Stay 2",
            city: "Boom",
            pricePerNight: 230,
            currency: "EUR",
          },
          {
            id: "h-3",
            name: "Stay 3",
            city: "Boom",
            pricePerNight: 340,
            currency: "EUR",
          },
        ],
      }),
    },
  });

  assert.equal(result.packages.length, 3);
  assert.equal(
    result.packages.every((pkg) => pkg.id.startsWith("provider-")),
    true
  );
});
