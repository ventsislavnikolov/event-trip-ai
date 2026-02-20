import assert from "node:assert/strict";
import test from "node:test";
import { fetchSeatGeekEvents } from "../../lib/eventtrip/providers/seatgeek";
import { fetchTicketmasterEvents } from "../../lib/eventtrip/providers/ticketmaster";
import {
  fetchTravelPayoutsFlights,
  fetchTravelPayoutsHotels,
} from "../../lib/eventtrip/providers/travelpayouts";

const ENV_KEYS = [
  "TICKETMASTER_API_KEY",
  "SEATGEEK_CLIENT_ID",
  "SEATGEEK_CLIENT_SECRET",
  "TRAVELPAYOUTS_API_TOKEN",
  "TRAVELPAYOUTS_MARKER",
] as const;

const originalFetch = globalThis.fetch;
const originalEnv = new Map<string, string | undefined>(
  ENV_KEYS.map((key) => [key, process.env[key]])
);

function resetEnv() {
  for (const key of ENV_KEYS) {
    const previous = originalEnv.get(key);
    process.env[key] = previous ?? "";
  }
}

function mockFetch(
  handler: (input: string, init?: RequestInit) => Response | Promise<Response>
) {
  globalThis.fetch = (async (
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> =>
    Promise.resolve(handler(String(input), init))) as typeof fetch;
}

test("maps Ticketmaster event payload into provider shape", async () => {
  process.env.TICKETMASTER_API_KEY = "tm-key";
  let requestUrl = "";

  mockFetch((input) => {
    requestUrl = input;
    return new Response(
      JSON.stringify({
        _embedded: {
          events: [
            {
              id: "tm-1",
              name: "Tomorrowland 2026",
              dates: {
                start: { dateTime: "2026-07-20T18:00:00Z" },
                end: { dateTime: "2026-07-22T23:00:00Z" },
              },
              _embedded: {
                venues: [
                  {
                    name: "Main Stage",
                    city: { name: "Boom" },
                    country: { countryCode: "BE" },
                  },
                ],
              },
            },
          ],
        },
      }),
      { status: 200 }
    );
  });

  const events = await fetchTicketmasterEvents("tomorrowland");

  assert.equal(events.length, 1);
  assert.equal(events[0]?.id, "tm-1");
  assert.equal(events[0]?.name, "Tomorrowland 2026");
  assert.equal(events[0]?.city, "Boom");
  assert.equal(events[0]?.country, "BE");
  assert.match(requestUrl, /keyword=tomorrowland/i);
  assert.match(requestUrl, /apikey=tm-key/i);

  resetEnv();
});

test("maps SeatGeek event payload into provider shape", async () => {
  process.env.SEATGEEK_CLIENT_ID = "sg-client-id";
  process.env.SEATGEEK_CLIENT_SECRET = "sg-client-secret";
  let requestUrl = "";

  mockFetch((input) => {
    requestUrl = input;
    return new Response(
      JSON.stringify({
        events: [
          {
            id: 42,
            title: "US Open",
            datetime_utc: "2026-09-01T12:00:00Z",
            venue: {
              name: "Arthur Ashe Stadium",
              city: "New York",
              country: "US",
            },
          },
        ],
      }),
      { status: 200 }
    );
  });

  const events = await fetchSeatGeekEvents("us open");

  assert.equal(events.length, 1);
  assert.equal(events[0]?.id, "42");
  assert.equal(events[0]?.title, "US Open");
  assert.equal(events[0]?.venue, "Arthur Ashe Stadium");
  assert.equal(events[0]?.city, "New York");
  assert.equal(events[0]?.country, "US");
  assert.match(requestUrl, /q=us\+open/i);
  assert.match(requestUrl, /client_id=sg-client-id/i);

  resetEnv();
});

test("returns empty travel results when Travelpayouts token is missing", async () => {
  process.env.TRAVELPAYOUTS_API_TOKEN = "";
  let called = false;

  mockFetch(() => {
    called = true;
    return new Response("{}", { status: 200 });
  });

  const flights = await fetchTravelPayoutsFlights({
    originCity: "SOF",
    destinationCity: "BER",
    departDate: "2026-09-10",
    returnDate: "2026-09-15",
  });

  const hotels = await fetchTravelPayoutsHotels({
    destinationCity: "Berlin",
    checkInDate: "2026-09-10",
    checkOutDate: "2026-09-15",
  });

  assert.deepEqual(flights, []);
  assert.deepEqual(hotels, []);
  assert.equal(called, false);

  resetEnv();
});

test("maps Travelpayouts flight and hotel payloads", async () => {
  process.env.TRAVELPAYOUTS_API_TOKEN = "tp-token";
  process.env.TRAVELPAYOUTS_MARKER = "tp-marker";
  const requests: string[] = [];

  mockFetch((input) => {
    requests.push(input);

    if (input.includes("/v1/prices/cheap")) {
      return new Response(
        JSON.stringify({
          success: true,
          data: {
            "2026-09-10": {
              origin: "SOF",
              destination: "BER",
              price: 179,
              airline: "LH",
            },
          },
        }),
        { status: 200 }
      );
    }

    return new Response(
      JSON.stringify([
        {
          hotelId: 11,
          hotelName: "Mitte Stay",
          locationName: "Berlin",
          priceFrom: 110,
        },
      ]),
      { status: 200 }
    );
  });

  const flights = await fetchTravelPayoutsFlights({
    originCity: "SOF",
    destinationCity: "BER",
    departDate: "2026-09-10",
    returnDate: "2026-09-15",
  });

  const hotels = await fetchTravelPayoutsHotels({
    destinationCity: "Berlin",
    checkInDate: "2026-09-10",
    checkOutDate: "2026-09-15",
  });

  assert.equal(flights.length, 1);
  assert.equal(flights[0]?.price, 179);
  assert.equal(flights[0]?.airline, "LH");
  assert.equal(hotels.length, 1);
  assert.equal(hotels[0]?.pricePerNight, 110);
  assert.equal(hotels[0]?.city, "Berlin");
  assert.ok(requests.some((value) => value.includes("/v1/prices/cheap")));
  assert.ok(requests.some((value) => value.includes("/api/v2/cache.json")));
  assert.ok(requests.some((value) => value.includes("marker=tp-marker")));

  resetEnv();
});

test.after(() => {
  if (originalFetch) {
    globalThis.fetch = originalFetch;
  }
  resetEnv();
});
