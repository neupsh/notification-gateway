import { Env, NotificationPayload } from './types';
import { ActionState } from './types';
import { sendTelegramNotification } from './handlers/telegram';
import { sendPushoverNotification } from './handlers/pushover';
import { handleTelegramWebhook } from './handlers/webhook';
import { KeyStore } from './services/key-store';
import { StateManager } from './services/state-manager';
// Simple inline HTML for the dashboard to avoid complex bundler configuration
const dashboardHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Notification Gateway Admin</title>
    <script src="https://unpkg.com/vue@3/dist/vue.global.js"></script>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-100 min-h-screen p-8">
    <div id="app" class="max-w-4xl mx-auto">
        <!-- Login Screen -->
        <div v-if="!token" class="max-w-md mx-auto bg-white p-8 rounded shadow text-center">
            <h1 class="text-2xl font-bold mb-4">Admin Login</h1>
            <input v-model="inputToken" type="password" placeholder="Enter Admin Secret" class="w-full border p-2 rounded mb-4">
            <button @click="login" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 w-full">Login</button>
        </div>

        <!-- Dashboard -->
        <div v-else>
            <div class="flex justify-between items-center mb-8">
                <h1 class="text-3xl font-bold text-gray-800">Notification Gateway</h1>
                <button @click="logout" class="text-red-500 underline">Logout</button>
            </div>

            <!-- Create Form -->
            <div class="bg-white p-6 rounded shadow mb-8">
                <h2 class="text-xl font-bold mb-4">Create New API Key</h2>
                <div class="flex gap-4 items-end">
                    <div class="flex-1">
                        <label class="block text-sm font-bold mb-1">App Name</label>
                        <input v-model="newKey.appId" placeholder="e.g. Backup Script" class="w-full border p-2 rounded">
                    </div>
                    <div class="flex-1">
                        <label class="block text-sm font-bold mb-1">Description</label>
                        <input v-model="newKey.description" placeholder="Notes" class="w-full border p-2 rounded">
                    </div>
                    <div class="flex-1">
                        <label class="block text-sm font-bold mb-1">Default Chat ID (Optional)</label>
                        <input v-model="newKey.defaultChatId" placeholder="e.g. 123456789" class="w-full border p-2 rounded">
                    </div>
                    <button @click="createKey" :disabled="loading" class="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700 h-10">
                        {{ loading ? '...' : 'Create' }}
                    </button>
                </div>
            </div>

            <!-- Result Box -->
            <div v-if="createdKey" class="bg-green-100 border-l-4 border-green-500 text-green-700 p-4 mb-8">
                <p class="font-bold">Key Created!</p>
                <p>Copy this now, you won't see it again:</p>
                <div class="flex items-center gap-2 mt-2">
                    <code class="block bg-black text-white p-3 rounded overflow-x-auto flex-1">{{ createdKey }}</code>
                    <button @click="copyKey" class="bg-green-700 text-white px-4 py-3 rounded hover:bg-green-800 font-bold whitespace-nowrap">
                        {{ copyText }}
                    </button>
                </div>
            </div>

            <!-- Keys List -->
            <div class="bg-white rounded shadow overflow-hidden">
                <table class="w-full">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="p-4 text-left">App ID</th>
                            <th class="p-4 text-left">Description</th>
                            <th class="p-4 text-left">Default Chat ID</th>
                            <th class="p-4 text-left">Usage</th>
                            <th class="p-4 text-left">Last Used</th>
                            <th class="p-4 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="k in keys" :key="k.key" class="border-t hover:bg-gray-50">
                            <td class="p-4 font-medium">{{ k.data.appId }}</td>
                            <td class="p-4 text-gray-600">{{ k.data.description }}</td>
                            <td class="p-4 text-gray-500 font-mono text-xs">{{ k.data.defaultChatId || '-' }}</td>
                            <td class="p-4">
                                <span class="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-bold">{{ k.data.usage }}</span>
                            </td>
                            <td class="p-4 text-sm text-gray-500">
                                {{ k.data.lastUsedAt ? new Date(k.data.lastUsedAt).toLocaleString() : 'Never' }}
                            </td>
                            <td class="p-4 text-right space-x-2">
                                <button @click="editKey(k)" class="text-blue-600 hover:text-blue-800 font-medium text-sm">Edit</button>
                                <button @click="revokeKey(k.key)" class="text-red-600 hover:text-red-800 font-medium text-sm">Revoke</button>
                            </td>
                        </tr>
                        <tr v-if="keys.length === 0">
                            <td colspan="5" class="p-8 text-center text-gray-500">No keys found. Create one above!</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    </div>

    <script>
        const { createApp } = Vue;

        createApp({
            data() {
                return {
                    token: localStorage.getItem('admin_token') || '',
                    inputToken: '',
                    keys: [],
                    loading: false,
                    newKey: { appId: '', description: '', defaultChatId: '' },
                    createdKey: '',
                    copyText: 'Copy'
                }
            },
            mounted() {
                if(this.token) this.fetchKeys();
            },
            methods: {
                login() {
                    this.token = this.inputToken;
                    localStorage.setItem('admin_token', this.token);
                    this.fetchKeys();
                },
                logout() {
                    this.token = '';
                    localStorage.removeItem('admin_token');
                },
                async fetchKeys() {
                    try {
                        const res = await fetch('/api/admin/keys', {
                            headers: { 'Authorization': 'Bearer ' + this.token }
                        });
                        if (res.status === 401) return this.logout();
                        this.keys = await res.json();
                    } catch (e) { alert('Error fetching keys'); }
                },
                async createKey() {
                    if(!this.newKey.appId) return alert('App ID required');
                    this.loading = true;
                    this.createdKey = '';
                    try {
                        const res = await fetch('/api/admin/keys', {
                            method: 'POST',
                            headers: { 
                                'Authorization': 'Bearer ' + this.token,
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify(this.newKey)
                        });
                        const data = await res.json();
                        if(data.key) {
                            this.createdKey = data.key;
                            this.newKey = { appId: '', description: '', defaultChatId: '' };
                            this.fetchKeys();
                        }
                    } catch (e) { alert('Error creating key'); }
                    this.loading = false;
                },
                copyKey() {
                    navigator.clipboard.writeText(this.createdKey).then(() => {
                        this.copyText = 'Copied!';
                        setTimeout(() => this.copyText = 'Copy', 2000);
                    });
                },
                async revokeKey(key) {
                    if(!confirm('Are you sure you want to revoke this key? Apps using it will stop working immediately.')) return;
                    await fetch('/api/admin/keys/' + key, {
                        method: 'DELETE',
                        headers: { 'Authorization': 'Bearer ' + this.token }
                    });
                    this.fetchKeys();
                },
                async editKey(k) {
                    const newChatId = prompt("Update Default Chat ID for " + k.data.appId + ":", k.data.defaultChatId || "");
                    if (newChatId === null) return; // Cancelled

                    try {
                        const res = await fetch('/api/admin/keys/' + k.key, {
                            method: 'PUT',
                            headers: { 
                                'Authorization': 'Bearer ' + this.token,
                                'Content-Type': 'application/json' 
                            },
                            body: JSON.stringify({ defaultChatId: newChatId })
                        });
                        if (res.ok) this.fetchKeys();
                        else alert("Failed to update key");
                    } catch(e) { alert("Error updating key"); }
                }
            }
        }).mount('#app');
    </script>
</body>
</html>`;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const requestId = request.headers.get('X-Request-ID') || crypto.randomUUID();
    const timestamp = new Date().toISOString();
    const keyStore = new KeyStore(env.NOTIFICATION_GATEWAY_KEYS);
    const stateManager = new StateManager(env.NOTIFICATION_GATEWAY_KEYS);

    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // --- Admin UI Route ---
    if (url.pathname === '/admin') {
      return new Response(dashboardHtml, {
        headers: { 'Content-Type': 'text/html' }
      });
    }

    // --- Webhook Route (Telegram) ---
    // Note: Publicly accessible, but validated by Telegram Secret (TODO: Add secret check)
    if (url.pathname === '/webhooks/telegram' && request.method === 'POST') {
      return handleTelegramWebhook(request, env, stateManager);
    }

    // --- Authentication Middleware ---
    const authHeader = request.headers.get('Authorization');
    const token = authHeader ? authHeader.replace('Bearer ', '') : null;
    let isAdmin = false;
    let isApp = false;

    // 2. Check KV Keys (App User)
    // We'll store key data for use in endpoints
    let keyData: any = null;

    if (token === env.ADMIN_SECRET) {
      isAdmin = true;
    } else if (token) {
      const data = await keyStore.verifyAndTrack(token);
      if (data) {
        isApp = true;
        keyData = data;
      }
    }

    if (!isAdmin && !isApp) {
      return new Response(JSON.stringify({ error: "Unauthorized", timestamp }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', 'X-Request-ID': requestId, ...corsHeaders }
      });
    }



    // --- Admin API Routes ---
    if (url.pathname.startsWith('/api/admin')) {
      if (!isAdmin) return new Response("Forbidden", { status: 403 });

      if (url.pathname === '/api/admin/keys') {
        if (request.method === 'GET') {
          const keys = await keyStore.listKeys();
          return new Response(JSON.stringify(keys), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
        }
        if (request.method === 'POST') {
          const body = await request.json() as any;
          const key = await keyStore.createKey(body.appId, body.description, { defaultChatId: body.defaultChatId });
          return new Response(JSON.stringify({ key }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
        }
      }

      if (url.pathname.startsWith('/api/admin/keys/')) {
        const keyToEdit = url.pathname.split('/').pop();

        if (request.method === 'PUT' && keyToEdit) {
          const body = await request.json() as any;
          const updated = await keyStore.updateKey(keyToEdit, body);
          if (!updated) return new Response("Key not found", { status: 404 });
          return new Response(JSON.stringify(updated), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
        }

        if (request.method === 'DELETE' && keyToEdit) {
          await keyStore.revokeKey(keyToEdit);
          return new Response(JSON.stringify({ status: 'deleted' }), { headers: { ...corsHeaders } });
        }
      }
    }

    // --- Public Notification API ---
    try {
      if (request.method === 'POST' && url.pathname === '/notify') {
        const payload: NotificationPayload = await request.json();

        if (!payload.message) {
          return new Response(JSON.stringify({ error: "Missing 'message' field", timestamp }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', 'X-Request-ID': requestId, ...corsHeaders }
          });
        }

        let recipients: string[] = [];

        // 1. Resolve Recipients
        if (payload.recipient) {
          if (Array.isArray(payload.recipient)) {
            recipients = payload.recipient;
          } else {
            recipients = [payload.recipient];
          }
        } else if (keyData?.defaultChatId) {
          recipients = [keyData.defaultChatId];
        } else {
          recipients = [env.TELEGRAM_CHAT_ID]; // Fallback to global
        }

        const results: any[] = [];

        // 2. Dispatch Loop
        for (const chatId of recipients) {
          let provider = '';
          let resultId = '';
          try {
            if (payload.channel === 'telegram' || !payload.channel) { // Default to Telegram
              const res = await sendTelegramNotification(env.TELEGRAM_BOT_TOKEN, chatId, payload);
              resultId = res.messageId.toString();
              provider = 'telegram';

              if (payload.callbackUrl && resultId) {
                const state: ActionState = {
                  callbackUrl: payload.callbackUrl,
                  context: payload.context,
                  createdAt: Date.now()
                };
                await stateManager.saveState('telegram', chatId, resultId, state);
              }
            } else if (payload.channel === 'pushover') {
              // Pushover doesn't support chat ID overrides the same way (User Key is the ID).
              // We'll assume 'recipient' maps to USER_KEY for Pushover if specified?
              // For now, keep Pushover as legacy single-user unless explicit request.
              // Or reuse 'chatId' as 'userKey'.
              const res = await sendPushoverNotification(payload, env);
              resultId = res;
              provider = 'pushover';
            }

            results.push({ recipient: chatId, status: 'sent', id: resultId, provider });
          } catch (e: any) {
            console.error(`Failed to send to ${chatId}:`, e);
            results.push({ recipient: chatId, status: 'error', error: e.message });
          }
        }

        return new Response(JSON.stringify({
          status: 'processed',
          results,
          timestamp
        }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'X-Request-ID': requestId,
            ...corsHeaders
          }
        });
      }

      return new Response("Not Found", { status: 404, headers: { 'X-Request-ID': requestId, ...corsHeaders } });

    } catch (err: any) {
      return new Response(JSON.stringify({
        error: err.message || "Internal Server Error",
        timestamp
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'X-Request-ID': requestId, ...corsHeaders }
      });
    }
  }
};
