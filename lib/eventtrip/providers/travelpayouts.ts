export type TravelPayoutsFlightOption = {
  id: string;
  airline?: string;
  origin: string;
  destination: string;
  price: number;
  currency: string;
};

export type TravelPayoutsHotelOption = {
  id: string;
  name: string;
  city: string;
  pricePerNight: number;
  currency: string;
};

const TRAVELPAYOUTS_FLIGHTS_BASE_URL =
  "https://api.travelpayouts.com/v1/prices/cheap";
const TRAVELPAYOUTS_HOTELS_BASE_URL =
  "https://engine.hotellook.com/api/v2/cache.json";

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

function asNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return undefined;
}

function extractAirportCode(value: string): string | undefined {
  const normalized = value.trim().toUpperCase();
  if (/^[A-Z]{3}$/.test(normalized)) {
    return normalized;
  }

  const match = normalized.match(/\b([A-Z]{3})\b/);
  return match?.[1];
}

export async function fetchTravelPayoutsFlights(params: {
  originCity: string;
  destinationCity: string;
  departDate: string;
  returnDate: string;
}): Promise<TravelPayoutsFlightOption[]> {
  const token = process.env.TRAVELPAYOUTS_API_TOKEN?.trim();
  const marker = process.env.TRAVELPAYOUTS_MARKER?.trim();
  const originCode = extractAirportCode(params.originCity);
  const destinationCode = extractAirportCode(params.destinationCity);

  if (!token || !originCode || !destinationCode) {
    return [];
  }

  const requestUrl = new URL(TRAVELPAYOUTS_FLIGHTS_BASE_URL);
  requestUrl.searchParams.set("origin", originCode);
  requestUrl.searchParams.set("destination", destinationCode);
  requestUrl.searchParams.set("depart_date", params.departDate);
  requestUrl.searchParams.set("return_date", params.returnDate);
  requestUrl.searchParams.set("token", token);
  requestUrl.searchParams.set("currency", "eur");
  requestUrl.searchParams.set("limit", "5");

  if (marker) {
    requestUrl.searchParams.set("marker", marker);
  }

  const response = await fetch(requestUrl.toString(), {
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(
      `Travelpayouts flights request failed with status ${response.status}`
    );
  }

  const payload = (await response.json()) as unknown;
  const payloadRecord = asRecord(payload);
  const dataRecord = asRecord(payloadRecord?.data);
  const defaultCurrency =
    asString(payloadRecord?.currency)?.toUpperCase() ?? "EUR";

  if (!dataRecord) {
    return [];
  }

  return Object.entries(dataRecord)
    .map(([dateKey, value]) => {
      const row = asRecord(value);
      const price = asNumber(row?.price);

      if (!row || price === undefined) {
        return null;
      }

      const origin = asString(row.origin) ?? originCode;
      const destination = asString(row.destination) ?? destinationCode;
      const airline = asString(row.airline);
      const currency = asString(row.currency)?.toUpperCase() ?? defaultCurrency;
      const id = `tp-flight-${origin}-${destination}-${dateKey}`;

      return {
        id,
        airline,
        origin,
        destination,
        price: Math.round(price * 100) / 100,
        currency,
      } satisfies TravelPayoutsFlightOption;
    })
    .filter((option): option is TravelPayoutsFlightOption => option !== null);
}

export async function fetchTravelPayoutsHotels(params: {
  destinationCity: string;
  checkInDate: string;
  checkOutDate: string;
}): Promise<TravelPayoutsHotelOption[]> {
  const token = process.env.TRAVELPAYOUTS_API_TOKEN?.trim();
  const marker = process.env.TRAVELPAYOUTS_MARKER?.trim();
  const destinationCity = params.destinationCity.trim();

  if (!token || !destinationCity) {
    return [];
  }

  const requestUrl = new URL(TRAVELPAYOUTS_HOTELS_BASE_URL);
  requestUrl.searchParams.set("location", destinationCity);
  requestUrl.searchParams.set("checkIn", params.checkInDate);
  requestUrl.searchParams.set("checkOut", params.checkOutDate);
  requestUrl.searchParams.set("currency", "eur");
  requestUrl.searchParams.set("limit", "5");
  requestUrl.searchParams.set("token", token);

  if (marker) {
    requestUrl.searchParams.set("marker", marker);
  }

  const response = await fetch(requestUrl.toString(), {
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(
      `Travelpayouts hotels request failed with status ${response.status}`
    );
  }

  const payload = (await response.json()) as unknown;
  const payloadRecord = asRecord(payload);
  const hotels = Array.isArray(payload)
    ? asRecordArray(payload)
    : asRecordArray(payloadRecord?.data);
  const defaultCurrency =
    asString(payloadRecord?.currency)?.toUpperCase() ?? "EUR";

  return hotels
    .map((hotel, index) => {
      const id =
        asString(hotel.hotelId) ??
        asString(hotel.id) ??
        `tp-hotel-${destinationCity}-${index + 1}`;
      const name = asString(hotel.hotelName) ?? asString(hotel.name);
      const pricePerNight = asNumber(hotel.priceFrom) ?? asNumber(hotel.price);
      const city = asString(hotel.locationName) ?? destinationCity;
      const currency =
        asString(hotel.currency)?.toUpperCase() ?? defaultCurrency;

      if (!id || !name || pricePerNight === undefined) {
        return null;
      }

      return {
        id,
        name,
        city,
        pricePerNight: Math.round(pricePerNight * 100) / 100,
        currency,
      } satisfies TravelPayoutsHotelOption;
    })
    .filter((option): option is TravelPayoutsHotelOption => option !== null);
}
