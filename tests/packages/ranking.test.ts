import assert from "node:assert/strict";
import test from "node:test";

import { rankPackageOptions } from "../../lib/eventtrip/packages/ranking";

const baseOptions = [
  {
    id: "budget-a",
    ticketPrice: 120,
    flightPrice: 180,
    hotelPrice: 200,
    qualityScore: 50,
    currency: "EUR",
  },
  {
    id: "value-b",
    ticketPrice: 160,
    flightPrice: 220,
    hotelPrice: 240,
    qualityScore: 85,
    currency: "EUR",
  },
  {
    id: "premium-c",
    ticketPrice: 260,
    flightPrice: 280,
    hotelPrice: 360,
    qualityScore: 95,
    currency: "EUR",
  },
  {
    id: "outlier-d",
    ticketPrice: 600,
    flightPrice: 700,
    hotelPrice: 900,
    qualityScore: 100,
    currency: "EUR",
  },
];

test("assigns Budget, Best Value, Premium tiers deterministically", () => {
  const result = rankPackageOptions(baseOptions, {
    maxBudgetPerPerson: 1200,
  });

  assert.equal(result.tiers[0].tier, "Budget");
  assert.equal(result.tiers[0].id, "budget-a");

  assert.equal(result.tiers[1].tier, "Best Value");
  assert.equal(result.tiers[1].id, "value-b");

  assert.equal(result.tiers[2].tier, "Premium");
  assert.equal(result.tiers[2].id, "premium-c");
});

test("marks package as over budget when total exceeds max budget per person", () => {
  const result = rankPackageOptions(baseOptions, {
    maxBudgetPerPerson: 550,
  });

  const budgetTier = result.tiers.find((tier) => tier.tier === "Budget");
  const bestValueTier = result.tiers.find((tier) => tier.tier === "Best Value");

  assert.equal(budgetTier?.withinBudget, true);
  assert.equal(bestValueTier?.withinBudget, false);
  assert.equal(bestValueTier?.overBudgetAmount, 70);
});
