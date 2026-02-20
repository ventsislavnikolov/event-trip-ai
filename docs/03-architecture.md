# 🏗️ EventTrip.ai — Architecture & Database Schema

## Implementation Snapshot (2026-02-20)

Live in `main`:
- Chat SDK baseline app with EventTrip intent gate and pipeline wiring.
- Strict intent schema validation with provider-aware model routing (`openai/*` adapter path + default structured extraction path).
- Deterministic package ranking and UI rendering for package cards/disambiguation.
- Resilient provider collector orchestration (timeouts, retries, degraded mode) with tests and CI smoke coverage.
- Environment-gated provider adapters for Ticketmaster, SeatGeek, and Travelpayouts.
- Provider-informed package option construction (flight/hotel inputs are used when available, with deterministic fallback preserved).
- Best-effort persistence of EventTrip trip/package results into `et_trip_requests` and `et_package_options`.
- Read API for latest persisted EventTrip result per chat (`GET /api/chat/:id/eventtrip`), including linked event metadata when available.
- `et_events` linkage for persisted trips when provider event metadata includes a usable start time.
- Normalized event candidates streamed to UI (`data-eventtripCandidates`) from provider search results.
- Travel provider retry fallback that re-queries with selected event city when the raw event query returns no flight options.
- Disambiguation picker selection now feeds a concrete follow-up user prompt back into chat flow.
- Intent parsing supports `selectedEventCandidateId`, allowing explicit candidate selection to drive deterministic event choice.
- Travelpayouts flight lookups now include bootstrap city-to-airport normalization for common city-name inputs.
- Linked `et_events` metadata now hydrates and renders a selected-event summary in chat surfaces.
- Airport-code normalization is now centralized in a dedicated resolver module with alias and suffix-aware matching.
- Event selection now uses deterministic name-match scoring across provider candidates when explicit selection is not provided.

Not yet wired in runtime:
- Curated event index integration and robust event resolution across multiple provider candidates.
- Broader and data-backed city-to-airport normalization coverage for Travelpayouts flight lookups.
- Broader client/product usage of linked `et_events` metadata outside chat surfaces.

This document keeps the target architecture for upcoming slices; use this snapshot as the current-state source of truth.

## System Architecture

```
┌─────────── EventTrip.ai Architecture ───────────┐
│                                                  │
│  EVENT DATA LAYER:                               │
│  ┌──────────────┐ ┌──────────┐ ┌──────────────┐ │
│  │ Ticketmaster  │ │ SeatGeek │ │ Curated DB   │ │
│  │ Discovery API │ │ API      │ │ (Supabase)   │ │
│  └──────┬───────┘ └────┬─────┘ └──────┬───────┘ │
│         └──────────────┼──────────────┘          │
│                        ▼                         │
│              ┌─────────────────┐                 │
│              │  Event Matcher  │ ← AI            │
│              └────────┬────────┘                 │
│                       ▼                          │
│  TRAVEL DATA LAYER:                              │
│  ┌──────────────┐ ┌────────────┐ ┌────────────┐ │
│  │ Travelpayouts│ │ Travelpay. │ │ Rome2Rio   │ │
│  │ Flights API  │ │ Hotels API │ │ Transport  │ │
│  └──────┬───────┘ └─────┬──────┘ └─────┬──────┘ │
│         └───────────────┼──────────────┘         │
│                         ▼                        │
│              ┌──────────────────┐                │
│              │  Package Builder │                │
│              └────────┬─────────┘                │
│                       ▼                          │
│              ┌──────────────────┐                │
│              │  Affiliate Links │ ← Revenue      │
│              └──────────────────┘                │
└──────────────────────────────────────────────────┘
```

## Database Schema (Supabase/PostgreSQL)

### Events

```sql
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,           -- 'ticketmaster', 'seatgeek', 'curated'
  source_id TEXT,                 -- external API id
  
  name TEXT NOT NULL,             -- "Tomorrowland 2026"
  slug TEXT UNIQUE,               -- "tomorrowland-2026"
  category TEXT NOT NULL,         -- 'festival', 'sports', 'concert', 'f1', 'esports', 'conference'
  subcategory TEXT,               -- 'edm', 'football', 'tennis'
  
  description TEXT,
  image_url TEXT,
  website_url TEXT,
  ticket_url TEXT,
  
  -- Location
  venue_name TEXT,
  city TEXT,
  country TEXT,
  country_code TEXT,              -- 'BE'
  latitude DECIMAL(10,7),
  longitude DECIMAL(10,7),
  
  -- Dates
  start_date DATE NOT NULL,
  end_date DATE,
  doors_open TIMESTAMPTZ,
  
  -- Pricing
  price_min DECIMAL(10,2),
  price_max DECIMAL(10,2),
  price_currency TEXT DEFAULT 'EUR',
  sold_out BOOLEAN DEFAULT FALSE,
  
  -- Meta
  popularity_score INT DEFAULT 0,
  tags TEXT[],                    -- ['electronic', 'camping', 'multi-day']
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Event Airports

```sql
CREATE TABLE event_airports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES events(id),
  airport_code TEXT NOT NULL,     -- 'BRU'
  airport_name TEXT,              -- 'Brussels Airport'
  distance_km DECIMAL(6,1),
  transfer_options JSONB,         -- [{type:'shuttle', price:25, url:'...'}]
  is_primary BOOLEAN DEFAULT FALSE
);
```

### User Trips

```sql
CREATE TABLE trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  event_id UUID REFERENCES events(id),
  
  status TEXT DEFAULT 'draft',    -- 'draft', 'planned', 'booked', 'completed'
  
  -- User preferences
  origin_city TEXT,               -- 'Sofia'
  origin_airport TEXT,            -- 'SOF'
  budget_max DECIMAL(10,2),
  budget_currency TEXT DEFAULT 'EUR',
  num_people INT DEFAULT 1,
  
  -- Selected options
  selected_flight JSONB,
  selected_hotel JSONB,
  selected_transport JSONB,
  selected_ticket JSONB,
  
  total_estimate DECIMAL(10,2),
  share_token TEXT UNIQUE,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Group Trip Members

```sql
CREATE TABLE trip_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID REFERENCES trips(id),
  user_id UUID REFERENCES auth.users(id),
  name TEXT,
  email TEXT,
  role TEXT DEFAULT 'member',     -- 'organizer', 'member'
  status TEXT DEFAULT 'invited',  -- 'invited', 'joined', 'declined'
  origin_city TEXT,
  origin_airport TEXT,
  personal_budget DECIMAL(10,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Search Cache

```sql
CREATE TABLE search_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key TEXT UNIQUE,          -- 'flights:SOF:BRU:2026-07-16:2026-07-21'
  data JSONB NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Affiliate Analytics

```sql
CREATE TABLE affiliate_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID REFERENCES trips(id),
  user_id UUID REFERENCES auth.users(id),
  click_type TEXT,                -- 'flight', 'hotel', 'ticket', 'transport'
  provider TEXT,                  -- 'booking.com', 'skyscanner', 'ticketmaster'
  affiliate_url TEXT,
  clicked_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Indexes

```sql
CREATE INDEX idx_events_category ON events(category);
CREATE INDEX idx_events_dates ON events(start_date);
CREATE INDEX idx_events_country ON events(country_code);
CREATE INDEX idx_events_slug ON events(slug);
CREATE INDEX idx_trips_user ON trips(user_id);
CREATE INDEX idx_cache_key ON search_cache(cache_key);
CREATE INDEX idx_cache_expires ON search_cache(expires_at);
```

## AI Flow

```
User Input → Intent Parser (Claude/GPT)
  ↓
Structured JSON: {event_query, origin, num_people, budget}
  ↓
Event Matcher (DB + APIs)
  ↓
Parallel API Calls (Promise.all):
  - Travelpayouts Flights
  - Travelpayouts Hotels  
  - Rome2Rio Transport
  ↓
Package Builder (3 tiers):
  - 💰 Budget
  - ⭐ Best Value
  - 👑 Premium
  ↓
AI Summary (Claude) → human-friendly recommendation
```

Current implementation note:
- `parseIntent` uses model-id routing for provider-specific adapters.
- `openai/*` models go through a dedicated OpenAI adapter prompt path.
- non-OpenAI models use the default schema-extraction prompt path.

### Intent Parser Example

```typescript
// System prompt for intent parsing
const INTENT_SYSTEM = `You are a travel intent parser. 
Extract structured data from user travel requests.
Return JSON only:
{
  "event_query": string,      // event name
  "origin": string,           // departure city
  "origin_airport": string,   // IATA code
  "num_people": number,
  "budget_per_person": number | null,
  "currency": "EUR" | "USD" | "GBP",
  "preferred_dates": string | null,
  "preferences": string[]     // ['camping', 'luxury', 'budget']
}`;
```

Validation rule:
- Parse-intent payloads are validated with a strict schema (unknown keys are rejected before intent state is used).

### Caching Strategy

```typescript
async function getFlights(from: string, to: string, date: string) {
  const cacheKey = `flights:${from}:${to}:${date}`;
  
  // Check cache (valid for 1 hour)
  const cached = await supabase
    .from('search_cache')
    .select('data')
    .eq('cache_key', cacheKey)
    .gt('expires_at', new Date().toISOString())
    .single();
  
  if (cached.data) return cached.data.data;
  
  // Fetch from API
  const flights = await travelpayouts.searchFlights(from, to, date);
  
  // Cache for 1 hour
  await supabase.from('search_cache').upsert({
    cache_key: cacheKey,
    data: flights,
    expires_at: new Date(Date.now() + 3600000).toISOString()
  });
  
  return flights;
}
```

## Project Structure

```
eventtrip/
├── src/
│   ├── app/                      # Next.js App Router
│   │   ├── page.tsx              # Landing + search bar
│   │   ├── event/[slug]/         # Event detail page
│   │   ├── trip/[id]/            # Trip builder page
│   │   ├── explore/              # Browse events by category
│   │   └── api/
│   │       ├── events/search/    # Event search endpoint
│   │       ├── flights/          # Flight search (cached)
│   │       ├── hotels/           # Hotel search (cached)
│   │       ├── ai/chat/          # AI chat endpoint
│   │       └── trips/            # CRUD trips
│   │
│   ├── lib/
│   │   ├── api/
│   │   │   ├── ticketmaster.ts   # Ticketmaster client
│   │   │   ├── travelpayouts.ts  # Flights + Hotels
│   │   │   ├── seatgeek.ts       # SeatGeek client
│   │   │   └── rome2rio.ts       # Transport
│   │   ├── ai/
│   │   │   ├── intent-parser.ts  # Parse user query
│   │   │   ├── package-builder.ts# Build trip packages
│   │   │   └── summarizer.ts     # AI trip summary
│   │   ├── cache.ts              # Search cache layer
│   │   └── supabase.ts           # DB client
│   │
│   └── components/
│       ├── SearchBar.tsx         # "Where do you want to go?"
│       ├── EventCard.tsx         # Event preview card
│       ├── TripBuilder.tsx       # Full trip breakdown
│       ├── PackageSelector.tsx   # Budget/Best/Premium
│       ├── FlightResults.tsx
│       ├── HotelResults.tsx
│       └── GroupInvite.tsx       # Invite friends
│
├── supabase/
│   └── migrations/               # SQL migrations
└── scripts/
    ├── seed-events.ts            # Seed curated events DB
    └── sync-ticketmaster.ts      # Cron: sync events from API
```

## Cron Jobs

```
Every 6h:   Sync events от Ticketmaster/SeatGeek → events table
Every 1h:   Clean expired search cache
Every 24h:  Update popularity scores
Weekly:     Refresh curated events
```

## Auth Flow

```
Anonymous   → може да търси и вижда packages
Sign up     → може да save-ва trips, share-ва
No paywall  → revenue е от affiliate clicks
```

## Tech Stack

- **Frontend:** Next.js + TypeScript + Tailwind CSS
- **Backend:** Next.js API Routes
- **Database:** Supabase (PostgreSQL + Auth + Storage)
- **AI:** OpenAI GPT-4o / Claude API
- **Hosting:** Vercel
- **Payments:** Stripe (за group features premium)
