# 🔌 EventTrip.ai — APIs & Data Sources

## Integration Snapshot (2026-02-20)

- API error envelope contract is implemented (`ok/data` and `ok/error`) and used by updated routes.
- Provider orchestrator resilience is implemented (timeouts/retries/degraded mode), with live provider adapters enabled when credentials are configured.
- Ticketmaster/SeatGeek/Travelpayouts credentials are scaffolded in environment policy and used by runtime adapters.
- Remaining API work is mainly data-quality hardening (event resolution, airport normalization, curated-source merging).

## Event Discovery APIs

| API | Какво дава | Цена | Coverage | Verdict |
|-----|-----------|------|----------|---------|
| **Ticketmaster Discovery** | Events, venues, artists, цени, availability | Безплатно (5 calls/sec) | 230K+ events, US/UK/EU | ✅ ЗАДЪЛЖИТЕЛЕН |
| **SeatGeek** | Events, performers, venues, avg ticket price | Безплатно | Основно US | ✅ Добър за US |
| **SerpApi Google Events** | Scrape на Google Events | 100 free/м, после $50/м | Глобален | ✅ Catch-all backup |
| **Bandsintown** | Концерти по артист | Безплатно (read-only) | Силен за музика | ⚠️ Само по артист |
| **Songkick** | Концерти, фестивали | API keys disabled | Беше топ | ❌ Ненадежден/умира |
| **PredictHQ** | Intelligence events DB | Enterprise pricing | Глобален, 19 категории | ❌ Overkill за MVP |

### Стратегия за events:
```
Primary:    Ticketmaster Discovery API (безплатно, огромен)
Secondary:  SeatGeek API (допълва US coverage)
Backup:     SerpApi Google Events (всичко останало)
Music:      Bandsintown (допълва за концерти)
Manual:     Curated DB за top 200 фестивали/events в Европа
```

## Flight APIs

| API | Какво дава | Цена | Verdict |
|-----|-----------|------|---------|
| **Travelpayouts** | Flight search + prices (агрегатор) | Безплатно + affiliate | ✅ НАЙ-ЛЕСЕН за старт |
| **Kiwi Tequila** | Flight search, booking, multi-city | Иска $100K/м revenue за full | ⚠️ За после |
| **Skyscanner API** | Flight search | Чрез Travelpayouts (до 50% комисионна) | ✅ Чрез Travelpayouts |
| **Amadeus** | Flight search, booking | Free tier (500 calls/м) | ⚠️ Сложен, enterprise |

### Стратегия за полети:
```
MVP:        Travelpayouts API (безплатно, signup за 5 мин)
Scale:      Kiwi Tequila (по-добри данни, real booking)
Fallback:   Amadeus free tier
```

## Hotel APIs

| API | Какво дава | Цена | Commission | Verdict |
|-----|-----------|------|------------|---------|
| **Booking.com Demand API** | Hotel search, prices, booking | Безплатно (affiliate) | 25-40% | ✅ Основен |
| **Travelpayouts Hotels** | Агрегатор | Безплатно + affiliate | Varies | ✅ По-лесен за старт |
| **Hotellook** (Travelpayouts) | Hotel meta-search | Безплатно + affiliate | ~50% | ✅ Алтернатива |

### Стратегия за хотели:
```
MVP:        Travelpayouts Hotels API (лесен signup)
Scale:      Booking.com Demand API (по-висока комисионна)
```
⚠️ Booking.com API изисква approval — apply рано!

## Transport APIs

| API | Какво | Цена |
|-----|-------|------|
| **Rome2Rio** | Multi-modal transport | Безплатно basic |
| **Google Maps Directions** | Driving/transit routes | $5/1000 req |
| **Rentalcars.com affiliate** | Rent-a-car | Affiliate |
| **Omio/Trainline** | Влакове + автобуси EU | Affiliate |

## Revenue Model

```
Affiliate комисионни:
- Полети (Travelpayouts/Skyscanner): 1-3%
- Хотели (Booking.com): 25-40%
- Билети за events: 5-15% (директни партньорства)
- Rent-a-car: 5-8%

"Book All" premium: €5-10 service fee
Group features: Free 1-3, €4.99 за 4-10, €9.99 за 10+

Average order value: €500-2000/човек
При 5% blended commission = €25-100 per booking
```

## MVP Cost Breakdown

```
Ticketmaster API:     Безплатно
SeatGeek API:         Безплатно
Travelpayouts:        Безплатно (affiliate)
Booking.com API:      Безплатно (след approval)
SerpApi:              100 free calls/м
Google Maps:          $0-5/м
OpenAI API:           ~$50-100/м
Supabase:             Безплатно (free tier)
Vercel:               Безплатно (free tier)
Domain:               $12/год
─────────────────────────────────
TOTAL MVP:            ~$50-100/м
```

## Quick Start (Day 1)

```bash
1. Signup Ticketmaster Developer → API key (5 мин)
2. Signup Travelpayouts → API key (5 мин)
3. Signup SeatGeek Developer → API key
4. Apply Booking.com Affiliate → 1-3 дни approval
5. Създай Supabase проект → curated events table
```

## API Response Envelope (MVP Contract)

All JSON endpoints should return one of these shapes:

```json
{
  "ok": true,
  "data": {}
}
```

```json
{
  "ok": false,
  "error": {
    "code": "bad_request:api",
    "message": "The request couldn't be processed. Please check your input and try again.",
    "cause": "Optional implementation detail"
  }
}
```

Notes:
- `ok: true` always wraps payloads under `data`.
- `ok: false` always includes `error.code` and `error.message`; `error.cause` is optional.
- During migration, clients may still tolerate legacy `{ code, cause }` errors, but new/updated handlers should emit the envelope above.
