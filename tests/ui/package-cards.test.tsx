import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { PackageCards } from "../../components/eventtrip/package-cards";

const samplePackages = [
  {
    id: "pkg-budget",
    tier: "Budget" as const,
    currency: "EUR",
    ticketPrice: 120,
    flightPrice: 180,
    hotelPrice: 200,
    totalPrice: 500,
    withinBudget: true,
    overBudgetAmount: 0,
    bookingLinks: {
      ticket: "https://example.com/ticket",
      flight: "https://example.com/flight",
      hotel: "https://example.com/hotel",
    },
  },
  {
    id: "pkg-value",
    tier: "Best Value" as const,
    currency: "EUR",
    ticketPrice: 160,
    flightPrice: 220,
    hotelPrice: 240,
    totalPrice: 620,
    withinBudget: false,
    overBudgetAmount: 70,
  },
  {
    id: "pkg-premium",
    tier: "Premium" as const,
    currency: "EUR",
    ticketPrice: 260,
    flightPrice: 280,
    hotelPrice: 360,
    totalPrice: 900,
    withinBudget: false,
    overBudgetAmount: 350,
  },
];

test("renders package cards with all tiers and line-item pricing", () => {
  const html = renderToStaticMarkup(<PackageCards packages={samplePackages} />);

  assert.match(html, /Budget/);
  assert.match(html, /Best Value/);
  assert.match(html, /Premium/);
  assert.match(html, /Ticket/);
  assert.match(html, /Flight/);
  assert.match(html, /Hotel/);
  assert.match(html, /Total/);
});

test("shows over-budget badge when package exceeds max budget", () => {
  const html = renderToStaticMarkup(<PackageCards packages={samplePackages} />);

  assert.match(html, /Within budget/);
  assert.match(html, /Over by 70 EUR/);
});
