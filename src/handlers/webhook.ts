import { StateManager } from "../services/state-manager";

export async function handleTelegramWebhook(request: Request, env: Env, stateManager: StateManager): Promise<Response> {
  const reqId = crypto.randomUUID().slice(0, 8);
  console.log(`[Webhook:${reqId}] Received incoming request`);

  // Security Check
  if (env.TELEGRAM_WEBHOOK_SECRET) {
    const token = request.headers.get('X-Telegram-Bot-Api-Secret-Token');
    if (token !== env.TELEGRAM_WEBHOOK_SECRET) {
      console.warn(`[Webhook:${reqId}] Security Alert: Invalid Secret Token.Expected: ${env.TELEGRAM_WEBHOOK_SECRET?.slice(0, 3)}...Got: ${token} `);
      return new Response('Unauthorized', { status: 401 });
    }
  } else {
    console.warn(`[Webhook:${reqId}] Security Warning: No TELEGRAM_WEBHOOK_SECRET configured.`);
  }

  try {
    const update = await request.json() as any;
    console.log(`[Webhook:${reqId}]Payload: `, JSON.stringify(update));

    // 1. Handle Button Clicks (CallbackQuery)
    if (update.callback_query) {
      const cq = update.callback_query;
      const message = cq.message;
      const chatId = message.chat.id;
      const messageId = message.message_id;
      const data = cq.data; // The command (e.g., "approve_123")

      // Look up state
      console.log(`[Webhook:${reqId}] Looking up state for chat:${chatId} msg:${messageId} `);
      const state = await stateManager.getState('telegram', chatId, messageId);

      if (state && state.callbackUrl) {
        console.log(`[Webhook:${reqId}] State FOUND.Dispatching to: ${state.callbackUrl} `);
        // Dispatch to User App
        await dispatchCallback(state.callbackUrl, {
          event: 'action',
          action: data,
          user: cq.from,
          context: state.context
        });
      } else {
        console.warn(`[Webhook:${reqId}] State NOT FOUND or no callbackUrl.`);
      }

      // Answer callback to stop loading animation
      await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callback_query_id: cq.id })
      });

      return new Response('OK');
    }

    // 2. Handle Text Replies (Message that is a reply_to_message)
    if (update.message && update.message.reply_to_message) {
      const originalMsg = update.message.reply_to_message;
      const chatId = update.message.chat.id;
      const originalMsgId = originalMsg.message_id;

      const state = await stateManager.getState('telegram', chatId, originalMsgId);
      if (state && state.callbackUrl) {
        await dispatchCallback(state.callbackUrl, {
          event: 'reply',
          text: update.message.text,
          user: update.message.from,
          context: state.context
        });
      }
      return new Response('OK');
    }

    return new Response('OK', { status: 200 });
  } catch (err) {
    console.error('Webhook Error:', err);
    return new Response('Error', { status: 500 });
  }
}

async function dispatchCallback(url: string, payload: any) {
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch (e) {
    console.error('Failed to dispatch callback:', e);
  }
}
