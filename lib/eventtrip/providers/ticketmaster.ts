export type TicketmasterEvent = {
  id: string;
  name: string;
  city?: string;
  country?: string;
  venue?: string;
  startsAt?: string;
  endsAt?: string;
};

const TICKETMASTER_BASE_URL =
  "https://app.ticketmaster.com/discovery/v2/events.json";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function asRecordArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => asRecord(item))
    .filter((item): item is Record<string, unknown> => item !== null);
}

function toTicketmasterEvent(
  eventRecord: Record<string, unknown>
): TicketmasterEvent | null {
  const id = asString(eventRecord.id);
  const name = asString(eventRecord.name);

  if (!id || !name) {
    return null;
  }

  const datesRecord = asRecord(eventRecord.dates);
  const startRecord = asRecord(datesRecord?.start);
  const endRecord = asRecord(datesRecord?.end);
  const embeddedRecord = asRecord(eventRecord._embedded);
  const venueRecord = asRecordArray(embeddedRecord?.venues)[0];
  const venueCityRecord = asRecord(venueRecord?.city);
  const venueCountryRecord = asRecord(venueRecord?.country);

  return {
    id,
    name,
    city: asString(venueCityRecord?.name),
    country:
      asString(venueCountryRecord?.countryCode) ??
      asString(venueCountryRecord?.name),
    venue: asString(venueRecord?.name),
    startsAt:
      asString(startRecord?.dateTime) ?? asString(startRecord?.localDate),
    endsAt: asString(endRecord?.dateTime) ?? asString(endRecord?.localDate),
  };
}

export async function fetchTicketmasterEvents(
  query: string
): Promise<TicketmasterEvent[]> {
  const normalizedQuery = query.trim();
  const apiKey = process.env.TICKETMASTER_API_KEY?.trim();

  if (!normalizedQuery || !apiKey) {
    return [];
  }

  const requestUrl = new URL(TICKETMASTER_BASE_URL);
  requestUrl.searchParams.set("apikey", apiKey);
  requestUrl.searchParams.set("keyword", normalizedQuery);
  requestUrl.searchParams.set("size", "5");
  requestUrl.searchParams.set("sort", "date,asc");

  const response = await fetch(requestUrl.toString(), {
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(
      `Ticketmaster request failed with status ${response.status}`
    );
  }

  const payload = (await response.json()) as unknown;
  const payloadRecord = asRecord(payload);
  const embeddedRecord = asRecord(payloadRecord?._embedded);
  const events = asRecordArray(embeddedRecord?.events);

  return events
    .map((eventRecord) => toTicketmasterEvent(eventRecord))
    .filter((event): event is TicketmasterEvent => event !== null);
}
