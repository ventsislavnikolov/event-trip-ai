export type CuratedIndexEvent = {
  id: string;
  name: string;
  city?: string;
  country?: string;
  venue?: string;
  startsAt?: string;
  endsAt?: string;
  aliases?: string[];
};

const CURATED_EVENTS: CuratedIndexEvent[] = [
  {
    id: "curated-tomorrowland-2026",
    name: "Tomorrowland 2026",
    city: "Boom",
    country: "BE",
    venue: "De Schorre",
    startsAt: "2026-07-17T12:00:00.000Z",
    aliases: ["tomorrowland", "tomorrowland belgium"],
  },
  {
    id: "curated-sziget-2026",
    name: "Sziget Festival 2026",
    city: "Budapest",
    country: "HU",
    venue: "Obuda Island",
    startsAt: "2026-08-10T12:00:00.000Z",
    aliases: ["sziget", "sziget festival"],
  },
  {
    id: "curated-ultra-europe-2026",
    name: "Ultra Europe 2026",
    city: "Split",
    country: "HR",
    venue: "Park Mladezi",
    startsAt: "2026-07-10T14:00:00.000Z",
    aliases: ["ultra europe", "ultra split"],
  },
  {
    id: "curated-f1-monaco-2026",
    name: "Formula 1 Monaco Grand Prix 2026",
    city: "Monte Carlo",
    country: "MC",
    venue: "Circuit de Monaco",
    startsAt: "2026-05-24T10:00:00.000Z",
    aliases: ["f1 monaco", "monaco grand prix", "formula 1 monaco"],
  },
  {
    id: "curated-oktoberfest-2026",
    name: "Oktoberfest 2026",
    city: "Munich",
    country: "DE",
    venue: "Theresienwiese",
    startsAt: "2026-09-19T10:00:00.000Z",
    aliases: ["oktoberfest", "munich oktoberfest"],
  },
];

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function scoreCuratedEventMatch(
  query: string,
  event: CuratedIndexEvent
): number {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) {
    return 0;
  }

  const candidates = [
    event.name,
    ...(event.aliases ?? []),
    [event.city, event.country].filter(Boolean).join(" "),
  ]
    .map((value) => normalize(value))
    .filter(Boolean);

  for (const candidate of candidates) {
    if (candidate.includes(normalizedQuery)) {
      return 100;
    }
  }

  const queryTokens = normalizedQuery.split(" ").filter((token) => token.length >= 3);
  if (queryTokens.length === 0) {
    return 0;
  }

  let score = 0;

  for (const token of queryTokens) {
    if (candidates.some((candidate) => candidate.includes(token))) {
      score += 15;
    }
  }

  return score;
}

export async function searchCuratedEventIndex(
  query: string
): Promise<CuratedIndexEvent[]> {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) {
    return [];
  }

  return CURATED_EVENTS.map((event) => ({
    event,
    score: scoreCuratedEventMatch(normalizedQuery, event),
  }))
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, 5)
    .map(({ event }) => event);
}
