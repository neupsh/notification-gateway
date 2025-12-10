import { ActionState } from "../types";

export class StateManager {
  constructor(private kv: KVNamespace) { }

  /**
   * Saves the context for a specific message interaction.
   * @param platform 'telegram' (others later)
   * @param chatId 
   * @param messageId 
   * @param data The callback URL and Context
   */
  async saveState(platform: 'telegram', chatId: string | number, messageId: string | number, data: ActionState): Promise<void> {
    const key = `state:${platform}:${chatId}:${messageId}`;
    console.log(`[StateManager] Saving state key: ${key}`, JSON.stringify(data));
    await this.kv.put(key, JSON.stringify(data), { expirationTtl: 86400 }); // 24h retention
  }

  /**
   * Retrieves context for a message.
   */
  async getState(platform: 'telegram', chatId: string | number, messageId: string | number): Promise<ActionState | null> {
    const key = `state:${platform}:${chatId}:${messageId}`;
    const data = await this.kv.get(key);
    return data ? JSON.parse(data) : null;
  }
}
