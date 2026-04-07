#!/usr/bin/env node

// MCP server for sending notifications via Notification Gateway.
// Zero dependencies — uses Node.js built-ins and fetch API.
// Reads NOTIFICATION_GATEWAY_API_KEY from environment.

const GATEWAY_URL =
  process.env.NOTIFICATION_GATEWAY_URL || 'https://notification-gateway.neupsh.workers.dev/notify';
const API_KEY = process.env.NOTIFICATION_GATEWAY_API_KEY || '';

let notificationsEnabled = false;

// --- MCP Protocol (stdio with Content-Length framing) ---

function send(message) {
  const json = JSON.stringify(message);
  process.stdout.write(`Content-Length: ${Buffer.byteLength(json)}\r\n\r\n${json}`);
}

const TOOLS = [
  {
    name: 'send_notification',
    description:
      'Send a push notification to the user via Telegram/Pushover. Use this when a long-running task completes, fails, or needs user attention — but ONLY when notifications are enabled. If disabled, mention that the user can enable with /notify on.',
    inputSchema: {
      type: 'object',
      properties: {
        message: { type: 'string', description: 'Notification message (supports markdown)' },
        title: { type: 'string', description: 'Optional title' },
        priority: {
          type: 'string',
          enum: ['low', 'normal', 'high'],
          description: 'Priority level (default: normal). High routes to Pushover.',
        },
      },
      required: ['message'],
    },
  },
  {
    name: 'toggle_notifications',
    description: 'Enable or disable push notifications for this session.',
    inputSchema: {
      type: 'object',
      properties: {
        enabled: { type: 'boolean', description: 'true to enable, false to disable' },
      },
      required: ['enabled'],
    },
  },
  {
    name: 'notification_status',
    description: 'Check whether push notifications are currently enabled or disabled.',
    inputSchema: { type: 'object', properties: {} },
  },
];

function handleMessage(msg) {
  // Notifications (no id) don't need a response
  if (!msg.id && msg.method === 'notifications/initialized') return;

  if (msg.method === 'initialize') {
    return send({
      jsonrpc: '2.0',
      id: msg.id,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'notify', version: '1.0.0' },
      },
    });
  }

  if (msg.method === 'tools/list') {
    return send({ jsonrpc: '2.0', id: msg.id, result: { tools: TOOLS } });
  }

  if (msg.method === 'tools/call') {
    return handleToolCall(msg);
  }

  // Default response for unknown methods with an id
  if (msg.id) {
    send({ jsonrpc: '2.0', id: msg.id, result: {} });
  }
}

async function handleToolCall(msg) {
  const { name, arguments: args = {} } = msg.params;
  const ok = (text) => ({ content: [{ type: 'text', text }] });
  const err = (text) => ({ content: [{ type: 'text', text }], isError: true });

  try {
    let result;

    switch (name) {
      case 'toggle_notifications':
        notificationsEnabled = args.enabled;
        result = ok(`Notifications ${notificationsEnabled ? 'enabled ✓' : 'disabled'}.`);
        break;

      case 'notification_status':
        result = ok(
          `Notifications are ${notificationsEnabled ? 'enabled ✓' : 'disabled'}. ${!API_KEY ? '(⚠ NOTIFICATION_GATEWAY_API_KEY not set)' : ''}`,
        );
        break;

      case 'send_notification':
        if (!notificationsEnabled) {
          result = ok(
            'Notifications are disabled. Tell the user they can enable with: /notify on',
          );
          break;
        }
        if (!API_KEY) {
          result = err(
            'NOTIFICATION_GATEWAY_API_KEY environment variable is not set. Export it in your shell profile.',
          );
          break;
        }
        result = await sendNotification(args);
        break;

      default:
        result = err(`Unknown tool: ${name}`);
    }

    send({ jsonrpc: '2.0', id: msg.id, result });
  } catch (e) {
    send({ jsonrpc: '2.0', id: msg.id, result: err(`Error: ${e.message}`) });
  }
}

async function sendNotification({ message, title, priority }) {
  const body = { message };
  if (title) body.title = title;
  if (priority) body.priority = priority;

  const res = await fetch(GATEWAY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    return { content: [{ type: 'text', text: `Gateway error (${res.status}): ${text}` }], isError: true };
  }

  return { content: [{ type: 'text', text: 'Notification sent ✓' }] };
}

// --- Stdio transport ---

let buffer = Buffer.alloc(0);

process.stdin.on('data', (chunk) => {
  buffer = Buffer.concat([buffer, Buffer.from(chunk)]);

  while (true) {
    const headerEnd = buffer.indexOf('\r\n\r\n');
    if (headerEnd === -1) break;

    const header = buffer.slice(0, headerEnd).toString();
    const match = header.match(/Content-Length:\s*(\d+)/i);
    if (!match) {
      buffer = buffer.slice(headerEnd + 4);
      continue;
    }

    const contentLength = parseInt(match[1]);
    const bodyStart = headerEnd + 4;
    if (buffer.length < bodyStart + contentLength) break;

    const body = buffer.slice(bodyStart, bodyStart + contentLength).toString();
    buffer = buffer.slice(bodyStart + contentLength);

    try {
      handleMessage(JSON.parse(body));
    } catch {
      // ignore parse errors
    }
  }
});

process.stdin.on('end', () => process.exit(0));
