# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Notification Gateway is a Cloudflare Workers application that provides a unified API for sending notifications via Telegram and Pushover, with an admin dashboard for API key management. Built with TypeScript, uses Cloudflare KV for storage.

## Commands

```bash
pnpm dev              # Local dev server at http://localhost:8787
pnpm test             # Run tests once (Vitest)
pnpm test:watch       # Run tests in watch mode
pnpm test:coverage    # Tests with V8 coverage
pnpm lint             # ESLint (src/**/*.{ts,js})
pnpm format           # Prettier formatting
pnpm check-all        # lint + audit + test combined
pnpm deploy           # Deploy to production
```

## Architecture

**Runtime:** Cloudflare Workers (serverless). Entry point is `src/index.ts` which exports a `fetch` handler and routes all requests.

**Routing:**

| Route | Auth | Purpose |
|-------|------|---------|
| `GET /admin` | None | Vue 3 + Tailwind admin dashboard (HTML served inline) |
| `POST /webhooks/telegram` | Webhook secret header | Telegram callback/reply handler |
| `GET/POST/PUT/DELETE /api/admin/keys` | Admin Secret (Bearer) | API key CRUD |
| `POST /notify` | API Key or Admin Secret (Bearer) | Send notification |

**Notification flow:** `POST /notify` → authenticates via API key → routes to Telegram or Pushover handler based on priority (high → Pushover, others → Telegram). Supports interactive actions (Telegram inline buttons) with callback state stored in KV (24h TTL).

**Key modules:**
- `src/handlers/telegram.ts` — Sends via Telegram Bot API, builds inline keyboards from actions
- `src/handlers/pushover.ts` — Sends via Pushover API, maps priority levels
- `src/handlers/webhook.ts` — Processes Telegram button clicks and message replies, dispatches callbacks
- `src/services/key-store.ts` — API key CRUD in KV (prefix `key:*`), keys formatted as `ng_<base64url>`
- `src/services/state-manager.ts` — Action callback state in KV (prefix `state:platform:chatId:messageId`)
- `src/types.ts` — All TypeScript interfaces (`Env`, `NotificationPayload`, `ApiKeyData`, etc.)
- `src/admin/dashboard.html` — Full admin SPA (Vue 3 CDN + Tailwind CDN)

**Storage:** Single Cloudflare KV namespace (`NOTIFICATION_GATEWAY_KEYS`) for both API keys and action state.

**Environment bindings** (set via `wrangler secret put` for production, `.dev.vars` for local):
`ADMIN_SECRET`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `PUSHOVER_USER_KEY`, `PUSHOVER_API_TOKEN`, `TELEGRAM_WEBHOOK_SECRET` (optional)

## CI/CD

GitHub Actions (`.github/workflows/deploy.yml`): PR → deploy to `--env dev`, merge to `main` → deploy to production. Uses pnpm v10, Node 20.

## Code Style

- Strict TypeScript (ES2022 target, bundler module resolution)
- Prettier: single quotes, semicolons, trailing commas, 100 char width
- ESLint: `@typescript-eslint/no-explicit-any` is warn (not error)
