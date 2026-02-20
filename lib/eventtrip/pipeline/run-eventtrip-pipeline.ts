import type { EventTripIntent } from "@/lib/eventtrip/intent/schema";
import {
  buildFallbackPackageOptions,
  buildPackages,
  toPackageCards,
} from "@/lib/eventtrip/packages/build-packages";
import { collectProviderData } from "@/lib/eventtrip/providers/collector";
import { fetchSeatGeekEvents } from "@/lib/eventtrip/providers/seatgeek";
import { fetchTicketmasterEvents } from "@/lib/eventtrip/providers/ticketmaster";
import {
  fetchTravelPayoutsFlights,
  fetchTravelPayoutsHotels,
} from "@/lib/eventtrip/providers/travelpayouts";

type EventTripPipelineResult = {
  packages: ReturnType<typeof toPackageCards>;
  degraded: boolean;
  providerFailureSummary: string[];
};

function formatProviderFailureSummary(
  failures: Record<string, { kind: string; message: string } | null>
): string[] {
  return Object.entries(failures)
    .filter(([, failure]) => failure !== null)
    .map(([providerName, failure]) => {
      const providerLabel =
        providerName[0].toUpperCase() + providerName.slice(1);
      return `${providerLabel}: ${failure?.kind} (${failure?.message})`;
    });
}

function toIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function getTravelDates(): { departDate: string; returnDate: string } {
  const now = new Date();
  const departDate = new Date(now);
  departDate.setDate(now.getDate() + 30);

  const returnDate = new Date(departDate);
  returnDate.setDate(departDate.getDate() + 2);

  return {
    departDate: toIsoDate(departDate),
    returnDate: toIsoDate(returnDate),
  };
}

export async function runEventTripPipeline({
  intent,
}: {
  intent: EventTripIntent;
}): Promise<EventTripPipelineResult> {
  const travelers = intent.travelers ?? 1;
  const originCity = intent.originCity ?? "Unknown";
  const destinationCity = intent.event ?? "Unknown event";
  const { departDate, returnDate } = getTravelDates();

  const providerResponse = await collectProviderData({
    timeoutMs: 2000,
    retries: 1,
    providers: {
      ticketmaster: async () => fetchTicketmasterEvents(destinationCity),
      seatgeek: async () => fetchSeatGeekEvents(destinationCity),
      travelpayouts: async () => {
        const [flights, hotels] = await Promise.all([
          fetchTravelPayoutsFlights({
            originCity,
            destinationCity,
            departDate,
            returnDate,
          }),
          fetchTravelPayoutsHotels({
            destinationCity,
            checkInDate: departDate,
            checkOutDate: returnDate,
          }),
        ]);

        return { flights, hotels };
      },
    },
  });

  const fallbackOptions = buildFallbackPackageOptions({ travelers });
  const ranked = buildPackages({
    options: fallbackOptions,
    maxBudgetPerPerson: intent.maxBudgetPerPerson,
  });

  return {
    packages: toPackageCards(ranked.tiers),
    degraded: providerResponse.degraded,
    providerFailureSummary: formatProviderFailureSummary(
      providerResponse.failures
    ),
  };
}
