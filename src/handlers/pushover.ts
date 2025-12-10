import { Env, NotificationPayload } from '../types';

export async function sendPushoverNotification(payload: NotificationPayload, env: Env): Promise<string> {
  const url = 'https://api.pushover.net/1/messages.json';

  let priority = 0;
  if (payload.priority === 'high') priority = 1; // High priority (bypass quiet hours)
  // For 'Emergency' (2), we likely need 'retry' and 'expire' params. Keeping it simple for now.

  const formData = new FormData();
  formData.append('token', env.PUSHOVER_API_TOKEN);
  formData.append('user', env.PUSHOVER_USER_KEY);
  formData.append('message', payload.message);
  formData.append('priority', priority.toString());

  if (payload.title) {
    formData.append('title', payload.title);
  }

  // Pushover supports a 'url' and 'url_title' parameter for a single main action
  if (payload.actions && payload.actions.length > 0) {
    const firstLink = payload.actions.find(a => a.type === 'link');
    if (firstLink && firstLink.url) {
      formData.append('url', firstLink.url);
      formData.append('url_title', firstLink.label);
    }
  }

  const response = await fetch(url, {
    method: 'POST',
    body: formData,
  });

  const data: any = await response.json();

  if (data.status !== 1) {
    throw new Error(`Pushover Error: ${JSON.stringify(data.errors)}`);
  }

  return data.request;
}
