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

  it('verifyKey should return false for invalid key', async () => {
    kv.get.mockResolvedValue(null);
    const valid = await keyStore.verifyAndTrack('invalid-key');
    expect(valid).toBe(false);
  });

  it('verifyKey should return true and increment usage for valid key', async () => {
    const mockData = { isActive: true, usage: 0 };
    kv.get.mockResolvedValue(mockData);

    const valid = await keyStore.verifyAndTrack('valid-key');

    expect(valid).toBe(true);
    expect(kv.put).toHaveBeenCalled();
    const saveCall = kv.put.mock.calls[0];
    const savedData = JSON.parse(saveCall[1]);
    expect(savedData.usage).toBe(1);
    expect(savedData.lastUsedAt).toBeDefined();
  });
});
