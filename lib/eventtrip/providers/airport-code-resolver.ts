const AIRPORT_CODE_BY_CITY: Record<string, string> = {
  amsterdam: "AMS",
  antwerp: "BRU",
  athens: "ATH",
  bangkok: "BKK",
  barcelona: "BCN",
  belgrade: "BEG",
  berlin: "BER",
  boom: "BRU",
  boston: "BOS",
  brussels: "BRU",
  bucharest: "OTP",
  budapest: "BUD",
  chicago: "ORD",
  copenhagen: "CPH",
  dublin: "DUB",
  dubai: "DXB",
  geneva: "GVA",
  hamburg: "HAM",
  helsinki: "HEL",
  "hong kong": "HKG",
  istanbul: "IST",
  lisbon: "LIS",
  london: "LHR",
  lyon: "LYS",
  madrid: "MAD",
  manchester: "MAN",
  melbourne: "MEL",
  miami: "MIA",
  milan: "MXP",
  montreal: "YUL",
  munich: "MUC",
  naples: "NAP",
  oslo: "OSL",
  paris: "CDG",
  porto: "OPO",
  prague: "PRG",
  reykjavik: "KEF",
  rome: "FCO",
  "sao paulo": "GRU",
  seattle: "SEA",
  seoul: "ICN",
  singapore: "SIN",
  sofia: "SOF",
  stockholm: "ARN",
  sydney: "SYD",
  tokyo: "HND",
  toronto: "YYZ",
  valencia: "VLC",
  vancouver: "YVR",
  venice: "VCE",
  vienna: "VIE",
  warsaw: "WAW",
  zurich: "ZRH",
  "las vegas": "LAS",
  "los angeles": "LAX",
  "new york": "JFK",
  "san francisco": "SFO",
};

const CITY_ALIASES: Record<string, string> = {
  la: "los angeles",
  "l a": "los angeles",
  lax: "los angeles",
  nyc: "new york",
  "new york city": "new york",
  jfk: "new york",
  sf: "san francisco",
  sfo: "san francisco",
  "sao paulo": "sao paulo",
};

const AIRPORT_LOOKUP_SUFFIX_PATTERN =
  /\b(international|airport|airfield|city|center|centre|downtown)\b/g;

const SORTED_CITY_KEYS = Object.keys(AIRPORT_CODE_BY_CITY).sort(
  (left, right) => right.length - left.length
);
const KNOWN_AIRPORT_CODES = new Set(Object.values(AIRPORT_CODE_BY_CITY));

function normalizeLookupValue(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractIataCode(value: string): string | undefined {
  const normalized = value.trim().toUpperCase();
  if (/^[A-Z]{3}$/.test(normalized)) {
    return normalized;
  }

  const matches = normalized.match(/\b([A-Z]{3})\b/g);
  if (!matches) {
    return undefined;
  }

  for (const match of matches) {
    if (KNOWN_AIRPORT_CODES.has(match)) {
      return match;
    }
  }

  return undefined;
}

function lookupCityCode(rawCandidate: string): string | undefined {
  const normalized = normalizeLookupValue(rawCandidate);
  if (!normalized) {
    return undefined;
  }

  const canonical = CITY_ALIASES[normalized] ?? normalized;
  const directMatch = AIRPORT_CODE_BY_CITY[canonical];
  if (directMatch) {
    return directMatch;
  }

  const withoutSuffix = canonical
    .replace(AIRPORT_LOOKUP_SUFFIX_PATTERN, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!withoutSuffix) {
    return undefined;
  }

  return AIRPORT_CODE_BY_CITY[withoutSuffix];
}

function lookupCityCodeByBoundaryMatch(value: string): string | undefined {
  const normalizedValue = normalizeLookupValue(value);
  if (!normalizedValue) {
    return undefined;
  }

  for (const cityKey of SORTED_CITY_KEYS) {
    const pattern = new RegExp(`(^|\\s)${cityKey}(\\s|$)`);
    if (pattern.test(normalizedValue)) {
      return AIRPORT_CODE_BY_CITY[cityKey];
    }
  }

  return undefined;
}

export function resolveAirportCode(value: string): string | undefined {
  const directCityCode = lookupCityCode(value);
  if (directCityCode) {
    return directCityCode;
  }

  const iataCode = extractIataCode(value);
  if (iataCode) {
    return iataCode;
  }

  const segmentedCityCode = value
    .split(/[|/,();-]/)
    .map((segment) => lookupCityCode(segment))
    .find((code) => code !== undefined);
  if (segmentedCityCode) {
    return segmentedCityCode;
  }

  return lookupCityCodeByBoundaryMatch(value);
}
