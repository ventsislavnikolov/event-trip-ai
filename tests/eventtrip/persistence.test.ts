import assert from "node:assert/strict";
import test from "node:test";
import {
  toEventTripEventRow,
  toEventTripPackageOptionRows,
  toEventTripTripRequestRow,
} from "../../lib/eventtrip/persistence/serialize";

test("toEventTripTripRequestRow maps intent into insert shape", () => {
  const row = toEventTripTripRequestRow({
    chatId: "chat-1",
    intent: {
      event: "Tomorrowland",
      originCity: "Sofia",
      travelers: 2,
      maxBudgetPerPerson: 950,
    },
  });

  assert.equal(row.chatId, "chat-1");
  assert.equal(row.eventQuery, "Tomorrowland");
  assert.equal(row.originCity, "Sofia");
  assert.equal(row.travelers, 2);
  assert.equal(row.maxBudgetPerPerson, 950);
  assert.equal(row.status, "ready");
});

test("toEventTripPackageOptionRows computes price_per_person and keeps links", () => {
  const rows = toEventTripPackageOptionRows({
    tripRequestId: "trip-1",
    travelers: 2,
    packages: [
      {
        id: "pkg-1",
        tier: "Budget",
        currency: "EUR",
        ticketPrice: 200,
        flightPrice: 300,
        hotelPrice: 400,
        totalPrice: 900,
        withinBudget: true,
        overBudgetAmount: 0,
        bookingLinks: {
          ticket: "https://example.com/t",
          flight: "https://example.com/f",
          hotel: "https://example.com/h",
        },
      },
    ],
  });

  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.tripRequestId, "trip-1");
  assert.equal(rows[0]?.tier, "Budget");
  assert.equal(rows[0]?.pricePerPerson, 450);
  assert.equal(rows[0]?.currency, "EUR");
  assert.deepEqual(rows[0]?.outboundLinks, {
    ticket: "https://example.com/t",
    flight: "https://example.com/f",
    hotel: "https://example.com/h",
  });
});

test("toEventTripEventRow maps selected provider event into et_events insert row", () => {
  const row = toEventTripEventRow({
    provider: "ticketmaster",
    providerEventId: "tm-1",
    name: "Tomorrowland 2026",
    city: "Boom",
    country: "BE",
    venue: "Main Stage",
    startsAt: "2026-07-20T18:00:00.000Z",
    endsAt: "2026-07-22T23:00:00.000Z",
  });

  assert.equal(row?.provider, "ticketmaster");
  assert.equal(row?.providerEventId, "tm-1");
  assert.equal(row?.startsAt, "2026-07-20T18:00:00.000Z");
  assert.equal(row?.city, "Boom");
});

test("toEventTripEventRow returns null when startsAt is missing", () => {
  const row = toEventTripEventRow({
    provider: "seatgeek",
    providerEventId: "sg-1",
    name: "US Open",
  });

  assert.equal(row, null);
});
