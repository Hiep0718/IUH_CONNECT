import AsyncStorage from '@react-native-async-storage/async-storage';

const QUEUE_KEY = '@offline_message_queue';

interface QueuedMessage {
  id: string;
  payload: object;
  createdAt: number;
  retryCount: number;
}

export const offlineQueue = {
  /**
   * Thêm tin nhắn vào queue khi offline
   */
  async enqueue(payload: object): Promise<string> {
    const id = `queue_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const queue = await this.getAll();
    queue.push({ id, payload, createdAt: Date.now(), retryCount: 0 });
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    console.log(`📥 [OfflineQueue] Enqueued message: ${id}`);
    return id;
  },

  /**
   * Lấy tất cả tin nhắn chờ gửi
   */
  async getAll(): Promise<QueuedMessage[]> {
    try {
      const data = await AsyncStorage.getItem(QUEUE_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  /**
   * Xóa 1 tin nhắn đã gửi thành công khỏi queue
   */
  async dequeue(id: string): Promise<void> {
    const queue = await this.getAll();
    const filtered = queue.filter(item => item.id !== id);
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(filtered));
  },

  /**
   * Flush: gửi tất cả tin nhắn chờ khi online trở lại
   * @returns Số tin nhắn đã gửi thành công
   */
  async flush(sendFn: (payload: object) => void): Promise<number> {
    const queue = await this.getAll();
    if (queue.length === 0) {
      return 0;
    }

    console.log(`🔄 [OfflineQueue] Flushing ${queue.length} queued messages...`);
    let sent = 0;

    for (const item of queue) {
      try {
        sendFn(item.payload);
        await this.dequeue(item.id);
        sent++;
      } catch (error) {
        console.error(`❌ [OfflineQueue] Failed to flush message ${item.id}`, error);
        // Giữ lại trong queue để retry sau
        break;
      }
    }

    console.log(`✅ [OfflineQueue] Flushed ${sent}/${queue.length} messages`);
    return sent;
  },

  /**
   * Xóa tin nhắn quá 24 giờ (tránh queue phình to)
   */
  async cleanup(): Promise<void> {
    const queue = await this.getAll();
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    const valid = queue.filter(item => item.createdAt > cutoff);
    const removed = queue.length - valid.length;

    if (removed > 0) {
      await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(valid));
      console.log(`🧹 [OfflineQueue] Cleaned up ${removed} expired messages`);
    }
  },

  /**
   * Số tin nhắn đang chờ gửi
   */
  async size(): Promise<number> {
    return (await this.getAll()).length;
  },
};
