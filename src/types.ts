export interface Env {
  // Secrets
  AUTH_KEY: string; // Used for "legacy" or "machine" access if needed, but primarily we use ADMIN_SECRET now
  ADMIN_SECRET: string; // [NEW] For Admin Dashboard Access
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_CHAT_ID: string;
  PUSHOVER_USER_KEY: string;
  PUSHOVER_API_TOKEN: string;

  // Bindings
  NOTIFICATION_GATEWAY_KEYS: KVNamespace; // [NEW]
}

export interface ApiKeyData {
  appId: string;
  description: string;
  createdAt: string;
  expiresAt?: string | null;
  isActive: boolean;
  usage: number;
  lastUsedAt: string | null;
}

export interface Action {
  label: string;
  url?: string; // For Link buttons
  command?: string; // For Callback buttons
  type: 'button' | 'link';
}

export interface NotificationPayload {
  channel: 'auto' | 'telegram' | 'pushover';
  priority?: 'high' | 'normal' | 'low';
  title?: string;
  message: string;
  actions?: Action[];
}

export interface ApiResponse {
  status?: string;
  provider?: string;
  id?: string;
  error?: string;
  timestamp: string;
}
