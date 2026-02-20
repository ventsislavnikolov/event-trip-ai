import type { PackageTier } from "@/lib/eventtrip/packages/ranking";

type TripRequestRow = {
  id: string;
  chat_id: string;
  event_query: string;
  origin_city: string;
  travelers: number;
  max_budget_per_person: string | number | null;
  status: string;
  created_at: string | Date;
  event_provider?: string | null;
  event_provider_event_id?: string | null;
  event_name?: string | null;
  event_city?: string | null;
  event_country?: string | null;
  event_venue?: string | null;
  event_starts_at?: string | Date | null;
  event_ends_at?: string | Date | null;
};

type PackageOptionRow = {
  id: string;
  trip_request_id: string;
  tier: string;
  total_price: string | number;
  price_per_person: string | number;
  within_budget: boolean;
  ticket_price: string | number | null;
  flight_price: string | number | null;
  hotel_price: string | number | null;
  currency: string;
  outbound_links: unknown;
  created_at: string | Date;
};

type BookingLinks = {
  ticket?: string;
  flight?: string;
  hotel?: string;
};

type PersistedEventTripResult = {
  tripRequestId: string;
  chatId: string;
  eventQuery: string;
  originCity: string;
  travelers: number;
  maxBudgetPerPerson: number | null;
  status: string;
  createdAt: string;
  event: {
    provider: "ticketmaster" | "seatgeek";
    providerEventId: string;
    name: string;
    city?: string;
    country?: string;
    venue?: string;
    startsAt: string;
    endsAt?: string;
  } | null;
  packages: {
    id: string;
    tier: PackageTier;
    currency: string;
    ticketPrice: number;
    flightPrice: number;
    hotelPrice: number;
    totalPrice: number;
    withinBudget: boolean;
    overBudgetAmount: number;
    bookingLinks: BookingLinks;
  }[];
};

function toNumber(value: string | number | null | undefined): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return 0;
}

function toNullableNumber(
  value: string | number | null | undefined
): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  const parsed = toNumber(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeDate(value: string | Date): string {
  if (value instanceof Date) {
    return value.toISOString();
  }

  return new Date(value).toISOString();
}

function normalizeOptionalDate(
  value: string | Date | null | undefined
): string | undefined {
  if (!value) {
    return undefined;
  }

  return normalizeDate(value);
}

function toBookingLinks(value: unknown): BookingLinks {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const candidate = value as Record<string, unknown>;

  return {
    ticket: typeof candidate.ticket === "string" ? candidate.ticket : undefined,
    flight: typeof candidate.flight === "string" ? candidate.flight : undefined,
    hotel: typeof candidate.hotel === "string" ? candidate.hotel : undefined,
  };
}

function toPackageTier(value: string): PackageTier {
  if (value === "Budget" || value === "Best Value" || value === "Premium") {
    return value;
  }

  return "Best Value";
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function toPersistedEvent(
  tripRequest: TripRequestRow
): PersistedEventTripResult["event"] {
  const provider =
    tripRequest.event_provider === "ticketmaster" ||
    tripRequest.event_provider === "seatgeek"
      ? tripRequest.event_provider
      : null;

  const providerEventId = tripRequest.event_provider_event_id?.trim();
  const name = tripRequest.event_name?.trim();
  const startsAt = normalizeOptionalDate(tripRequest.event_starts_at);

  if (!provider || !providerEventId || !name || !startsAt) {
    return null;
  }

  return {
    provider,
    providerEventId,
    name,
    city: tripRequest.event_city?.trim() || undefined,
    country: tripRequest.event_country?.trim() || undefined,
    venue: tripRequest.event_venue?.trim() || undefined,
    startsAt,
    endsAt: normalizeOptionalDate(tripRequest.event_ends_at),
  };
}

function toOverBudgetAmount({
  pricePerPerson,
  maxBudgetPerPerson,
  withinBudget,
}: {
  pricePerPerson: number;
  maxBudgetPerPerson: number | null;
  withinBudget: boolean;
}): number {
  if (withinBudget || maxBudgetPerPerson === null) {
    return 0;
  }

  return roundMoney(Math.max(0, pricePerPerson - maxBudgetPerPerson));
}

export function toPersistedEventTripResult({
  tripRequest,
  packageRows,
}: {
  tripRequest: TripRequestRow;
  packageRows: PackageOptionRow[];
}): PersistedEventTripResult {
  const maxBudgetPerPerson = toNullableNumber(
    tripRequest.max_budget_per_person
  );

  return {
    tripRequestId: tripRequest.id,
    chatId: tripRequest.chat_id,
    eventQuery: tripRequest.event_query,
    originCity: tripRequest.origin_city,
    travelers: tripRequest.travelers,
    maxBudgetPerPerson,
    status: tripRequest.status,
    createdAt: normalizeDate(tripRequest.created_at),
    event: toPersistedEvent(tripRequest),
    packages: packageRows.map((row) => {
      const pricePerPerson = toNumber(row.price_per_person);
      const withinBudget = Boolean(row.within_budget);

      return {
        id: row.id,
        tier: toPackageTier(row.tier),
        currency: row.currency || "EUR",
        ticketPrice: roundMoney(toNumber(row.ticket_price)),
        flightPrice: roundMoney(toNumber(row.flight_price)),
        hotelPrice: roundMoney(toNumber(row.hotel_price)),
        totalPrice: roundMoney(toNumber(row.total_price)),
        withinBudget,
        overBudgetAmount: toOverBudgetAmount({
          pricePerPerson,
          maxBudgetPerPerson,
          withinBudget,
        }),
        bookingLinks: toBookingLinks(row.outbound_links),
      };
    }),
  };
}

export type {
  PackageOptionRow as EventTripPackageOptionRow,
  PersistedEventTripResult,
  TripRequestRow as EventTripTripRequestRow,
};
