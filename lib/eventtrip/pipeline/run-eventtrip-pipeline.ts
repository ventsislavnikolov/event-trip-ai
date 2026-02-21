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
  observability: {
    totalDurationMs: number;
    packageGenerationDurationMs: number;
    providerLatencyMs: {
      ticketmaster: number;
      seatgeek: number;
      travelpayouts: number;
    };
  };
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

function normalizeEventQuery(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function buildEventQueryFallbacks(query: string): string[] {
  const normalized = normalizeEventQuery(query);
  if (!normalized) {
    return [];
  }

  const withoutYear = normalizeEventQuery(
    normalized.replace(/\b(19|20)\d{2}\b/g, "")
  );
  const withoutEditionHints = normalizeEventQuery(
    withoutYear.replace(/\b(edition|tour|live)\b/gi, "")
  );

  return Array.from(
    new Set([normalized, withoutYear, withoutEditionHints].filter(Boolean))
  );
}

async function searchEventsWithFallbacks<TEvent>({
  provider,
  query,
}: {
  provider: (query: string) => Promise<TEvent[]>;
  query: string;
}): Promise<TEvent[]> {
  const queryVariants = buildEventQueryFallbacks(query);

  for (const queryVariant of queryVariants) {
    const results = await provider(queryVariant);
    if (results.length > 0) {
      return results;
    }
  }

  return [];
}

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

function normalizeEventText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenizeEventText(value: string): string[] {
  return normalizeEventText(value)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length >= 3);
}

function scoreEventNameMatch({
  query,
  candidateName,
}: {
  query: string;
  candidateName: string;
}): number {
  const normalizedQuery = normalizeEventText(query);
  const normalizedCandidate = normalizeEventText(candidateName);

  if (!normalizedQuery || !normalizedCandidate) {
    return 0;
  }

  if (normalizedCandidate.includes(normalizedQuery)) {
    return 100;
  }

  const queryTokens = tokenizeEventText(normalizedQuery);
  if (queryTokens.length === 0) {
    return 0;
  }

  const candidateTokens = new Set(tokenizeEventText(normalizedCandidate));
  let overlapCount = 0;

  for (const token of queryTokens) {
    if (candidateTokens.has(token)) {
      overlapCount += 1;
    }
  }

  return overlapCount * 10;
}

function toEventTimestamp(value?: string): number | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? null : parsed;
}

function compareScoredCandidates(
  left: EventTripPipelineResult["selectedEvent"] & { score: number },
  right: EventTripPipelineResult["selectedEvent"] & { score: number }
): number {
  if (right.score !== left.score) {
    return right.score - left.score;
  }

  const leftTimestamp = toEventTimestamp(left.startsAt);
  const rightTimestamp = toEventTimestamp(right.startsAt);
  if (leftTimestamp !== null && rightTimestamp === null) {
    return -1;
  }
  if (leftTimestamp === null && rightTimestamp !== null) {
    return 1;
  }
  if (leftTimestamp !== null && rightTimestamp !== null) {
    const now = Date.now();
    const leftDistance = Math.abs(leftTimestamp - now);
    const rightDistance = Math.abs(rightTimestamp - now);
    if (leftDistance !== rightDistance) {
      return leftDistance - rightDistance;
    }
  }

  const leftMetadataScore = Number(
    Boolean(left.city || left.country || left.venue)
  );
  const rightMetadataScore = Number(
    Boolean(right.city || right.country || right.venue)
  );
  if (leftMetadataScore !== rightMetadataScore) {
    return rightMetadataScore - leftMetadataScore;
  }

  if (left.provider !== right.provider) {
    return left.provider.localeCompare(right.provider);
  }

  return left.providerEventId.localeCompare(right.providerEventId);
}

function selectPreferredEventCandidate({
  ticketmasterEvents,
  seatGeekEvents,
  eventQuery,
  selectedEventCandidateId,
}: {
  ticketmasterEvents: TicketmasterEvent[];
  seatGeekEvents: SeatGeekEvent[];
  eventQuery: string;
  selectedEventCandidateId?: string;
}): EventTripPipelineResult["selectedEvent"] {
  const normalizedSelectedCandidateId =
    selectedEventCandidateId?.trim().toLowerCase() ?? "";

  if (normalizedSelectedCandidateId.startsWith("ticketmaster:")) {
    const ticketmasterId = normalizedSelectedCandidateId.slice(
      "ticketmaster:".length
    );
    const selectedTicketmasterEvent = ticketmasterEvents.find(
      (event) => event.id.toLowerCase() === ticketmasterId
    );

    if (selectedTicketmasterEvent) {
      return {
        provider: "ticketmaster",
        providerEventId: selectedTicketmasterEvent.id,
        name: selectedTicketmasterEvent.name,
        city: selectedTicketmasterEvent.city,
        country: selectedTicketmasterEvent.country,
        venue: selectedTicketmasterEvent.venue,
        startsAt: selectedTicketmasterEvent.startsAt,
        endsAt: selectedTicketmasterEvent.endsAt,
      };
    }
  }

  if (normalizedSelectedCandidateId.startsWith("seatgeek:")) {
    const seatGeekId = normalizedSelectedCandidateId.slice("seatgeek:".length);
    const selectedSeatGeekEvent = seatGeekEvents.find(
      (event) => event.id.toLowerCase() === seatGeekId
    );

    if (selectedSeatGeekEvent) {
      return {
        provider: "seatgeek",
        providerEventId: selectedSeatGeekEvent.id,
        name: selectedSeatGeekEvent.title,
        city: selectedSeatGeekEvent.city,
        country: selectedSeatGeekEvent.country,
        venue: selectedSeatGeekEvent.venue,
        startsAt: selectedSeatGeekEvent.startsAt,
        endsAt: selectedSeatGeekEvent.endsAt,
      };
    }
  }

  const scoredCandidates: Array<
    EventTripPipelineResult["selectedEvent"] & { score: number }
  > = [];

  for (const ticketmasterEvent of ticketmasterEvents) {
    scoredCandidates.push({
      provider: "ticketmaster",
      providerEventId: ticketmasterEvent.id,
      name: ticketmasterEvent.name,
      city: ticketmasterEvent.city,
      country: ticketmasterEvent.country,
      venue: ticketmasterEvent.venue,
      startsAt: ticketmasterEvent.startsAt,
      endsAt: ticketmasterEvent.endsAt,
      score: scoreEventNameMatch({
        query: eventQuery,
        candidateName: ticketmasterEvent.name,
      }),
    });
  }

  for (const seatGeekEvent of seatGeekEvents) {
    scoredCandidates.push({
      provider: "seatgeek",
      providerEventId: seatGeekEvent.id,
      name: seatGeekEvent.title,
      city: seatGeekEvent.city,
      country: seatGeekEvent.country,
      venue: seatGeekEvent.venue,
      startsAt: seatGeekEvent.startsAt,
      endsAt: seatGeekEvent.endsAt,
      score: scoreEventNameMatch({
        query: eventQuery,
        candidateName: seatGeekEvent.title,
      }),
    });
  }

  const bestScoredCandidate = scoredCandidates
    .sort(compareScoredCandidates)
    .at(0);
  if (bestScoredCandidate) {
    const { score: _score, ...selectedCandidate } = bestScoredCandidate;
    return selectedCandidate;
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
  const candidates = [
    ...ticketmasterEvents.map((event) => ({
      id: `ticketmaster:${event.id}`,
      name: event.name,
      location: toLocation(event.city, event.country),
      startsAt: event.startsAt,
    })),
    ...seatGeekEvents.map((event) => ({
      id: `seatgeek:${event.id}`,
      name: event.title,
      location: toLocation(event.city, event.country),
      startsAt: event.startsAt,
    })),
  ];

  const dedupedCandidates: EventTripPipelineResult["candidates"] = [];
  const seenCandidateKeys = new Set<string>();

  for (const candidate of candidates) {
    const candidateKey = [
      normalizeEventText(candidate.name),
      normalizeEventText(candidate.location ?? ""),
      candidate.startsAt ?? "",
    ].join("|");

    if (seenCandidateKeys.has(candidateKey)) {
      continue;
    }

    seenCandidateKeys.add(candidateKey);
    dedupedCandidates.push(candidate);

    if (dedupedCandidates.length >= 5) {
      break;
    }
  }

  return dedupedCandidates;
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
  const pipelineStartedAt = Date.now();
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
      ticketmaster: async () =>
        searchEventsWithFallbacks({
          provider: activeProviders.ticketmaster,
          query: destinationCity,
        }),
      seatgeek: async () =>
        searchEventsWithFallbacks({
          provider: activeProviders.seatgeek,
          query: destinationCity,
        }),
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
    eventQuery: destinationCity,
    selectedEventCandidateId: intent.selectedEventCandidateId,
  });

  let travelOptions = providerResponse.results.travelpayouts ?? {
    flights: [],
    hotels: [],
  };
  const retryDestinationCity = selectedEvent?.city?.trim();

  const shouldRetryTravelWithEventCity =
    retryDestinationCity &&
    (travelOptions.flights.length === 0 || travelOptions.hotels.length === 0) &&
    retryDestinationCity.toLowerCase() !== destinationCity.trim().toLowerCase();

  if (shouldRetryTravelWithEventCity) {
    try {
      const retriedTravelOptions = await activeProviders.travelpayouts({
        originCity,
        destinationCity: retryDestinationCity,
        departDate,
        returnDate,
      });

      travelOptions = {
        flights:
          travelOptions.flights.length > 0
            ? travelOptions.flights
            : retriedTravelOptions.flights,
        hotels:
          travelOptions.hotels.length > 0
            ? travelOptions.hotels
            : retriedTravelOptions.hotels,
      };
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
  const packageGenerationStartedAt = Date.now();
  const ranked = buildPackages({
    options: providerOptions.length > 0 ? providerOptions : fallbackOptions,
    maxBudgetPerPerson: intent.maxBudgetPerPerson,
  });
  const packageGenerationDurationMs = Date.now() - packageGenerationStartedAt;

  return {
    packages: toPackageCards(ranked.tiers),
    degraded: providerResponse.degraded,
    providerFailureSummary: formatProviderFailureSummary(
      providerResponse.failures
    ),
    observability: {
      totalDurationMs: Date.now() - pipelineStartedAt,
      packageGenerationDurationMs,
      providerLatencyMs: providerResponse.latencyMs,
    },
    candidates: buildEventCandidates({
      ticketmasterEvents: providerResponse.results.ticketmaster ?? [],
      seatGeekEvents: providerResponse.results.seatgeek ?? [],
    }),
    selectedEvent,
  };
}
