import { describe, it, expect, vi, beforeEach } from 'vitest';
import { KeyStore } from '../src/services/key-store';

describe('KeyStore', () => {
  let kv: any;
  let keyStore: KeyStore;

  beforeEach(() => {
    kv = {
      get: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
      list: vi.fn(),
    };
    keyStore = new KeyStore(kv);
  });

  it('creating a key should save it to KV', async () => {
    const key = await keyStore.createKey('test-app', 'desc');
    expect(key).toBeDefined();
    expect(key.startsWith('ng_')).toBe(true);
    expect(kv.put).toHaveBeenCalledWith(expect.stringContaining('key:ng_'), expect.stringContaining('test-app'));
  });

  it('verifyKey should return null for invalid key', async () => {
    kv.get.mockResolvedValue(null);
    const result = await keyStore.verifyAndTrack('invalid-key');
    expect(result).toBeNull();
  });

  it('verifyKey should return data and increment usage for valid key', async () => {
    const mockData = { isActive: true, usage: 0 };
    kv.get.mockResolvedValue(mockData);

    const result = await keyStore.verifyAndTrack('valid-key');

    expect(result).toBeTruthy();
    expect(result?.usage).toBe(1);
    expect(kv.put).toHaveBeenCalled();
    const saveCall = kv.put.mock.calls[0];
    expect(saveCall[0]).toBe('key:valid-key');
    expect(JSON.parse(saveCall[1]).usage).toBe(1);
    expect(JSON.parse(saveCall[1]).lastUsedAt).toBeDefined();
  });
});
