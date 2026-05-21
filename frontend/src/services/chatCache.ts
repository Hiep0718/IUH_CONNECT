import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_PREFIX = '@chat_cache_';
const CONV_LIST_KEY = '@conv_list_cache';
const MAX_CACHED_MESSAGES = 50;

export const chatCache = {
  /**
   * Cache tin nhắn gần nhất của 1 conversation
   */
  async saveMessages(conversationId: string, messages: any[]): Promise<void> {
    try {
      const key = `${CACHE_PREFIX}${conversationId}`;
      const sliced = messages.slice(0, MAX_CACHED_MESSAGES);
      await AsyncStorage.setItem(key, JSON.stringify(sliced));
    } catch (error) {
      console.error('[ChatCache] Failed to save messages', error);
    }
  },

  /**
   * Load tin nhắn từ cache (dùng khi mất mạng)
   */
  async loadMessages(conversationId: string): Promise<any[]> {
    try {
      const key = `${CACHE_PREFIX}${conversationId}`;
      const data = await AsyncStorage.getItem(key);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  /**
   * Cache danh sách conversations
   */
  async saveConversations(conversations: any[]): Promise<void> {
    try {
      await AsyncStorage.setItem(CONV_LIST_KEY, JSON.stringify(conversations));
    } catch (error) {
      console.error('[ChatCache] Failed to save conversations', error);
    }
  },

  /**
   * Load danh sách conversations từ cache (dùng khi mất mạng)
   */
  async loadConversations(): Promise<any[]> {
    try {
      const data = await AsyncStorage.getItem(CONV_LIST_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  /**
   * Xóa cache của 1 conversation
   */
  async clearMessages(conversationId: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(`${CACHE_PREFIX}${conversationId}`);
    } catch (error) {
      console.error('[ChatCache] Failed to clear messages', error);
    }
  },
};
