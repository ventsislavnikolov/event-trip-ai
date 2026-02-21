import { calculatePercentile } from "@/lib/eventtrip/performance/percentiles";
import { runEventTripPipeline } from "@/lib/eventtrip/pipeline/run-eventtrip-pipeline";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const SAMPLE_COUNT = Number.parseInt(
  process.env.EVENTTRIP_P95_SAMPLES ?? "30",
  10
);
const TARGET_MS = Number.parseInt(
  process.env.EVENTTRIP_P95_TARGET_MS ?? "30000",
  10
);

async function runSample() {
  const startedAt = Date.now();

  await runEventTripPipeline({
    intent: {
      event: "Tomorrowland",
      originCity: "Sofia",
      travelers: 2,
      maxBudgetPerPerson: 1200,
    },
    providers: {
      ticketmaster: async () => {
        await sleep(15);
        return [
          {
            id: "tm-1",
            name: "Tomorrowland 2026",
            city: "Boom",
            country: "BE",
            venue: "De Schorre",
          },
        ];
      },
      seatgeek: async () => {
        await sleep(20);
        return [];
      },
      travelpayouts: async () => {
        await sleep(25);
        return {
          flights: [
            {
              id: "f-1",
              origin: "SOF",
              destination: "BRU",
              price: 180,
              currency: "EUR",
            },
            {
              id: "f-2",
              origin: "SOF",
              destination: "BRU",
              price: 240,
              currency: "EUR",
            },
            {
              id: "f-3",
              origin: "SOF",
              destination: "BRU",
              price: 310,
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
              pricePerNight: 210,
              currency: "EUR",
            },
            {
              id: "h-3",
              name: "Stay 3",
              city: "Boom",
              pricePerNight: 280,
              currency: "EUR",
            },
          ],
        };
      },
    },
  });

  return Date.now() - startedAt;
}

async function main() {
  const durations: number[] = [];

  for (let index = 0; index < SAMPLE_COUNT; index += 1) {
    durations.push(await runSample());
  }

  const p95 = calculatePercentile(durations, 0.95);
  const mean = Math.round(
    durations.reduce((sum, ms) => sum + ms, 0) / durations.length
  );

  console.log(
    JSON.stringify(
      {
        sampleCount: SAMPLE_COUNT,
        targetMs: TARGET_MS,
        p95Ms: p95,
        meanMs: mean,
      },
      null,
      2
    )
  );

  if (p95 > TARGET_MS) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
