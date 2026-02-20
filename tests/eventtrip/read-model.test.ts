import assert from "node:assert/strict";
import test from "node:test";
import { toPersistedEventTripResult } from "../../lib/eventtrip/persistence/read-model";

test("toPersistedEventTripResult maps persisted rows into UI package shape", () => {
  const result = toPersistedEventTripResult({
    tripRequest: {
      id: "trip-1",
      chat_id: "chat-1",
      event_query: "Tomorrowland 2026",
      origin_city: "Sofia",
      travelers: 2,
      max_budget_per_person: "500.00",
      status: "ready",
      created_at: "2026-02-20T12:00:00.000Z",
      event_provider: "ticketmaster",
      event_provider_event_id: "tm-1",
      event_name: "Tomorrowland 2026",
      event_city: "Boom",
      event_country: "BE",
      event_venue: "Main Stage",
      event_starts_at: "2026-07-20T18:00:00.000Z",
      event_ends_at: "2026-07-22T23:00:00.000Z",
    },
    packageRows: [
      {
        id: "pkg-1",
        trip_request_id: "trip-1",
        tier: "Budget",
        total_price: "900.00",
        price_per_person: "450.00",
        within_budget: true,
        ticket_price: "200.00",
        flight_price: "300.00",
        hotel_price: "400.00",
        currency: "EUR",
        outbound_links: {
          ticket: "https://example.com/t",
          flight: "https://example.com/f",
          hotel: "https://example.com/h",
        },
        created_at: "2026-02-20T12:00:01.000Z",
      },
      {
        id: "pkg-2",
        trip_request_id: "trip-1",
        tier: "Premium",
        total_price: "1400.00",
        price_per_person: "700.00",
        within_budget: false,
        ticket_price: "300.00",
        flight_price: "500.00",
        hotel_price: "600.00",
        currency: "EUR",
        outbound_links: {
          ticket: "https://example.com/t2",
        },
        created_at: "2026-02-20T12:00:02.000Z",
      },
    ],
  });

  assert.equal(result.tripRequestId, "trip-1");
  assert.equal(result.chatId, "chat-1");
  assert.equal(result.eventQuery, "Tomorrowland 2026");
  assert.equal(result.originCity, "Sofia");
  assert.equal(result.maxBudgetPerPerson, 500);
  assert.equal(result.event?.provider, "ticketmaster");
  assert.equal(result.event?.providerEventId, "tm-1");
  assert.equal(result.event?.city, "Boom");
  assert.equal(result.event?.startsAt, "2026-07-20T18:00:00.000Z");
  assert.equal(result.packages.length, 2);
  assert.equal(result.packages[0]?.tier, "Budget");
  assert.equal(result.packages[0]?.overBudgetAmount, 0);
  assert.equal(result.packages[1]?.tier, "Premium");
  assert.equal(result.packages[1]?.overBudgetAmount, 200);
  assert.equal(
    result.packages[1]?.bookingLinks.ticket,
    "https://example.com/t2"
  );
});
