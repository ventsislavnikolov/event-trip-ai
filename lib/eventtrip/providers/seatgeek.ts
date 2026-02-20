export type SeatGeekEvent = {
  id: string;
  title: string;
  city?: string;
  country?: string;
  venue?: string;
  startsAt?: string;
  endsAt?: string;
};

const SEATGEEK_BASE_URL = "https://api.seatgeek.com/2/events";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function asRecordArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => asRecord(item))
    .filter((item): item is Record<string, unknown> => item !== null);
}

function asString(value: unknown): string | undefined {
  if (typeof value === "number") {
    return `${value}`;
  }

  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function toSeatGeekEvent(
  eventRecord: Record<string, unknown>
): SeatGeekEvent | null {
  const id = asString(eventRecord.id);
  const title = asString(eventRecord.title);

  if (!id || !title) {
    return null;
  }

  const venueRecord = asRecord(eventRecord.venue);

  return {
    id,
    title,
    city: asString(venueRecord?.city),
    country: asString(venueRecord?.country),
    venue: asString(venueRecord?.name),
    startsAt:
      asString(eventRecord.datetime_utc) ??
      asString(eventRecord.datetime_local) ??
      asString(eventRecord.announce_date),
    endsAt: asString(eventRecord.datetime_tbd),
  };
}

export async function fetchSeatGeekEvents(
  query: string
): Promise<SeatGeekEvent[]> {
  const normalizedQuery = query.trim();
  const clientId = process.env.SEATGEEK_CLIENT_ID?.trim();
  const clientSecret = process.env.SEATGEEK_CLIENT_SECRET?.trim();

  if (!normalizedQuery || !clientId || !clientSecret) {
    return [];
  }

  const requestUrl = new URL(SEATGEEK_BASE_URL);
  requestUrl.searchParams.set("q", normalizedQuery);
  requestUrl.searchParams.set("per_page", "5");
  requestUrl.searchParams.set("client_id", clientId);
  requestUrl.searchParams.set("client_secret", clientSecret);

  const response = await fetch(requestUrl.toString(), {
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`SeatGeek request failed with status ${response.status}`);
  }

  const payload = (await response.json()) as unknown;
  const payloadRecord = asRecord(payload);
  const events = asRecordArray(payloadRecord?.events);

  return events
    .map((eventRecord) => toSeatGeekEvent(eventRecord))
    .filter((event): event is SeatGeekEvent => event !== null);
}
