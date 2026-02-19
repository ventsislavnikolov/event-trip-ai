-- EventTrip MVP core schema (Supabase Postgres)

create extension if not exists pgcrypto;

create table if not exists public.et_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_event_id text not null,
  name text not null,
  city text,
  country text,
  venue text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  unique (provider, provider_event_id)
);

create table if not exists public.et_trip_requests (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid,
  event_id uuid references public.et_events(id),
  event_query text not null,
  origin_city text not null,
  travelers integer not null check (travelers > 0),
  max_budget_per_person numeric(10, 2),
  status text not null default 'ready',
  created_at timestamptz not null default now()
);

create table if not exists public.et_package_options (
  id uuid primary key default gen_random_uuid(),
  trip_request_id uuid not null references public.et_trip_requests(id) on delete cascade,
  tier text not null check (tier in ('Budget', 'Best Value', 'Premium')),
  total_price numeric(10, 2) not null,
  price_per_person numeric(10, 2) not null,
  within_budget boolean not null default true,
  ticket_price numeric(10, 2),
  flight_price numeric(10, 2),
  hotel_price numeric(10, 2),
  currency text not null default 'EUR',
  outbound_links jsonb,
  created_at timestamptz not null default now(),
  unique (trip_request_id, tier)
);

create index if not exists idx_et_events_name on public.et_events using gin (to_tsvector('simple', name));
create index if not exists idx_et_trip_requests_created_at on public.et_trip_requests (created_at desc);
create index if not exists idx_et_package_options_trip_request_id on public.et_package_options (trip_request_id);
