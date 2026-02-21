const AIRPORT_CODE_BY_CITY_BASE: Record<string, string> = {
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

const AIRPORT_ALIAS_ENV_VAR = "EVENTTRIP_AIRPORT_ALIAS_MAP";

function normalizeLookupValue(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseAliasMapFromEnv(
  value: string | undefined
): Record<string, string> {
  if (!value?.trim()) {
    return {};
  }

  const normalizedValue = value.trim();
  const entries: [string, string][] = [];

  if (normalizedValue.startsWith("{")) {
    try {
      const parsed = JSON.parse(normalizedValue) as unknown;

      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        for (const [city, code] of Object.entries(parsed)) {
          if (typeof code === "string") {
            entries.push([city, code]);
          }
        }
      }
    } catch {
      return {};
    }
  } else {
    for (const pair of normalizedValue.split(/[;,]/)) {
      const [city, code] = pair.split("=").map((segment) => segment.trim());

      if (city && code) {
        entries.push([city, code]);
      }
    }
  }

  const aliasMap: Record<string, string> = {};

  for (const [city, code] of entries) {
    const normalizedCity = normalizeLookupValue(city);
    const normalizedCode = code.toUpperCase();

    if (!normalizedCity || !/^[A-Z]{3}$/.test(normalizedCode)) {
      continue;
    }

    aliasMap[normalizedCity] = normalizedCode;
  }

  return aliasMap;
}

function getAirportLookupTables(): {
  airportCodeByCity: Record<string, string>;
  sortedCityKeys: string[];
  knownAirportCodes: Set<string>;
} {
  const envAliasMap = parseAliasMapFromEnv(process.env[AIRPORT_ALIAS_ENV_VAR]);
  const airportCodeByCity = {
    ...AIRPORT_CODE_BY_CITY_BASE,
    ...envAliasMap,
  };

  return {
    airportCodeByCity,
    sortedCityKeys: Object.keys(airportCodeByCity).sort(
      (left, right) => right.length - left.length
    ),
    knownAirportCodes: new Set(Object.values(airportCodeByCity)),
  };
}

function extractIataCode(
  value: string,
  knownAirportCodes: Set<string>
): string | undefined {
  const normalized = value.trim().toUpperCase();
  if (/^[A-Z]{3}$/.test(normalized)) {
    return normalized;
  }

  const matches = normalized.match(/\b([A-Z]{3})\b/g);
  if (!matches) {
    return undefined;
  }

  for (const match of matches) {
    if (knownAirportCodes.has(match)) {
      return match;
    }
  }

  return undefined;
}

function lookupCityCode({
  rawCandidate,
  airportCodeByCity,
}: {
  rawCandidate: string;
  airportCodeByCity: Record<string, string>;
}): string | undefined {
  const normalized = normalizeLookupValue(rawCandidate);
  if (!normalized) {
    return undefined;
  }

  const canonical = CITY_ALIASES[normalized] ?? normalized;
  const directMatch = airportCodeByCity[canonical];
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

  return airportCodeByCity[withoutSuffix];
}

function lookupCityCodeByBoundaryMatch({
  value,
  airportCodeByCity,
  sortedCityKeys,
}: {
  value: string;
  airportCodeByCity: Record<string, string>;
  sortedCityKeys: string[];
}): string | undefined {
  const normalizedValue = normalizeLookupValue(value);
  if (!normalizedValue) {
    return undefined;
  }

  for (const cityKey of sortedCityKeys) {
    const pattern = new RegExp(`(^|\\s)${cityKey}(\\s|$)`);
    if (pattern.test(normalizedValue)) {
      return airportCodeByCity[cityKey];
    }
  }

  return undefined;
}

export function resolveAirportCode(value: string): string | undefined {
  const { airportCodeByCity, knownAirportCodes, sortedCityKeys } =
    getAirportLookupTables();

  const directCityCode = lookupCityCode({
    rawCandidate: value,
    airportCodeByCity,
  });
  if (directCityCode) {
    return directCityCode;
  }

  const iataCode = extractIataCode(value, knownAirportCodes);
  if (iataCode) {
    return iataCode;
  }

  const segmentedCityCode = value
    .split(/[|/,();-]/)
    .map((segment) =>
      lookupCityCode({
        rawCandidate: segment,
        airportCodeByCity,
      })
    )
    .find((code) => code !== undefined);
  if (segmentedCityCode) {
    return segmentedCityCode;
  }

  return lookupCityCodeByBoundaryMatch({
    value,
    airportCodeByCity,
    sortedCityKeys,
  });
}
