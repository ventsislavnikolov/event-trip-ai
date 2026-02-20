import type { EventTripIntent } from "@/lib/eventtrip/intent/schema";
import type { PackageTier } from "@/lib/eventtrip/packages/ranking";

type EventTripPackageCard = {
  id: string;
  tier: PackageTier;
  currency: string;
  ticketPrice: number;
  flightPrice: number;
  hotelPrice: number;
  totalPrice: number;
  withinBudget: boolean;
  overBudgetAmount: number;
  bookingLinks: {
    ticket: string;
    flight: string;
    hotel: string;
  };
};

type EventTripSelectedEvent = {
  provider: "ticketmaster" | "seatgeek";
  providerEventId: string;
  name: string;
  city?: string;
  country?: string;
  venue?: string;
  startsAt?: string;
  endsAt?: string;
};

type TripRequestRow = {
  chatId: string;
  eventQuery: string;
  originCity: string;
  travelers: number;
  maxBudgetPerPerson: number | null;
  status: "ready";
};

type PackageOptionRow = {
  tripRequestId: string;
  tier: PackageTier;
  totalPrice: number;
  pricePerPerson: number;
  withinBudget: boolean;
  ticketPrice: number;
  flightPrice: number;
  hotelPrice: number;
  currency: string;
  outboundLinks: EventTripPackageCard["bookingLinks"];
};

type EventRow = {
  provider: EventTripSelectedEvent["provider"];
  providerEventId: string;
  name: string;
  city: string | null;
  country: string | null;
  venue: string | null;
  startsAt: string;
  endsAt: string | null;
};

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function toEventTripTripRequestRow({
  chatId,
  intent,
}: {
  chatId: string;
  intent: EventTripIntent;
}): TripRequestRow {
  return {
    chatId,
    eventQuery: intent.event?.trim() || "Unknown event",
    originCity: intent.originCity?.trim() || "Unknown",
    travelers: Math.max(1, intent.travelers ?? 1),
    maxBudgetPerPerson: intent.maxBudgetPerPerson ?? null,
    status: "ready",
  };
}

export function toEventTripPackageOptionRows({
  tripRequestId,
  travelers,
  packages,
}: {
  tripRequestId: string;
  travelers: number;
  packages: EventTripPackageCard[];
}): PackageOptionRow[] {
  const safeTravelers = Math.max(1, travelers);

  return packages.map((pkg) => ({
    tripRequestId,
    tier: pkg.tier,
    totalPrice: roundMoney(pkg.totalPrice),
    pricePerPerson: roundMoney(pkg.totalPrice / safeTravelers),
    withinBudget: pkg.withinBudget,
    ticketPrice: roundMoney(pkg.ticketPrice),
    flightPrice: roundMoney(pkg.flightPrice),
    hotelPrice: roundMoney(pkg.hotelPrice),
    currency: pkg.currency,
    outboundLinks: pkg.bookingLinks,
  }));
}

export function toEventTripEventRow(
  selectedEvent: EventTripSelectedEvent | null | undefined
): EventRow | null {
  if (!selectedEvent?.startsAt) {
    return null;
  }

  const providerEventId = selectedEvent.providerEventId.trim();
  const name = selectedEvent.name.trim();
  const startsAt = selectedEvent.startsAt.trim();

  if (!providerEventId || !name || !startsAt) {
    return null;
  }

  return {
    provider: selectedEvent.provider,
    providerEventId,
    name,
    city: selectedEvent.city?.trim() || null,
    country: selectedEvent.country?.trim() || null,
    venue: selectedEvent.venue?.trim() || null,
    startsAt,
    endsAt: selectedEvent.endsAt?.trim() || null,
  };
}

export type {
  EventRow as EventTripEventRow,
  EventTripPackageCard,
  EventTripSelectedEvent,
  PackageOptionRow,
  TripRequestRow,
};
