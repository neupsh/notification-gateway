import { ApiKeyData } from '../types';

export class KeyStore {
  private kv: KVNamespace;

  constructor(kv: KVNamespace) {
    this.kv = kv;
  }

  // Generate a cryptographically strong, URL-safe key
  // Format: ng_<24_bytes_base64url> (~32 chars)
  // Example: ng_aQq9_zJk3...
  private generateKey(): string {
    const array = new Uint8Array(24);
    crypto.getRandomValues(array);
    // Manual Base64URL encoding to avoid dependency issues in Workers
    let str = '';
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
    // We treat the byte array as a stream of bits and map them to our chars
    // But for simplicity and speed in this scope, we can map bytes directly or use a simpler algo.
    // Let's use a simple mapping for "randomness" without strict bit-packing if we don't care about exact density,
    // but for "stronger" we want density.
    // Let's use btoa and replace chars.

    // In Workers/Node, btoa handles binary strings.
    // Convert Uint8Array to binary string
    let binary = '';
    for (let i = 0; i < array.length; i++) {
      binary += String.fromCharCode(array[i]);
    }
    const base64 = btoa(binary);
    // Convert to Base64URL
    const base64url = base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    return `ng_${base64url}`;
  }

  async listKeys(): Promise<{ key: string; data: ApiKeyData }[]> {
    const list = await this.kv.list({ prefix: 'key:' });
    const keys: { key: string; data: ApiKeyData }[] = [];

    for (const key of list.keys) {
      const data = await this.kv.get<ApiKeyData>(key.name, 'json');
      if (data) {
        keys.push({ key: key.name.replace('key:', ''), data });
      }
    }
    return keys;
  }

  async createKey(appId: string, description: string): Promise<string> {
    const rawKey = this.generateKey();
    const storageKey = `key:${rawKey}`;

    const data: ApiKeyData = {
      appId,
      description,
      createdAt: new Date().toISOString(),
      usage: 0,
      lastUsedAt: null,
      isActive: true
    };

    await this.kv.put(storageKey, JSON.stringify(data));
    return rawKey;
  }

  async revokeKey(rawKey: string): Promise<void> {
    await this.kv.delete(`key:${rawKey}`);
  }

  async verifyAndTrack(rawKey: string): Promise<boolean> {
    const storageKey = `key:${rawKey}`;
    const data = await this.kv.get<ApiKeyData>(storageKey, 'json');

    if (!data || !data.isActive) {
      return false;
    }

    // Background update usage stats (approximate, fire-and-forget logic)
    // In a real high-concurrency scenario, this read-modify-write is a race condition.
    // But per user requirements, cost/simplicity > strict consistency.
    data.usage = (data.usage || 0) + 1;
    data.lastUsedAt = new Date().toISOString();

    // We don't await this to keep latency low, but Cloudflare Workers might kill it if main request ends.
    // Ideally use ctx.waitUntil, but we'll handle that in the worker calling code if possible, 
    // or just await it here for simplicity as KV writes are fast.
    await this.kv.put(storageKey, JSON.stringify(data));

    return true;
  }
}
