# EventTrip.ai MVP Timeline

## Timeline (1 Developer, 7 Weeks)

### Week 1-2: Template Baseline + Data Foundation
- [ ] Bootstrap from `vercel/ai-chatbot` template
- [ ] Remove non-MVP template features
- [ ] Configure Vercel environments and required secrets
- [ ] Set up Supabase Postgres and base migrations
- [ ] Add CI baseline (typecheck, lint, unit tests)
- [ ] Establish core API error envelope and response contracts

### Week 3-4: Intent + Data Providers + Package Engine
- [ ] AI SDK intent parsing with strict schema validation
- [ ] Missing-field follow-up flow
- [ ] Event resolution across Ticketmaster, SeatGeek, curated index
- [ ] Travel collectors (flight + hotel) with timeout controls
- [ ] Deterministic package ranking (`Budget`, `Best Value`, `Premium`)
- [ ] Over-budget fallback and annotations

### Week 5: Product UX and Reliability
- [ ] Smart prompt UI and conversation state model
- [ ] Event disambiguation picker UI
- [ ] Package result cards with line-item pricing
- [ ] Outbound booking link tracking
- [ ] Observability logs for parse, provider latency, and package generation
- [ ] Request deadline and graceful fallback states

### Week 6: Hardening and Launch Readiness
- [ ] Regression suite for core prompt-to-package flow
- [ ] Production smoke checks and rollback notes
- [ ] SEO metadata and sharing previews
- [ ] Funnel analytics events
- [ ] Performance pass (P95 within target budget)
- [ ] Preview and production deployment verification

### Week 7: Launch Week
- [ ] Final bug triage and blocker burn-down
- [ ] Validate outbound links and affiliate instrumentation
- [ ] Freeze MVP scope and close remaining must-have issues
- [ ] Launch decision review
- [ ] Publish and monitor first 48h
- [ ] Launch retrospective

## Launch Strategy

1. ProductHunt
2. Reddit (`r/festivals`, `r/travel`, `r/solotravel`, `r/formula1`)
3. TikTok/Reels short demos
4. SEO pages for high-intent event travel searches
5. Festival communities (Facebook/Discord)

## Startup Costs (Monthly)

```
Ticketmaster API:     Free
SeatGeek API:         Free
Travelpayouts:        Free
Booking.com API:      Free (after approval)
Google Maps:          $0-5
AI API usage:         $50-150
Supabase:             Free tier to start
Vercel:               Free tier to start
Domain:               $1/month
─────────────────────
TOTAL:                ~$50-160/month
```

## MVP Scope Notes

- Keep anonymous-first experience for MVP.
- Do not add save/share/group checkout features before launch.
- Preserve deterministic package logic; use AI only where NLP is needed.
