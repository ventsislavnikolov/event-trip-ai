import assert from "node:assert/strict";
import test from "node:test";
import { injectPersistedEventTripPackagesMessage } from "../../lib/eventtrip/persistence/hydrate-messages";

test("injectPersistedEventTripPackagesMessage appends assistant package message", () => {
  const messages = [
    {
      id: "m-1",
      role: "user",
      parts: [{ type: "text", text: "Plan my trip" }],
    },
  ];

  const next = injectPersistedEventTripPackagesMessage({
    messages: messages as never,
    messageId: "m-2",
    packages: [
      {
        id: "pkg-1",
        tier: "Budget",
        currency: "EUR",
        ticketPrice: 100,
        flightPrice: 200,
        hotelPrice: 300,
        totalPrice: 600,
        withinBudget: true,
        overBudgetAmount: 0,
        bookingLinks: {},
      },
    ],
  });

  assert.equal(next.length, 2);
  assert.equal(next[1]?.id, "m-2");
  assert.equal(next[1]?.role, "assistant");
  assert.equal(next[1]?.parts[0]?.type, "data-eventtripPackages");
});

test("injectPersistedEventTripPackagesMessage does not append duplicate package part", () => {
  const messages = [
    {
      id: "m-1",
      role: "assistant",
      parts: [
        {
          type: "data-eventtripPackages",
          data: [
            {
              id: "pkg-1",
              tier: "Budget",
              currency: "EUR",
              ticketPrice: 100,
              flightPrice: 200,
              hotelPrice: 300,
              totalPrice: 600,
              withinBudget: true,
              overBudgetAmount: 0,
              bookingLinks: {},
            },
          ],
        },
      ],
    },
  ];

  const next = injectPersistedEventTripPackagesMessage({
    messages: messages as never,
    messageId: "m-2",
    packages: [
      {
        id: "pkg-2",
        tier: "Premium",
        currency: "EUR",
        ticketPrice: 200,
        flightPrice: 300,
        hotelPrice: 400,
        totalPrice: 900,
        withinBudget: true,
        overBudgetAmount: 0,
        bookingLinks: {},
      },
    ],
  });

  assert.equal(next.length, 1);
  assert.equal(next[0]?.id, "m-1");
});
