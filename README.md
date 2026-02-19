<a href="https://chat.vercel.ai/">
  <img alt="Next.js 14 and App Router-ready AI chatbot." src="app/(chat)/opengraph-image.png">
  <h1 align="center">EventTrip.ai</h1>
</a>

<p align="center">
  EventTrip.ai is built on top of Vercel Chat SDK to ship an event-first trip planning MVP faster.
</p>

<p align="center">
  <a href="https://chat-sdk.dev"><strong>Read Docs</strong></a> ·
  <a href="#features"><strong>Features</strong></a> ·
  <a href="#model-providers"><strong>Model Providers</strong></a> ·
  <a href="#deploy-your-own"><strong>Deploy Your Own</strong></a> ·
  <a href="#running-locally"><strong>Running locally</strong></a>
</p>
<br/>

## Baseline

- [Next.js](https://nextjs.org) App Router + TypeScript
- [Vercel AI SDK](https://ai-sdk.dev/docs/introduction) chat runtime
- [shadcn/ui](https://ui.shadcn.com) + Tailwind
- Auth.js for MVP anonymous/auth flows
- Supabase Postgres for primary database (`POSTGRES_URL`)

## Model Providers

This template uses the [Vercel AI Gateway](https://vercel.com/docs/ai-gateway) to access multiple AI models through a unified interface. The default configuration includes [xAI](https://x.ai) models (`grok-2-vision-1212`, `grok-3-mini`) routed through the gateway.

### AI Gateway Authentication

**For Vercel deployments**: Authentication is handled automatically via OIDC tokens.

**For non-Vercel deployments**: You need to provide an AI Gateway API key by setting the `AI_GATEWAY_API_KEY` environment variable in your `.env.local` file.

With the [AI SDK](https://ai-sdk.dev/docs/introduction), you can also switch to direct LLM providers like [OpenAI](https://openai.com), [Anthropic](https://anthropic.com), [Cohere](https://cohere.com/), and [many more](https://ai-sdk.dev/providers/ai-sdk-providers) with just a few lines of code.

## Deploy Your Own

You can deploy your own version of the Next.js AI Chatbot to Vercel with one click:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/templates/next.js/nextjs-ai-chatbot)

## Running locally

You will need the environment variables [defined in `.env.example`](.env.example). For local development, add them to `.env.local`.

> Note: You should not commit your `.env` file or it will expose secrets that will allow others to control access to your various AI and authentication provider accounts.

1. Install dependencies:
```bash
pnpm install
```
2. Configure `.env.local` values (minimum):
- `AUTH_SECRET`
- `AI_GATEWAY_API_KEY` (if not running on Vercel with OIDC)
- `POSTGRES_URL` (Supabase pooled connection string)
- `REDIS_URL` (optional for stream resume)
3. Run migrations and dev server:

```bash
pnpm db:migrate # Setup database or apply latest database changes
pnpm dev
```

App should now run on [localhost:3000](http://localhost:3000).
