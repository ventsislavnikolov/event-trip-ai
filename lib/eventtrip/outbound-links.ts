type OutboundLinksEnv = Record<string, string | undefined> & {
  EVENTTRIP_TICKET_BOOKING_BASE_URL?: string;
  EVENTTRIP_FLIGHT_BOOKING_BASE_URL?: string;
  EVENTTRIP_HOTEL_BOOKING_BASE_URL?: string;
  TRAVELPAYOUTS_MARKER?: string;
};

type OutboundLinkType = "ticket" | "flight" | "hotel";

const DEFAULT_BASE_URLS: Record<OutboundLinkType, string> = {
  ticket: "https://example.com/book/ticket",
  flight: "https://example.com/book/flight",
  hotel: "https://example.com/book/hotel",
};

function toAbsoluteBaseUrl(candidate: string | undefined, fallback: string): string {
  if (!candidate?.trim()) {
    return fallback;
  }

  try {
    return new URL(candidate).toString();
  } catch (_error) {
    return fallback;
  }
}

function buildTrackedUrl({
  baseUrl,
  packageId,
  tier,
  marker,
  type,
}: {
  baseUrl: string;
  packageId: string;
  tier: string;
  marker?: string;
  type: OutboundLinkType;
}): string {
  const url = new URL(baseUrl);

  if (!url.pathname.endsWith("/")) {
    url.pathname = `${url.pathname}/`;
  }

  url.pathname = `${url.pathname}${encodeURIComponent(packageId)}`;
  url.searchParams.set("utm_source", "eventtrip");
  url.searchParams.set("utm_medium", "assistant");
  url.searchParams.set("utm_campaign", "eventtrip_mvp");
  url.searchParams.set("package_id", packageId);
  url.searchParams.set("tier", tier);
  url.searchParams.set("link_type", type);

  if ((type === "flight" || type === "hotel") && marker?.trim()) {
    url.searchParams.set("marker", marker.trim());
  }

  return url.toString();
}

export function buildEventTripOutboundLinks({
  packageId,
  tier,
  env = process.env,
}: {
  packageId: string;
  tier: string;
  env?: OutboundLinksEnv;
}) {
  const ticketBaseUrl = toAbsoluteBaseUrl(
    env.EVENTTRIP_TICKET_BOOKING_BASE_URL,
    DEFAULT_BASE_URLS.ticket
  );
  const flightBaseUrl = toAbsoluteBaseUrl(
    env.EVENTTRIP_FLIGHT_BOOKING_BASE_URL,
    DEFAULT_BASE_URLS.flight
  );
  const hotelBaseUrl = toAbsoluteBaseUrl(
    env.EVENTTRIP_HOTEL_BOOKING_BASE_URL,
    DEFAULT_BASE_URLS.hotel
  );

  return {
    ticket: buildTrackedUrl({
      baseUrl: ticketBaseUrl,
      packageId,
      tier,
      type: "ticket",
    }),
    flight: buildTrackedUrl({
      baseUrl: flightBaseUrl,
      packageId,
      tier,
      marker: env.TRAVELPAYOUTS_MARKER,
      type: "flight",
    }),
    hotel: buildTrackedUrl({
      baseUrl: hotelBaseUrl,
      packageId,
      tier,
      marker: env.TRAVELPAYOUTS_MARKER,
      type: "hotel",
    }),
  };
}
