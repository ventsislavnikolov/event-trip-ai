import type { EventTripIntent } from "@/lib/eventtrip/intent/schema";
import {
  buildFallbackPackageOptions,
  buildPackages,
  toPackageCards,
} from "@/lib/eventtrip/packages/build-packages";
import type { PackageOptionInput } from "@/lib/eventtrip/packages/ranking";
import { collectProviderData } from "@/lib/eventtrip/providers/collector";
import {
  type CuratedIndexEvent,
  searchCuratedEventIndex,
} from "@/lib/eventtrip/providers/curated-index";
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
  selectionRequired: boolean;
  selectionReason?: "ambiguous_curated_fallback";
  providerFailureSummary: string[];
  observability: {
    totalDurationMs: number;
    packageGenerationDurationMs: number;
    providerLatencyMs: {
      ticketmaster: number;
      seatgeek: number;
      travelpayouts: number;
    };
    queryVariantCounts: {
      ticketmaster: number;
      seatgeek: number;
      curated: number;
    };
  };
  candidates: {
    id: string;
    name: string;
    location?: string;
    startsAt?: string;
  }[];
  selectedEvent: {
    provider: "ticketmaster" | "seatgeek" | "curated";
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
  curatedIndex?: (query: string) => Promise<CuratedIndexEvent[]>;
  travelpayouts: (params: {
    originCity: string;
    destinationCity: string;
    departDate: string;
    returnDate: string;
  }) => Promise<TravelPayoutsBundle>;
};

type EventSearchTrace<TEvent> = {
  results: TEvent[];
  queryVariants: string[];
  attemptedVariants: number;
};

function normalizeEventQuery(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeTokenizableText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const QUERY_STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "for",
  "from",
  "in",
  "on",
  "the",
  "to",
  "trip",
  "travel",
  "travelers",
  "traveler",
  "adults",
  "adult",
  "people",
  "person",
  "with",
  "max",
  "budget",
  "per",
  "eur",
  "euro",
  "city",
]);

function tokenizeQuery(value: string): string[] {
  return normalizeTokenizableText(value)
    .split(" ")
    .map((token) => token.trim())
    .filter(Boolean);
}

function buildEventQueryFallbacks(query: string): string[] {
  const normalized = normalizeEventQuery(query);
  if (!normalized) {
    return [];
  }

  const variants: string[] = [];
  const seen = new Set<string>();
  const appendVariant = (value: string) => {
    const variant = normalizeEventQuery(value);
    if (!variant) {
      return;
    }

    const key = variant.toLowerCase();
    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    variants.push(variant);
  };

  appendVariant(normalized);

  const withoutYear = normalizeEventQuery(
    normalized.replace(/\b(19|20)\d{2}\b/g, "")
  );
  appendVariant(withoutYear);

  const withoutEditionHints = normalizeEventQuery(
    withoutYear.replace(/\b(edition|tour|live|event|festival|trip)\b/gi, "")
  );
  appendVariant(withoutEditionHints);

  const highRecallBase = normalizeEventQuery(
    tokenizeQuery(withoutEditionHints)
      .filter((token) => !QUERY_STOPWORDS.has(token))
      .join(" ")
  );
  appendVariant(highRecallBase);

  const highRecallTokens = tokenizeQuery(highRecallBase).filter(
    (token) => token.length >= 3
  );
  if (highRecallTokens.length >= 2) {
    appendVariant(highRecallTokens.slice(0, 2).join(" "));
  }
  if (highRecallTokens.length >= 3) {
    appendVariant(highRecallTokens.slice(0, 3).join(" "));
  }
  if (highRecallTokens.length >= 2) {
    appendVariant(highRecallTokens.slice(-2).join(" "));
  }

  const normalizedLower = normalized.toLowerCase();
  const isMotorsportQuery = /\b(formula\s*1|f1|grand prix|gp)\b/.test(
    normalizedLower
  );

  if (isMotorsportQuery) {
    appendVariant(normalized.replace(/\bf1\b/gi, "Formula 1"));
    appendVariant(normalized.replace(/\bformula\s*1\b/gi, "F1"));

    const motorsportCore = normalizeEventQuery(
      tokenizeQuery(withoutYear.replace(/\b(formula|f1|grand|prix|gp)\b/gi, ""))
        .filter((token) => !QUERY_STOPWORDS.has(token))
        .join(" ")
    );

    if (motorsportCore) {
      appendVariant(`Formula 1 ${motorsportCore}`);
      appendVariant(`F1 ${motorsportCore}`);
      appendVariant(`${motorsportCore} Grand Prix`);
    }

    appendVariant("Formula 1");
    appendVariant("Grand Prix");
    appendVariant("F1");
  }

  return variants;
}

async function searchEventsWithFallbacks<TEvent>({
  provider,
  query,
}: {
  provider: (query: string) => Promise<TEvent[]>;
  query: string;
}): Promise<EventSearchTrace<TEvent>> {
  const queryVariants = buildEventQueryFallbacks(query);
  const attemptedQueries: string[] = [];

  for (const queryVariant of queryVariants) {
    attemptedQueries.push(queryVariant);
    const results = await provider(queryVariant);
    if (results.length > 0) {
      return {
        results,
        queryVariants: attemptedQueries,
        attemptedVariants: attemptedQueries.length,
      };
    }
  }

  return {
    results: [],
    queryVariants: attemptedQueries,
    attemptedVariants: attemptedQueries.length,
  };
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
  return normalizeTokenizableText(value);
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
  curatedEvents,
  eventQuery,
  selectedEventCandidateId,
}: {
  ticketmasterEvents: TicketmasterEvent[];
  seatGeekEvents: SeatGeekEvent[];
  curatedEvents: CuratedIndexEvent[];
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

  if (normalizedSelectedCandidateId.startsWith("curated:")) {
    const curatedId = normalizedSelectedCandidateId.slice("curated:".length);
    const selectedCuratedEvent = curatedEvents.find(
      (event) => event.id.toLowerCase() === curatedId
    );

    if (selectedCuratedEvent) {
      return {
        provider: "curated",
        providerEventId: selectedCuratedEvent.id,
        name: selectedCuratedEvent.name,
        city: selectedCuratedEvent.city,
        country: selectedCuratedEvent.country,
        venue: selectedCuratedEvent.venue,
        startsAt: selectedCuratedEvent.startsAt,
        endsAt: selectedCuratedEvent.endsAt,
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

  for (const curatedEvent of curatedEvents) {
    scoredCandidates.push({
      provider: "curated",
      providerEventId: curatedEvent.id,
      name: curatedEvent.name,
      city: curatedEvent.city,
      country: curatedEvent.country,
      venue: curatedEvent.venue,
      startsAt: curatedEvent.startsAt,
      endsAt: curatedEvent.endsAt,
      score: scoreEventNameMatch({
        query: eventQuery,
        candidateName: curatedEvent.name,
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
  curatedEvents,
}: {
  ticketmasterEvents: TicketmasterEvent[];
  seatGeekEvents: SeatGeekEvent[];
  curatedEvents: CuratedIndexEvent[];
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
    ...curatedEvents.map((event) => ({
      id: `curated:${event.id}`,
      name: event.name,
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
  curatedEvents,
  travel,
}: {
  travelers: number;
  ticketmasterEvents: TicketmasterEvent[];
  seatGeekEvents: SeatGeekEvent[];
  curatedEvents: CuratedIndexEvent[];
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
    ticketmasterEvents.length > 0 ||
    seatGeekEvents.length > 0 ||
    curatedEvents.length > 0
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
  const queryVariantCounts = {
    ticketmaster: 0,
    seatgeek: 0,
    curated: 0,
  };
  const activeProviders: EventTripPipelineProviders = providers ?? {
    ticketmaster: fetchTicketmasterEvents,
    seatgeek: fetchSeatGeekEvents,
    curatedIndex: searchCuratedEventIndex,
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
      ticketmaster: async () => {
        const tracedResult = await searchEventsWithFallbacks({
          provider: activeProviders.ticketmaster,
          query: destinationCity,
        });
        queryVariantCounts.ticketmaster = Math.max(
          queryVariantCounts.ticketmaster,
          tracedResult.attemptedVariants
        );
        return tracedResult.results;
      },
      seatgeek: async () => {
        const tracedResult = await searchEventsWithFallbacks({
          provider: activeProviders.seatgeek,
          query: destinationCity,
        });
        queryVariantCounts.seatgeek = Math.max(
          queryVariantCounts.seatgeek,
          tracedResult.attemptedVariants
        );
        return tracedResult.results;
      },
      travelpayouts: async () =>
        activeProviders.travelpayouts({
          originCity,
          destinationCity,
          departDate,
          returnDate,
        }),
    },
  });

  let curatedEvents: CuratedIndexEvent[] = [];
  const hasProviderEvents =
    (providerResponse.results.ticketmaster?.length ?? 0) > 0 ||
    (providerResponse.results.seatgeek?.length ?? 0) > 0;

  if (!hasProviderEvents) {
    const tracedCuratedResult = await searchEventsWithFallbacks({
      provider: activeProviders.curatedIndex ?? searchCuratedEventIndex,
      query: destinationCity,
    }).catch(
      () =>
        ({
          results: [],
          queryVariants: [],
          attemptedVariants: 0,
        }) satisfies EventSearchTrace<CuratedIndexEvent>
    );
    curatedEvents = tracedCuratedResult.results;
    queryVariantCounts.curated = tracedCuratedResult.attemptedVariants;
  }

  const selectionRequired =
    !hasProviderEvents &&
    curatedEvents.length > 1 &&
    !intent.selectedEventCandidateId;
  const selectedEvent = selectionRequired
    ? null
    : selectPreferredEventCandidate({
        ticketmasterEvents: providerResponse.results.ticketmaster ?? [],
        seatGeekEvents: providerResponse.results.seatgeek ?? [],
        curatedEvents,
        eventQuery: destinationCity,
        selectedEventCandidateId: intent.selectedEventCandidateId,
      });
  const candidates = buildEventCandidates({
    ticketmasterEvents: providerResponse.results.ticketmaster ?? [],
    seatGeekEvents: providerResponse.results.seatgeek ?? [],
    curatedEvents,
  });
  const providerFailureSummary = formatProviderFailureSummary(
    providerResponse.failures
  );

  if (selectionRequired) {
    return {
      packages: [],
      degraded: providerResponse.degraded,
      selectionRequired: true,
      selectionReason: "ambiguous_curated_fallback",
      providerFailureSummary,
      observability: {
        totalDurationMs: Date.now() - pipelineStartedAt,
        packageGenerationDurationMs: 0,
        providerLatencyMs: providerResponse.latencyMs,
        queryVariantCounts,
      },
      candidates,
      selectedEvent: null,
    };
  }

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
    curatedEvents,
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
    selectionRequired: false,
    providerFailureSummary,
    observability: {
      totalDurationMs: Date.now() - pipelineStartedAt,
      packageGenerationDurationMs,
      providerLatencyMs: providerResponse.latencyMs,
      queryVariantCounts,
    },
    candidates,
    selectedEvent,
  };
}
