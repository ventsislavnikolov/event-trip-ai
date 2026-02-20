import type { EventTripIntent } from "@/lib/eventtrip/intent/schema";
import {
  buildFallbackPackageOptions,
  buildPackages,
  toPackageCards,
} from "@/lib/eventtrip/packages/build-packages";
import type { PackageOptionInput } from "@/lib/eventtrip/packages/ranking";
import { collectProviderData } from "@/lib/eventtrip/providers/collector";
import {
  fetchSeatGeekEvents,
  type SeatGeekEvent,
} from "@/lib/eventtrip/providers/seatgeek";
import {
  fetchTicketmasterEvents,
  type TicketmasterEvent,
} from "@/lib/eventtrip/providers/ticketmaster";
import {
  fetchTravelPayoutsFlights,
  fetchTravelPayoutsHotels,
  type TravelPayoutsFlightOption,
  type TravelPayoutsHotelOption,
} from "@/lib/eventtrip/providers/travelpayouts";

type EventTripPipelineResult = {
  packages: ReturnType<typeof toPackageCards>;
  degraded: boolean;
  providerFailureSummary: string[];
  candidates: {
    id: string;
    name: string;
    location?: string;
    startsAt?: string;
  }[];
  selectedEvent: {
    provider: "ticketmaster" | "seatgeek";
    providerEventId: string;
    name: string;
    city?: string;
    country?: string;
    venue?: string;
    startsAt?: string;
    endsAt?: string;
  } | null;
};

type TravelPayoutsBundle = {
  flights: TravelPayoutsFlightOption[];
  hotels: TravelPayoutsHotelOption[];
};

type EventTripPipelineProviders = {
  ticketmaster: (query: string) => Promise<TicketmasterEvent[]>;
  seatgeek: (query: string) => Promise<SeatGeekEvent[]>;
  travelpayouts: (params: {
    originCity: string;
    destinationCity: string;
    departDate: string;
    returnDate: string;
  }) => Promise<TravelPayoutsBundle>;
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

function selectPreferredEventCandidate({
  ticketmasterEvents,
  seatGeekEvents,
}: {
  ticketmasterEvents: TicketmasterEvent[];
  seatGeekEvents: SeatGeekEvent[];
}): EventTripPipelineResult["selectedEvent"] {
  const ticketmasterEvent = ticketmasterEvents[0];
  if (ticketmasterEvent) {
    return {
      provider: "ticketmaster",
      providerEventId: ticketmasterEvent.id,
      name: ticketmasterEvent.name,
      city: ticketmasterEvent.city,
      country: ticketmasterEvent.country,
      venue: ticketmasterEvent.venue,
      startsAt: ticketmasterEvent.startsAt,
      endsAt: ticketmasterEvent.endsAt,
    };
  }

  const seatGeekEvent = seatGeekEvents[0];
  if (seatGeekEvent) {
    return {
      provider: "seatgeek",
      providerEventId: seatGeekEvent.id,
      name: seatGeekEvent.title,
      city: seatGeekEvent.city,
      country: seatGeekEvent.country,
      venue: seatGeekEvent.venue,
      startsAt: seatGeekEvent.startsAt,
      endsAt: seatGeekEvent.endsAt,
    };
  }

  return null;
}

function toLocation(city?: string, country?: string): string | undefined {
  const normalizedCity = city?.trim();
  const normalizedCountry = country?.trim();

  if (normalizedCity && normalizedCountry) {
    return `${normalizedCity}, ${normalizedCountry}`;
  }

  return normalizedCity || normalizedCountry || undefined;
}

function buildEventCandidates({
  ticketmasterEvents,
  seatGeekEvents,
}: {
  ticketmasterEvents: TicketmasterEvent[];
  seatGeekEvents: SeatGeekEvent[];
}): EventTripPipelineResult["candidates"] {
  const fromTicketmaster = ticketmasterEvents.map((event) => ({
    id: `ticketmaster:${event.id}`,
    name: event.name,
    location: toLocation(event.city, event.country),
    startsAt: event.startsAt,
  }));

  const fromSeatGeek = seatGeekEvents.map((event) => ({
    id: `seatgeek:${event.id}`,
    name: event.title,
    location: toLocation(event.city, event.country),
    startsAt: event.startsAt,
  }));

  return [...fromTicketmaster, ...fromSeatGeek].slice(0, 5);
}

function buildProviderPackageOptions({
  travelers,
  ticketmasterEvents,
  seatGeekEvents,
  travel,
}: {
  travelers: number;
  ticketmasterEvents: TicketmasterEvent[];
  seatGeekEvents: SeatGeekEvent[];
  travel: TravelPayoutsBundle;
}): PackageOptionInput[] {
  const flights = [...travel.flights].sort((a, b) => a.price - b.price);
  const hotels = [...travel.hotels].sort(
    (a, b) => a.pricePerNight - b.pricePerNight
  );

  if (flights.length === 0 || hotels.length === 0) {
    return [];
  }

  const safeTravelers = Math.max(1, travelers);
  const tierCount = Math.min(3, flights.length, hotels.length);
  const tierTicketPricePerPerson =
    ticketmasterEvents.length > 0 || seatGeekEvents.length > 0
      ? [150, 200, 280]
      : [120, 170, 240];
  const tierQualityScores = [62, 82, 96];

  return Array.from({ length: tierCount }, (_, index) => {
    const flight = flights[index];
    const hotel = hotels[index];
    const ticketPerPerson =
      tierTicketPricePerPerson[index] ?? tierTicketPricePerPerson.at(-1) ?? 240;
    const qualityScore =
      tierQualityScores[index] ?? tierQualityScores.at(-1) ?? 96;
    const currency = flight.currency || hotel.currency || "EUR";

    return {
      id: `provider-${index + 1}-${safeTravelers}`,
      ticketPrice: Math.round(ticketPerPerson * safeTravelers * 100) / 100,
      flightPrice: Math.round(flight.price * safeTravelers * 100) / 100,
      hotelPrice:
        Math.round(hotel.pricePerNight * 2 * safeTravelers * 100) / 100,
      qualityScore,
      currency,
    } satisfies PackageOptionInput;
  });
}

export async function runEventTripPipeline({
  intent,
  providers,
}: {
  intent: EventTripIntent;
  providers?: EventTripPipelineProviders;
}): Promise<EventTripPipelineResult> {
  const travelers = intent.travelers ?? 1;
  const originCity = intent.originCity ?? "Unknown";
  const destinationCity = intent.event ?? "Unknown event";
  const { departDate, returnDate } = getTravelDates();
  const activeProviders: EventTripPipelineProviders = providers ?? {
    ticketmaster: fetchTicketmasterEvents,
    seatgeek: fetchSeatGeekEvents,
    travelpayouts: async ({
      originCity,
      destinationCity,
      departDate,
      returnDate,
    }) => {
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
  };

  const providerResponse = await collectProviderData({
    timeoutMs: 2000,
    retries: 1,
    providers: {
      ticketmaster: async () => activeProviders.ticketmaster(destinationCity),
      seatgeek: async () => activeProviders.seatgeek(destinationCity),
      travelpayouts: async () =>
        activeProviders.travelpayouts({
          originCity,
          destinationCity,
          departDate,
          returnDate,
        }),
    },
  });

  const selectedEvent = selectPreferredEventCandidate({
    ticketmasterEvents: providerResponse.results.ticketmaster ?? [],
    seatGeekEvents: providerResponse.results.seatgeek ?? [],
  });

  let travelOptions = providerResponse.results.travelpayouts ?? {
    flights: [],
    hotels: [],
  };
  const retryDestinationCity = selectedEvent?.city?.trim();

  const shouldRetryTravelWithEventCity =
    retryDestinationCity &&
    travelOptions.flights.length === 0 &&
    retryDestinationCity.toLowerCase() !== destinationCity.trim().toLowerCase();

  if (shouldRetryTravelWithEventCity) {
    try {
      const retriedTravelOptions = await activeProviders.travelpayouts({
        originCity,
        destinationCity: retryDestinationCity,
        departDate,
        returnDate,
      });

      if (
        retriedTravelOptions.flights.length > 0 ||
        retriedTravelOptions.hotels.length > 0
      ) {
        travelOptions = retriedTravelOptions;
      }
    } catch (_retryError) {
      // Ignore retry failure and preserve the original provider response.
    }
  }

  const providerOptions = buildProviderPackageOptions({
    travelers,
    ticketmasterEvents: providerResponse.results.ticketmaster ?? [],
    seatGeekEvents: providerResponse.results.seatgeek ?? [],
    travel: travelOptions,
  });
  const fallbackOptions = buildFallbackPackageOptions({ travelers });
  const ranked = buildPackages({
    options: providerOptions.length > 0 ? providerOptions : fallbackOptions,
    maxBudgetPerPerson: intent.maxBudgetPerPerson,
  });

  return {
    packages: toPackageCards(ranked.tiers),
    degraded: providerResponse.degraded,
    providerFailureSummary: formatProviderFailureSummary(
      providerResponse.failures
    ),
    candidates: buildEventCandidates({
      ticketmasterEvents: providerResponse.results.ticketmaster ?? [],
      seatGeekEvents: providerResponse.results.seatgeek ?? [],
    }),
    selectedEvent,
  };
}
