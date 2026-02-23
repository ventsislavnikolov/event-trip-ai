import assert from "node:assert/strict";
import test from "node:test";

import { runEventTripPipeline } from "../../lib/eventtrip/pipeline/run-eventtrip-pipeline";

const PROVIDER_FIXTURE_FLIGHTS = [
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
];

const PROVIDER_FIXTURE_HOTELS = [
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
];

function createProviderFixture() {
  return {
    ticketmaster: async () => [
      {
        id: "tm-1",
        name: "Tomorrowland 2026",
        city: "Boom",
        country: "BE",
        startsAt: "2026-07-20T18:00:00.000Z",
      },
    ],
    seatgeek: async () => [],
    travelpayouts: async () => ({
      flights: PROVIDER_FIXTURE_FLIGHTS,
      hotels: PROVIDER_FIXTURE_HOTELS,
    }),
  };
}

test("runEventTripPipeline returns three ranked package cards", async () => {
  const result = await runEventTripPipeline({
    intent: {
      event: "Tomorrowland",
      originCity: "Sofia",
      travelers: 2,
      maxBudgetPerPerson: 1200,
    },
    providers: createProviderFixture(),
  });

  assert.equal(result.degraded, false);
  assert.equal(result.selectionRequired, false);
  assert.equal(result.packages.length, 3);
  assert.deepEqual(
    result.packages.map((pkg) => pkg.tier),
    ["Budget", "Best Value", "Premium"]
  );
  assert.equal(typeof result.observability.totalDurationMs, "number");
  assert.equal(
    typeof result.observability.packageGenerationDurationMs,
    "number"
  );
  assert.equal(
    typeof result.observability.providerLatencyMs.ticketmaster,
    "number"
  );
  assert.equal(
    typeof result.observability.providerLatencyMs.seatgeek,
    "number"
  );
  assert.equal(
    typeof result.observability.providerLatencyMs.travelpayouts,
    "number"
  );
  assert.equal(
    typeof result.observability.queryVariantCounts.ticketmaster,
    "number"
  );
  assert.equal(
    typeof result.observability.queryVariantCounts.seatgeek,
    "number"
  );
  assert.equal(
    typeof result.observability.queryVariantCounts.curated,
    "number"
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
    providers: createProviderFixture(),
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
  assert.equal(result.selectedEvent?.provider, "ticketmaster");
  assert.equal(result.selectedEvent?.providerEventId, "tm-1");
  assert.equal(result.selectedEvent?.name, "Tomorrowland 2026");
  assert.equal(result.candidates.length, 1);
  assert.equal(result.candidates[0]?.name, "Tomorrowland 2026");
  assert.equal(result.candidates[0]?.location, "Boom, BE");
});

test("runEventTripPipeline retries travel lookup with selected event city", async () => {
  const travelCalls: string[] = [];

  const result = await runEventTripPipeline({
    intent: {
      event: "Tomorrowland",
      originCity: "SOF",
      travelers: 1,
    },
    providers: {
      ticketmaster: async () => [
        {
          id: "tm-1",
          name: "Tomorrowland 2026",
          city: "Boom",
          country: "BE",
          startsAt: "2026-07-20T18:00:00.000Z",
        },
      ],
      seatgeek: async () => [],
      travelpayouts: ({ destinationCity }) => {
        travelCalls.push(destinationCity);

        if (destinationCity === "Boom") {
          return Promise.resolve({
            flights: [
              {
                id: "f-1",
                origin: "SOF",
                destination: "BRU",
                price: 200,
                currency: "EUR",
              },
              {
                id: "f-2",
                origin: "SOF",
                destination: "BRU",
                price: 250,
                currency: "EUR",
              },
              {
                id: "f-3",
                origin: "SOF",
                destination: "BRU",
                price: 300,
                currency: "EUR",
              },
            ],
            hotels: [
              {
                id: "h-1",
                name: "Stay 1",
                city: "Boom",
                pricePerNight: 150,
                currency: "EUR",
              },
              {
                id: "h-2",
                name: "Stay 2",
                city: "Boom",
                pricePerNight: 200,
                currency: "EUR",
              },
              {
                id: "h-3",
                name: "Stay 3",
                city: "Boom",
                pricePerNight: 260,
                currency: "EUR",
              },
            ],
          });
        }

        return Promise.resolve({ flights: [], hotels: [] });
      },
    },
  });

  assert.equal(travelCalls[0], "Tomorrowland");
  assert.equal(travelCalls[1], "Boom");
  assert.equal(
    result.packages.every((pkg) => pkg.id.startsWith("provider-")),
    true
  );
});

test("runEventTripPipeline retries when hotels are missing and merges retry results", async () => {
  const travelCalls: string[] = [];

  const result = await runEventTripPipeline({
    intent: {
      event: "Tomorrowland",
      originCity: "SOF",
      travelers: 1,
    },
    providers: {
      ticketmaster: async () => [
        {
          id: "tm-1",
          name: "Tomorrowland 2026",
          city: "Boom",
          country: "BE",
          startsAt: "2026-07-20T18:00:00.000Z",
        },
      ],
      seatgeek: async () => [],
      travelpayouts: ({ destinationCity }) => {
        travelCalls.push(destinationCity);

        if (destinationCity === "Boom") {
          return Promise.resolve({
            flights: [],
            hotels: [
              {
                id: "h-1",
                name: "Stay 1",
                city: "Boom",
                pricePerNight: 150,
                currency: "EUR",
              },
              {
                id: "h-2",
                name: "Stay 2",
                city: "Boom",
                pricePerNight: 200,
                currency: "EUR",
              },
              {
                id: "h-3",
                name: "Stay 3",
                city: "Boom",
                pricePerNight: 260,
                currency: "EUR",
              },
            ],
          });
        }

        return Promise.resolve({
          flights: [
            {
              id: "f-1",
              origin: "SOF",
              destination: "BRU",
              price: 200,
              currency: "EUR",
            },
            {
              id: "f-2",
              origin: "SOF",
              destination: "BRU",
              price: 250,
              currency: "EUR",
            },
            {
              id: "f-3",
              origin: "SOF",
              destination: "BRU",
              price: 300,
              currency: "EUR",
            },
          ],
          hotels: [],
        });
      },
    },
  });

  assert.equal(travelCalls[0], "Tomorrowland");
  assert.equal(travelCalls[1], "Boom");
  assert.equal(result.packages.length, 3);
  assert.equal(
    result.packages.every((pkg) => pkg.id.startsWith("provider-")),
    true
  );
});

test("runEventTripPipeline prefers explicit selectedEventCandidateId", async () => {
  const result = await runEventTripPipeline({
    intent: {
      event: "Tomorrowland",
      originCity: "SOF",
      travelers: 1,
      maxBudgetPerPerson: 1200,
      selectedEventCandidateId: "seatgeek:sg-9",
    },
    providers: {
      ticketmaster: async () => [
        {
          id: "tm-1",
          name: "Tomorrowland 2026",
          city: "Boom",
          country: "BE",
          startsAt: "2026-07-20T18:00:00.000Z",
        },
      ],
      seatgeek: async () => [
        {
          id: "sg-9",
          title: "Tomorrowland Side Event",
          city: "Antwerp",
          country: "BE",
          startsAt: "2026-07-19T18:00:00.000Z",
        },
      ],
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
            city: "Antwerp",
            pricePerNight: 160,
            currency: "EUR",
          },
          {
            id: "h-2",
            name: "Stay 2",
            city: "Antwerp",
            pricePerNight: 230,
            currency: "EUR",
          },
          {
            id: "h-3",
            name: "Stay 3",
            city: "Antwerp",
            pricePerNight: 340,
            currency: "EUR",
          },
        ],
      }),
    },
  });

  assert.equal(result.selectedEvent?.provider, "seatgeek");
  assert.equal(result.selectedEvent?.providerEventId, "sg-9");
  assert.equal(result.selectedEvent?.city, "Antwerp");
});

test("runEventTripPipeline picks best event name match across providers", async () => {
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
          name: "Electronic Music Showcase",
          city: "Boom",
          country: "BE",
          startsAt: "2026-07-20T18:00:00.000Z",
        },
      ],
      seatgeek: async () => [
        {
          id: "sg-1",
          title: "Tomorrowland 2026",
          city: "Antwerp",
          country: "BE",
          startsAt: "2026-07-20T18:00:00.000Z",
        },
      ],
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
            city: "Antwerp",
            pricePerNight: 160,
            currency: "EUR",
          },
          {
            id: "h-2",
            name: "Stay 2",
            city: "Antwerp",
            pricePerNight: 230,
            currency: "EUR",
          },
          {
            id: "h-3",
            name: "Stay 3",
            city: "Antwerp",
            pricePerNight: 340,
            currency: "EUR",
          },
        ],
      }),
    },
  });

  assert.equal(result.selectedEvent?.provider, "seatgeek");
  assert.equal(result.selectedEvent?.providerEventId, "sg-1");
});

test("runEventTripPipeline retries provider event lookup with normalized query variants", async () => {
  const ticketmasterQueries: string[] = [];
  const seatGeekQueries: string[] = [];

  const result = await runEventTripPipeline({
    intent: {
      event: "Tomorrowland 2026 Live",
      originCity: "SOF",
      travelers: 1,
      maxBudgetPerPerson: 1200,
    },
    providers: {
      ticketmaster: (query) => {
        ticketmasterQueries.push(query);
        if (query === "Tomorrowland") {
          return Promise.resolve([
            {
              id: "tm-1",
              name: "Tomorrowland 2026",
              city: "Boom",
              country: "BE",
              startsAt: "2026-07-20T18:00:00.000Z",
            },
          ]);
        }

        return Promise.resolve([]);
      },
      seatgeek: (query) => {
        seatGeekQueries.push(query);
        return Promise.resolve([]);
      },
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

  assert.deepEqual(ticketmasterQueries, [
    "Tomorrowland 2026 Live",
    "Tomorrowland Live",
    "Tomorrowland",
  ]);
  assert.deepEqual(seatGeekQueries, [
    "Tomorrowland 2026 Live",
    "Tomorrowland Live",
    "Tomorrowland",
  ]);
  assert.equal(result.selectedEvent?.provider, "ticketmaster");
  assert.equal(result.selectedEvent?.providerEventId, "tm-1");
});

test("runEventTripPipeline broadens motorsport queries before curated fallback", async () => {
  const ticketmasterQueries: string[] = [];
  const seatGeekQueries: string[] = [];
  const curatedQueries: string[] = [];

  const result = await runEventTripPipeline({
    intent: {
      event: "Formula 1 Italy Grand Prix 2026",
      originCity: "SOF",
      travelers: 1,
      maxBudgetPerPerson: 1200,
    },
    providers: {
      ticketmaster: (query) => {
        ticketmasterQueries.push(query);
        return Promise.resolve([]);
      },
      seatgeek: (query) => {
        seatGeekQueries.push(query);
        return Promise.resolve([]);
      },
      curatedIndex: (query) => {
        curatedQueries.push(query);
        if (query === "Formula 1") {
          return Promise.resolve([
            {
              id: "curated-f1-italian-gp-2026",
              name: "Formula 1 Italian Grand Prix 2026",
              city: "Monza",
              country: "IT",
              startsAt: "2026-09-06T13:00:00.000Z",
            },
          ]);
        }
        return Promise.resolve([]);
      },
      travelpayouts: async () => ({
        flights: PROVIDER_FIXTURE_FLIGHTS,
        hotels: PROVIDER_FIXTURE_HOTELS,
      }),
    },
  });

  assert.equal(ticketmasterQueries.includes("Formula 1"), true);
  assert.equal(
    ticketmasterQueries.some((query) => /grand prix/i.test(query)),
    true
  );
  assert.equal(
    ticketmasterQueries.some((query) => query.includes("Italy")),
    true
  );
  assert.equal(
    seatGeekQueries.includes("Formula 1") &&
      seatGeekQueries.some((query) => /grand prix/i.test(query)),
    true
  );
  assert.equal(curatedQueries.includes("Formula 1"), true);
  assert.equal(result.observability.queryVariantCounts.ticketmaster > 3, true);
  assert.equal(result.observability.queryVariantCounts.seatgeek > 3, true);
  assert.equal(result.selectedEvent?.provider, "curated");
});

test("runEventTripPipeline de-duplicates candidate list across providers", async () => {
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
          startsAt: "2026-07-20T18:00:00.000Z",
        },
      ],
      seatgeek: async () => [
        {
          id: "sg-1",
          title: "Tomorrowland 2026",
          city: "Boom",
          country: "BE",
          startsAt: "2026-07-20T18:00:00.000Z",
        },
      ],
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

  assert.equal(result.candidates.length, 1);
  assert.equal(result.candidates[0]?.name, "Tomorrowland 2026");
  assert.equal(result.candidates[0]?.location, "Boom, BE");
});

test("runEventTripPipeline tie-breaks matching events by nearest start date", async () => {
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
          name: "Tomorrowland",
          city: "Boom",
          country: "BE",
          startsAt: "2030-07-20T18:00:00.000Z",
        },
      ],
      seatgeek: async () => [
        {
          id: "sg-1",
          title: "Tomorrowland",
          city: "Boom",
          country: "BE",
          startsAt: "2026-07-20T18:00:00.000Z",
        },
      ],
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

  assert.equal(result.selectedEvent?.provider, "seatgeek");
  assert.equal(result.selectedEvent?.providerEventId, "sg-1");
});

test("runEventTripPipeline tie-breaks matching events by richer metadata when date missing", async () => {
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
          name: "Tomorrowland",
          city: "Boom",
          country: "BE",
          venue: "Main Stage",
        },
      ],
      seatgeek: async () => [
        {
          id: "sg-1",
          title: "Tomorrowland",
        },
      ],
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

  assert.equal(result.selectedEvent?.provider, "ticketmaster");
  assert.equal(result.selectedEvent?.providerEventId, "tm-1");
});

test("runEventTripPipeline resolves event from curated index when APIs return empty", async () => {
  const result = await runEventTripPipeline({
    intent: {
      event: "Tomorrowland",
      originCity: "SOF",
      travelers: 1,
      maxBudgetPerPerson: 1200,
    },
    providers: {
      ticketmaster: async () => [],
      seatgeek: async () => [],
      curatedIndex: async () => [
        {
          id: "curated-tm-1",
          name: "Tomorrowland 2026",
          city: "Boom",
          country: "BE",
          startsAt: "2026-07-20T18:00:00.000Z",
        },
      ],
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

  assert.equal(result.selectedEvent?.provider, "curated");
  assert.equal(result.selectedEvent?.providerEventId, "curated-tm-1");
  assert.equal(result.selectionRequired, false);
  assert.equal(result.candidates[0]?.id, "curated:curated-tm-1");
});

test("runEventTripPipeline requires explicit selection for ambiguous curated fallback", async () => {
  const result = await runEventTripPipeline({
    intent: {
      event: "Formula 1 Italy Grand Prix 2026",
      originCity: "SOF",
      travelers: 1,
      maxBudgetPerPerson: 1200,
    },
    providers: {
      ticketmaster: async () => [],
      seatgeek: async () => [],
      curatedIndex: async () => [
        {
          id: "curated-f1-monaco-2026",
          name: "Formula 1 Monaco Grand Prix 2026",
          city: "Monte Carlo",
          country: "MC",
          startsAt: "2026-05-24T10:00:00.000Z",
        },
        {
          id: "curated-f1-italian-gp-2026",
          name: "Formula 1 Italian Grand Prix 2026",
          city: "Monza",
          country: "IT",
          startsAt: "2026-09-06T13:00:00.000Z",
        },
      ],
      travelpayouts: async () => ({
        flights: PROVIDER_FIXTURE_FLIGHTS,
        hotels: PROVIDER_FIXTURE_HOTELS,
      }),
    },
  });

  assert.equal(result.selectionRequired, true);
  assert.equal(result.selectionReason, "ambiguous_curated_fallback");
  assert.equal(result.selectedEvent, null);
  assert.equal(result.packages.length, 0);
  assert.equal(result.candidates.length, 2);
});

test("runEventTripPipeline generates packages after explicit curated selection", async () => {
  const result = await runEventTripPipeline({
    intent: {
      event: "Formula 1 Italy Grand Prix 2026",
      originCity: "SOF",
      travelers: 1,
      maxBudgetPerPerson: 1200,
      selectedEventCandidateId: "curated:curated-f1-italian-gp-2026",
    },
    providers: {
      ticketmaster: async () => [],
      seatgeek: async () => [],
      curatedIndex: async () => [
        {
          id: "curated-f1-monaco-2026",
          name: "Formula 1 Monaco Grand Prix 2026",
          city: "Monte Carlo",
          country: "MC",
          startsAt: "2026-05-24T10:00:00.000Z",
        },
        {
          id: "curated-f1-italian-gp-2026",
          name: "Formula 1 Italian Grand Prix 2026",
          city: "Monza",
          country: "IT",
          startsAt: "2026-09-06T13:00:00.000Z",
        },
      ],
      travelpayouts: async () => ({
        flights: PROVIDER_FIXTURE_FLIGHTS,
        hotels: PROVIDER_FIXTURE_HOTELS,
      }),
    },
  });

  assert.equal(result.selectionRequired, false);
  assert.equal(result.selectedEvent?.provider, "curated");
  assert.equal(
    result.selectedEvent?.providerEventId,
    "curated-f1-italian-gp-2026"
  );
  assert.equal(result.packages.length, 3);
});
