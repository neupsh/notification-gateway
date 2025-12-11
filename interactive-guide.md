# Interactive Notifications Guide

This guide explains how to use **Human-in-the-Loop** notifications with your Gateway.

## How it Works
1.  **You send** a notification with a `callbackUrl` and `context`.
2.  **User acts** (clicks a button or replies) in Telegram.
3.  **Gateway calls** your `callbackUrl` with the action and your original `context`.

## 1. Sending an Interactive Request
Use the `/notify` endpoint.

```bash
curl -X POST https://notification-gateway.<your-domain>.workers.dev/notify \
  -H "Authorization: Bearer <YOUR_KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "channel": "telegram",
    "message": "Deployment v2.0 is ready. Approve?",
    "callbackUrl": "https://my-app.com/api/deploy-approval",
    "context": {
      "deploymentId": "dep_998877",
      "initiatedBy": "system_user"
    },
    "actions": [
      { "label": "✅ Approve", "command": "approve", "type": "button" },
      { "label": "❌ Reject", "command": "reject", "type": "button" }
    ]
  }'
```

## 2. Handling the Callback
Your server (`https://my-app.com/api/deploy-approval`) will receive a `POST` request.

### Payload Structure
```json
{
  "event": "action",        // "action" (button) or "reply" (text)
  "action": "approve",      // The command from the button
  "user": {                 // Telegram User info
    "id": 12345678,
    "first_name": "John",
    "username": "john_doe"
  },
  "context": {              // YOUR original context echoed back
    "deploymentId": "dep_998877",
    "initiatedBy": "system_user"
  }
}
```

## 3. Setup Requirements
*   **Webhooks**: Your `callbackUrl` must be publicly accessible (or tunnelled via ngrok for local dev).
*   **Telegram Only**: Currently, interactivity is supported on **Telegram**.

## 4. Security (Recommended)
To prevent unauthorized users from hitting your `/webhooks/telegram` endpoint, you should set a secret token.

1.  **Generate a Secret**: `openssl rand -hex 32` or similar.
2.  **Configure Gateway**: Add `TELEGRAM_WEBHOOK_SECRET` to your Cloudflare Worker variables.
    ```bash
    npx wrangler secret put TELEGRAM_WEBHOOK_SECRET
    # Paste your secret when prompted
    ```
3.  **Register with Telegram**:
    ```bash
    curl -F "url=https://notification-gateway.<your-subdomain>.workers.dev/webhooks/telegram" \
         -F "secret_token=<YOUR_SECRET>" \
         https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook
    ```
    
The Gateway now validates that every incoming webhook request has this token.
