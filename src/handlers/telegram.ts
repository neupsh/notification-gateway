import { Env, NotificationPayload } from '../types';

export async function sendTelegramNotification(payload: NotificationPayload, env: Env): Promise<string> {
  const url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`;

  const body: any = {
    chat_id: env.TELEGRAM_CHAT_ID,
    text: payload.title ? `*${payload.title}*\n${payload.message}` : payload.message,
    parse_mode: 'Markdown',
  };

  // Map actions to Inline Keyboard
  if (payload.actions && payload.actions.length > 0) {
    const inlineKeyboard = payload.actions.map((action) => {
      if (action.type === 'link' && action.url) {
        return { text: action.label, url: action.url };
      } else if (action.type === 'button' && action.command) {
        return { text: action.label, callback_data: action.command };
      }
      return null;
    }).filter(Boolean); // Remove nulls

    // Telegram expects an array of arrays (rows)
    // We'll put all buttons in one row for now, or you could split them
    body.reply_markup = {
      inline_keyboard: [inlineKeyboard],
    };
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data: any = await response.json();

  if (!data.ok) {
    throw new Error(`Telegram API Error: ${data.description}`);
  }

  return data.result.message_id.toString();
}
