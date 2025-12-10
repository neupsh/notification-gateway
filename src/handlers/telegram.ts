import { NotificationPayload } from '../types';

interface TelegramResponse {
  ok: boolean;
  result: {
    message_id: number;
  };
}

export async function sendTelegramNotification(
  token: string,
  chatId: string,
  payload: NotificationPayload
): Promise<{ messageId: number }> {
  const url = `https://api.telegram.org/bot${token}/sendMessage`;

  const body: any = {
    chat_id: chatId,
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

  const data = await response.json() as TelegramResponse;

  if (!response.ok || !data.ok) {
    throw new Error(`Telegram API Error: ${response.statusText}`);
  }

  return { messageId: data.result.message_id };
}
