export type EventTripHistorySummary = {
  eventQuery: string;
  originCity: string;
  travelers: number;
  maxBudgetPerPerson: number | null;
  event: {
    name: string;
    city?: string;
    country?: string;
    startsAt?: string;
  } | null;
};

function toLocation(city?: string, country?: string): string | undefined {
  const normalizedCity = city?.trim();
  const normalizedCountry = country?.trim();

  if (normalizedCity && normalizedCountry) {
    return `${normalizedCity}, ${normalizedCountry}`;
  }

  return normalizedCity || normalizedCountry || undefined;
}

export function formatEventTripHistorySummary(
  summary: EventTripHistorySummary
): string {
  const eventLabel = summary.event?.name?.trim() || summary.eventQuery.trim();
  const originLabel = summary.originCity.trim()
    ? `from ${summary.originCity.trim()}`
    : "from unknown origin";
  const travelersLabel =
    summary.travelers === 1
      ? "1 traveler"
      : `${Math.max(1, summary.travelers)} travelers`;
  const locationLabel = summary.event
    ? toLocation(summary.event.city, summary.event.country)
    : undefined;

  return [eventLabel, originLabel, travelersLabel, locationLabel]
    .filter((segment): segment is string => Boolean(segment))
    .join(" • ");
}
