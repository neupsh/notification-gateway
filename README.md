# Notification Gateway

A unified notification gateway for **Telegram** and **Pushover**, built with **Cloudflare Workers** and **TypeScript**.

## Features
*   **Universal API**: Single endpoint for multi-channel notifications.
*   **Smart Routing**: Auto-routes high priority to Pushover, others to Telegram.
*   **Interactive**: Supports Telegram buttons and callbacks.
*   **Secure**: Admin Dashboard, API Key management (KV), and Bearer Token auth.
*   **Developer Friendly**: TypeScript, Vitest, Linting, and Local Development support.

---

## 1. Setup Secrets
You need to generate secrets for your provider authentication.

### Worker Secrets (Set via Wrangler or Dashboard)
| Variable | Description |
| :--- | :--- |
| `ADMIN_SECRET` | Master password for the Dashboard (e.g., `super-secret-pass`) |
| `TELEGRAM_BOT_TOKEN` | From @BotFather (See below) |
| `TELEGRAM_CHAT_ID` | Your Chat ID (See below) |
| `PUSHOVER_API_TOKEN` | Pushover Application Token |
| `PUSHOVER_USER_KEY` | Pushover User Key |

### Telegram Setup
1.  **Create Bot**: Open Telegram, search for **@BotFather**, send `/newbot`. Follow steps. Copy the `HTTP API Token`.
2.  **Get Chat ID**:
    *   Search for **@userinfobot** (or any ID bot).
    *   Click `Start`. It will reply with your `Id`.
    *   *Important*: Send a message "Hello" to your new bot so it can reply to you.

## 2. Infrastructure Setup (One-time)

**1. Login to Cloudflare**
```bash
npx wrangler login
```

**2. Create Database (KV) for Dev and Prod**
```bash
# Production
npx wrangler kv namespace create NOTIFICATION_GATEWAY_KEYS

# Development
npx wrangler kv namespace create NOTIFICATION_GATEWAY_KEYS --env dev
```
*Note: The IDs generated above are already in your `wrangler.toml`. If you re-run this, you must update the IDs in the file.*

**3. Set Secrets**
You need to set secrets for **both** environments (or at least Production).

**For Production:**
```bash
npx wrangler secret put ADMIN_SECRET
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put TELEGRAM_CHAT_ID
npx wrangler secret put PUSHOVER_USER_KEY
npx wrangler secret put PUSHOVER_API_TOKEN
```

**For Development (Optional):**
```bash
npx wrangler secret put ADMIN_SECRET --env dev
npx wrangler secret put TELEGRAM_BOT_TOKEN --env dev
npx wrangler secret put TELEGRAM_CHAT_ID --env dev
npx wrangler secret put PUSHOVER_USER_KEY --env dev
npx wrangler secret put PUSHOVER_API_TOKEN --env dev
```

## 3. Deployment
The project is configured with **GitHub Actions**.
*   **Dev Deployment**: Open a Pull Request. It will deploy to a `dev` environment.
*   **Prod Deployment**: Merge to `main`. It will deploy to `production`.

Manually:
```bash
npm run deploy
```

## 4. Admin Dashboard (Key Management)
Manage your API keys via the web interface.

1.  Go to `https://notification-gateway.<your-subdomain>.workers.dev/admin`
2.  Enter your `ADMIN_SECRET`.
3.  Create keys for your apps (e.g., "Home Assistant", "Backup Script").
4.  Copy the generated key (it starts with a 32-char UUID).

## 5. How to Use (API)

**Endpoint**: `https://notification-gateway.<your-subdomain>.workers.dev/notify`
**Header**: `Authorization: Bearer <AUTH_KEY>`

### Examples

**Critical Alert (Pushover)**
```bash
curl -X POST https://.../notify \
  -H "Authorization: Bearer my-secret-key" \
  -d '{
    "channel": "pushover",
    "priority": "high",
    "message": "🚨 Garage Door Left Open!"
  }'
```

**Question/Interactive (Telegram)**
```bash
curl -X POST https://.../notify \
  -H "Authorization: Bearer my-secret-key" \
  -d '{
    "channel": "telegram",
    "message": "Deploy version v1.2?",
    "actions": [
       { "label": "✅ Approve", "command": "approve_v1.2", "type": "button" },
       { "label": "❌ Reject", "command": "reject_v1.2", "type": "button" }
    ]
  }'
```

## 6. Local Development & Testing

**Run Locally**:
The project runs locally with `wrangler dev`. It simulates the KV store.
For secrets (Telegram/Pushover keys) to work locally, edit `.dev.vars`:
```bash
# .dev.vars
ADMIN_SECRET=dev-password
TELEGRAM_BOT_TOKEN=...
```

Start the local server:
```bash
npm run dev
# Server running at http://localhost:8787
```

**Testing Quality**:
Run these commands to ensure code quality:
```bash
# Run all checks (Lint, Audit, Test)
pnpm check-all

# Just Tests
pnpm test

# Linting
pnpm lint
```


## 🚀 Interactive Notifications (v3)

You can now add buttons to your Telegram notifications and receive callbacks when users click them.

**Example Request:**
```json
{
  "channel": "telegram",
  "message": "Deploy Production?",
  "callbackUrl": "https://my-app.com/deploy-webhook",
  "context": { "deployId": 123 },
  "actions": [
    { "label": "✅ Yes", "command": "approve" },
    { "label": "❌ No", "command": "reject" }
  ]
}
```

See [Interactive Guide](interactive-guide.md) for full details.

## 🔐 Security
To secure the Webhook Listener:
1.  Set `TELEGRAM_WEBHOOK_SECRET` via `npx wrangler secret put`.
2.  Register your bot webhook with the `secret_token` parameter.

See [Interactive Guide](interactive-guide.md#4-security-recommended).

## 🛠️ Troubleshooting
If you get `500 Internal Server Error`, check the Cloudflare Worker Logs (Real-time logs) in the dashboard to see if a specific API key is failing.
