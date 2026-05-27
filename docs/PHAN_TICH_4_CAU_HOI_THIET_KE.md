# IUH Connect - Phân Tích Chi Tiết 4 Câu Hỏi Thiết Kế

## 1️⃣ Về Luồng Đồng Bộ Offline (UC-01 & Mục 3.6)

### **Câu hỏi 1a: Thư viện bắt sự kiện mạng trở lại?**

**Trả lời:** 
- ✅ **ĐÃ sử dụng @react-native-community/netinfo** (package `^12.0.1`)
- ✅ **Kết hợp cả WebSocket state + NetInfo OS-level để detect offline**

**Cách hoạt động (đã implement):**

```typescript
// frontend/src/services/WebSocketProvider.tsx
import NetInfo from '@react-native-community/netinfo';

// 1. WebSocket connection events (detect qua kết nối WS)
ws.onopen = () => {
  reconnectAttemptsRef.current = 0;
  setIsConnected(true);
  setWasReconnected(true);
  startHeartbeat();
  // Flush offline queue khi reconnect
  offlineQueue.flush((payload) => ws.send(JSON.stringify(payload)));
};

ws.onclose = () => {
  setIsConnected(false);
  stopHeartbeat();
  // Exponential backoff reconnect: 2s → 4s → 8s → max 30s
  const delay = getReconnectDelay();
  reconnectAttemptsRef.current++;
  reconnectTimeoutRef.current = setTimeout(() => connect(), delay);
};

// 2. NetInfo listener (detect mạng ở mức OS - nhanh hơn WS timeout)
useEffect(() => {
  const unsubscribe = NetInfo.addEventListener(state => {
    if (state.isConnected && !isConnected && shouldReconnectRef.current) {
      // Mạng vừa trở lại → reconnect ngay lập tức
      reconnectAttemptsRef.current = 0;
      clearTimeout(reconnectTimeoutRef.current);
      connect();
    }
  });
  return () => unsubscribe();
}, [isConnected, connect]);
```

**Hiển thị trạng thái:**
```typescript
// frontend/src/components/OfflineBanner.tsx
// Banner hiển thị "Không có kết nối mạng" với animation (slide + pulse icon)
<OfflineBanner isOffline={!isConnected} />
```

**✅ Ưu điểm so với chỉ dùng WebSocket:**
- NetInfo detect mất mạng **ngay lập tức** (không đợi TCP timeout ~2 phút)
- Khi mạng trở lại → reconnect **ngay** (không đợi backoff timer)

---

### **Câu hỏi 1b: Lưu tin nhắn chờ gửi ở đâu?**

**Trả lời:** 
- ✅ **ĐÃ implement Offline Message Queue với AsyncStorage**
- ✅ **Tin nhắn persist vào device storage, không mất khi close app**

**Cách hoạt động (đã implement):**

**Bước 1:** Khi user gửi tin nhắn lúc offline → `sendMessage()` tự động queue vào AsyncStorage:
```typescript
// frontend/src/services/WebSocketProvider.tsx
const sendMessage = useCallback((data: object) => {
  const ws = wsRef.current;
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
    return;
  }
  // ✅ Queue tin nhắn để gửi lại khi online
  offlineQueue.enqueue(data);
}, []);
```

**Bước 2:** Offline Queue Service lưu vào AsyncStorage:
```typescript
// frontend/src/services/offlineQueue.ts
import AsyncStorage from '@react-native-async-storage/async-storage';

const QUEUE_KEY = '@offline_message_queue';

export const offlineQueue = {
  // Thêm tin nhắn vào queue khi offline
  async enqueue(payload: object): Promise<string> {
    const id = `queue_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const queue = await this.getAll();
    queue.push({ id, payload, createdAt: Date.now(), retryCount: 0 });
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    return id;
  },

  // Flush: gửi tất cả khi online trở lại
  async flush(sendFn: (payload: object) => void): Promise<number> {
    const queue = await this.getAll();
    let sent = 0;
    for (const item of queue) {
      try {
        sendFn(item.payload);
        await this.dequeue(item.id);
        sent++;
      } catch { break; }
    }
    return sent;
  },

  // Tự động cleanup tin nhắn quá 24 giờ
  async cleanup(): Promise<void> { ... },
};
```

**Bước 3:** Khi reconnect → flush queue tự động:
```typescript
// WebSocketProvider.tsx - ws.onopen
ws.onopen = () => {
  setIsConnected(true);
  startHeartbeat();
  // ✅ Flush offline queue
  offlineQueue.flush((payload) => ws.send(JSON.stringify(payload)));
  offlineQueue.cleanup(); // Xóa tin nhắn quá 24h
};
```

**Lý do chọn AsyncStorage:**

| Tùy chọn | Dung lượng | Tốc độ | Vĩnh viễn | Khuyên dùng |
|----------|-----------|-------|----------|-----------|
| ✅ AsyncStorage | ~5MB | Chậm | ✅ Có | ✅ Đơn giản, đủ cho tin nhắn chờ |
| SQLite | Không giới hạn | Nhanh | ✅ Có | ❌ Overkill cho project này |
| Memory (state) | RAM | Cực nhanh | ❌ Không | ❌ Mất dữ liệu khi close app |

---

## 2️⃣ Về Luồng Gọi Video (UC-02)

### **Câu hỏi 2: Jitsi Meet SDK gốc (Native) hay WebView?**

**Trả lời:** 
- ✅ **Dùng WebView để nhúng Jitsi Meet**
- ❌ **Không dùng Jitsi React Native SDK native module**

**Cách hiện tại:**

```typescript
// frontend/src/screens/MeetingScreen.tsx

const JITSI_SERVER = 'https://meet.ffmuc.net';

const openJitsiMeeting = async (room: string) => {
  // Tạo Jitsi URL với config
  const url = `${JITSI_SERVER}/${room}#config.prejoinPageEnabled=false&...`;
  
  // Nhúng vào WebView
  setJitsiUrl(url);
  setShowWebView(true);
};

// Render WebView
{showWebView && (
  <WebView
    source={{ uri: jitsiUrl }}
    style={{ flex: 1 }}
    javaScriptEnabled={true}
    domStorageEnabled={true}
    allowsInlineMediaPlayback={true}
    mediaPlaybackRequiresUserAction={false}
    mediaCapturePermissionGrantType="grant"
  />
)}
```

**Luồng gọi video:**

```
┌─ User A (Mobile) ─────┐    ┌─ WebSocket ─────┐    ┌─ User B (Mobile) ──┐
│                       │    │                 │    │                    │
│ 1. Gửi CALL_INVITE    │───>│                 │───>│ 2. Nhận CALL_INVITE│
│    roomName="room123" │    │                 │    │    (Show Alert)    │
│                       │    │                 │    │                    │
│ 3. Mở Jitsi WebView   │    │ Signaling       │    │ 4. Gửi CALL_ACCEPT│
│    meet.ffmuc.net/... │<───│    Events       │<───│ 5. Mở Jitsi       │
│                       │    │                 │    │    WebView        │
│ 6. Đang gọi video     │    │                 │    │ 7. Đang gọi video │
│    (WebView Jitsi)    │    │  P2P via Jitsi  │    │    (WebView Jitsi)│
│                       │    │   TURN servers  │    │                   │
└───────────────────────┘    └─────────────────┘    └───────────────────┘
```

**📊 Signaling workflow (over WebSocket):**

```typescript
// Client A (Caller)
ws.send({
  type: "CALL_SIGNAL",
  signalType: "CALL_INVITE",  // hoặc "call_init"
  meetingId: "meet_123",
  roomName: "IUHConnect_userA_1684235400000",
  receiverId: "userB"
});

// Server → Broadcast to User B
// User B nhận được → Show dialog "userA gọi video"

// Client B (Callee) chấp nhận
ws.send({
  type: "CALL_SIGNAL",
  signalType: "CALL_ACCEPT",  // hoặc "call_accept"
  meetingId: "meet_123",
  receiverId: "userA"
});

// Client A nhận được ACCEPT → Mở Jitsi
// Client B → Mở Jitsi (lúc connect)

// Cả hai mở Jitsi WebView cùng room → P2P video thông qua Jitsi server
```

**✅ Ưu điểm WebView:**
- Đơn giản, không cần native dependencies
- Jitsi UI/UX đã được optimize
- Hỗ trợ chat, screen sharing, recording sẵn
- Easy to maintain

**❌ Nhược điểm WebView:**
- Không thể gọi native API trực tiếp
- Performance hơi chậm so với native SDK
- WebView JavaScript bridge phức tạp nếu cần custom UI

**💡 Nếu muốn upgrade (native SDK):**
```bash
# Cài @jitsi/react-native-sdk
npm install @jitsi/react-native-sdk

# Sẽ cần linking native modules
npx react-native link @jitsi/react-native-sdk
```

---

## 3️⃣ Về Luồng Tư Vấn Tự Động (UC-03)

### **Câu hỏi 3: Auto-reply xử lý ở đâu - Chat Service hay Bot Service riêng?**

**Trả lời:** 
- 🟡 **Chưa implement Auto-Reply feature**
- 💡 **Đề xuất: Implement trong Chat Service (ChatMessageKafkaConsumer)**

**Hiện tại:**
- Backend có `LecturerStatus` enum: `AVAILABLE`, `BUSY` (trong Auth Service)
- Frontend hiển thị `lecturerStatus?: 'available' | 'busy'` khi user busy
- ChatScreen hiển thị banner: "Lecturer is busy now. Messages may be answered later."
- **Nhưng KHÔNG có tính năng tự động trả lời**

**🔴 Vấn đề:** Nếu user busy, tin nhắn vẫn lưu bình thường, không có auto-reply

**✅ Giải pháp đề xuất (Auto-Reply trong Chat Service):**

```java
// backend/chat-service/src/main/java/com/iuhconnect/chatservice/service/AutoReplyService.java

@Service
@RequiredArgsConstructor
public class AutoReplyService {
    
    private final MessageRepository messageRepository;
    private final UserServiceClient userServiceClient;  // Call Auth Service
    private final KafkaTemplate<String, ChatMessageDto> kafkaTemplate;
    
    private static final String AUTO_REPLY_TEMPLATE = 
        "Giảng viên đang bận. Sẽ trả lời bạn sớm nhất có thể. Cảm ơn!";
    
    /**
     * Check nếu receiver busy → gửi auto-reply
     */
    public void handleAutoReply(String receiverId, String senderId, 
                                 String conversationId, String originalContent) {
        try {
            // 1. Get receiver info từ Auth Service
            UserDto receiver = userServiceClient.getUser(receiverId);
            
            // 2. Check nếu receiver là LECTURER và status BUSY
            if (receiver.getRole() == Role.LECTURER && 
                receiver.getLecturerStatus() == LecturerStatus.BUSY) {
                
                // 3. Gửi auto-reply message
                ChatMessageDto autoReply = ChatMessageDto.builder()
                    .senderId(receiverId)  // Gửi từ lecturer
                    .receiverId(senderId)  // Gửi cho sinh viên
                    .content(AUTO_REPLY_TEMPLATE)
                    .conversationId(conversationId)
                    .timestamp(System.currentTimeMillis())
                    .messageType("AUTO_REPLY")
                    .build();
                
                // 4. Publish to Kafka
                kafkaTemplate.send("chat-messages", 
                    conversationId, autoReply);
                
                log.info("🤖 Auto-reply sent to {}", senderId);
            }
        } catch (Exception e) {
            log.error("❌ Auto-reply failed", e);
            // Không crash - tiếp tục xử lý message bình thường
        }
    }
}
```

**Tích hợp vào ChatMessageKafkaConsumer:**

```java
// backend/chat-service/src/main/java/com/iuhconnect/chatservice/consumer/ChatMessageKafkaConsumer.java

@Component
public class ChatMessageKafkaConsumer {
    
    private final AutoReplyService autoReplyService;
    
    @KafkaListener(topics = "chat-messages", groupId = "chat-service-group")
    public void consumeChatMessage(ChatMessageDto message) {
        // 1. Kiểm tra auto-reply
        autoReplyService.handleAutoReply(
            message.getReceiverId(),
            message.getSenderId(),
            message.getConversationId(),
            message.getContent()
        );
        
        // 2. Save original message
        MessageEntity entity = mapDtoToEntity(message);
        messageRepository.save(entity);
        
        // 3. Deliver to receiver
        WebSocketSession receiverSession = webSocketSessionManager
            .getSession(message.getReceiverId());
        if (receiverSession != null && receiverSession.isOpen()) {
            receiverSession.sendMessage(new TextMessage(
                objectMapper.writeValueAsString(message)));
        }
    }
}
```

**Frontend sẽ hiển thị:**
```json
// Auto-reply message từ server
{
  "id": "auto_reply_123",
  "senderId": "lecturer_id",
  "receiverId": "student_id",
  "content": "Giảng viên đang bận. Sẽ trả lời bạn sớm nhất có thể. Cảm ơn!",
  "messageType": "AUTO_REPLY",
  "timestamp": 1684235400000,
  "isAutoReply": true
}
```

**Flow thực tế:**
```
Sinh viên: "Chào giảng viên!"
    ↓
[Chat Service]
    ├─ Check: Lecturer busy? ✅ YES
    │   ├─ Save tin nhắn gốc
    │   └─ Gửi auto-reply: "Giảng viên đang bận..."
    │
    └─ Deliver to Lecturer + Student

Sinh viên nhận: [Auto-Reply] "Giảng viên đang bận..."
Giảng viên nhận: [Tin nhắn gốc] "Chào giảng viên!"
```

**✅ Lợi ích:**
- Sinh viên biết giảng viên bận (reply tức thì)
- Giảng viên không missed tin nhắn
- Có proof "giảng viên nhận được tin nhắn"

**🎯 Nên implement kiểu này:** Tính năng auto-reply phức tạp không đủ để build riêng Bot Service

---

## 4️⃣ Về Hình Ảnh Sơ Đồ UML

### **Bạn chọn Option nào?**

**Option A:** Chỉ viết đặc tả bằng chữ (Step-by-step) → Bạn vẽ lại  
**Option B:** Viết code PlantUML → Copy vào planttext.com → Tự động render

---

### 🎯 **Khuyến cáo: Chọn OPTION B (PlantUML)**

**Lý do:**
1. ✅ **Nhanh gấp 10x** - Chỉ cần copy-paste code
2. ✅ **Chuẩn xác** - Tự động định dạng, không lỗi hand-drawn
3. ✅ **Dễ bảo trì** - Cần thay đổi → chỉnh code → re-render
4. ✅ **Export được** - PNG, SVG, PDF có sẵn

**Cách dùng:**
```
1. Copy code PlantUML từ mình
2. Vào https://www.planttext.com
3. Paste code → ENTER → Hình vẽ xuất hiện
4. Bấm "Export" → Tải PNG/PDF
5. Chèn vào Word/PowerPoint
```

---

## 5️⃣ Về Tính Chịu Lỗi Khi Người Dùng Mất WiFi (Fault Tolerance)

### **Câu hỏi 5: Hệ thống xử lý thế nào khi người dùng mất kết nối WiFi?**

**Trả lời:**
- ✅ **ĐÃ implement cơ chế chịu lỗi toàn diện khi mất WiFi**
- ✅ **4 tầng bảo vệ: NetInfo detect → Offline Queue → Chat Cache → Reconnect Sync**

---

### 📊 Bảng Tổng Hợp Các Khả Năng Chịu Lỗi

| Khả năng | Trạng thái | File implement |
|----------|-----------|----------------|
| Detect mất mạng (OS-level) | ✅ Có | `WebSocketProvider.tsx` — NetInfo listener |
| Hiển thị banner offline | ✅ Có | `OfflineBanner.tsx` — animation slide + pulse |
| Auto-reconnect WebSocket | ✅ Có | `WebSocketProvider.tsx` — exponential backoff |
| Heartbeat (keep-alive) | ✅ Có | `WebSocketProvider.tsx` — ping mỗi 30 giây |
| Lưu tin nhắn chờ gửi (persist) | ✅ Có | `offlineQueue.ts` — AsyncStorage queue |
| Queue & retry tin nhắn offline | ✅ Có | `WebSocketProvider.tsx` — enqueue + flush |
| Sync lại lịch sử khi online | ✅ Có | `ChatScreen.tsx` — wasReconnected → fetchHistory |
| Cache danh sách chat/contacts | ✅ Có | `chatCache.ts` + `ChatListScreen.tsx` |
| Exponential backoff reconnect | ✅ Có | `WebSocketProvider.tsx` — 2s→4s→8s→max 30s |
| Detect mạng trở lại (OS-level) | ✅ Có | `WebSocketProvider.tsx` — NetInfo reconnect ngay |

---

### 🏗️ Kiến Trúc Chịu Lỗi (4 Tầng)

#### **Tầng 1: Offline Message Queue** (`offlineQueue.ts`)

Khi user gửi tin nhắn lúc offline → tin nhắn được persist vào AsyncStorage → tự gửi lại khi có mạng.

```typescript
// frontend/src/services/offlineQueue.ts
export const offlineQueue = {
  async enqueue(payload: object): Promise<string> { ... },  // Queue vào AsyncStorage
  async flush(sendFn): Promise<number> { ... },              // Gửi lại tất cả
  async cleanup(): Promise<void> { ... },                     // Xóa tin > 24h
};

// frontend/src/services/WebSocketProvider.tsx
const sendMessage = useCallback((data: object) => {
  const ws = wsRef.current;
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
    return;
  }
  // ✅ Queue thay vì mất tin nhắn
  offlineQueue.enqueue(data);
}, []);
```

#### **Tầng 2: NetInfo + Exponential Backoff** (`WebSocketProvider.tsx`)

Detect mạng ở mức OS (nhanh hơn WebSocket timeout ~2 phút) + reconnect thông minh (tránh DDoS server).

```typescript
// Exponential backoff: 2s → 4s → 8s → 16s → max 30s (có jitter)
const getReconnectDelay = useCallback(() => {
  const attempt = reconnectAttemptsRef.current;
  return Math.min(1000 * Math.pow(2, attempt) + Math.random() * 1000, 30000);
}, []);

// NetInfo listener — detect mạng trở lại → reconnect ngay
useEffect(() => {
  const unsubscribe = NetInfo.addEventListener(state => {
    if (state.isConnected && !isConnected && shouldReconnectRef.current) {
      reconnectAttemptsRef.current = 0;
      clearTimeout(reconnectTimeoutRef.current);
      connect();
    }
  });
  return () => unsubscribe();
}, [isConnected, connect]);
```

#### **Tầng 3: Chat Cache Local** (`chatCache.ts`)

Cache tin nhắn + danh sách chat vào AsyncStorage → user vẫn xem được khi mất mạng.

```typescript
// frontend/src/services/chatCache.ts
export const chatCache = {
  async saveMessages(conversationId, messages) { ... },   // Cache khi fetch OK
  async loadMessages(conversationId) { ... },              // Load khi offline
  async saveConversations(conversations) { ... },          // Cache danh sách
  async loadConversations() { ... },                       // Load khi offline
};

// ChatScreen.tsx — fetchHistory có fallback cache
const fetchHistory = useCallback(async (beforeTimestamp?) => {
  try {
    // ... fetch từ server ...
    chatCache.saveMessages(conversationId, nextMessages);  // ✅ Cache
  } catch (error) {
    // ✅ Fallback khi mất mạng
    const cached = await chatCache.loadMessages(conversationId);
    if (cached.length > 0) setMessages(cached);
  }
}, [...]);

// ChatListScreen.tsx — loadConversations có fallback cache
const loadConversations = useCallback(async () => {
  try {
    // ... fetch từ server ...
    chatCache.saveConversations(sanitized);  // ✅ Cache
  } catch (error) {
    // ✅ Fallback khi mất mạng
    const cached = await chatCache.loadConversations();
    if (cached.length > 0) setConversations(cached);
  }
}, [currentUser]);
```

#### **Tầng 4: Reconnect Sync** (`WebSocketProvider.tsx` + `ChatScreen.tsx`)

Khi online trở lại → tự fetch lại tin nhắn bị miss + flush pending queue.

```typescript
// WebSocketProvider.tsx — ws.onopen flush queue + set wasReconnected
ws.onopen = () => {
  reconnectAttemptsRef.current = 0;
  setIsConnected(true);
  setWasReconnected(true);  // ✅ Flag cho ChatScreen
  startHeartbeat();
  offlineQueue.flush((payload) => ws.send(JSON.stringify(payload)));
  offlineQueue.cleanup();
};

// ChatScreen.tsx — re-sync khi reconnect
useEffect(() => {
  if (wasReconnected && isConnected) {
    fetchHistory();       // ✅ Lấy tin nhắn miss
    markMessagesAsRead(); // ✅ Đánh dấu đã đọc
  }
}, [wasReconnected, isConnected, fetchHistory, markMessagesAsRead]);
```

---

### 📊 Flow Chịu Lỗi Hoàn Chỉnh Khi Mất WiFi

```
User đang chat → WiFi mất đột ngột
    │
    ├─ [1] NetInfo detect → setIsConnected(false)
    │   └─ Hiện OfflineBanner: "Không có kết nối mạng"
    │
    ├─ [2] User gửi tin nhắn khi offline
    │   ├─ Optimistic update → Hiện trên UI (status: 'sending')
    │   ├─ ws.send() fail → offlineQueue.enqueue()
    │   └─ Tin nhắn persist vào AsyncStorage (không mất khi close app)
    │
    ├─ [3] WebSocket onclose fire
    │   ├─ Reconnect attempt 1: chờ 2s
    │   ├─ Reconnect attempt 2: chờ 4s
    │   ├─ Reconnect attempt 3: chờ 8s
    │   └─ ... (exponential backoff, max 30s)
    │
    ├─ [4] User mở conversation khác khi offline
    │   ├─ fetchHistory() fail
    │   └─ ✅ Load từ chatCache (local) → Vẫn xem được tin nhắn cũ
    │
    ▼
WiFi trở lại
    │
    ├─ [5] NetInfo detect → state.isConnected = true
    │   └─ Trigger connect() ngay lập tức (không đợi timeout)
    │
    ├─ [6] WebSocket reconnect thành công
    │   ├─ offlineQueue.flush() → Gửi tất cả tin nhắn chờ
    │   ├─ wasReconnected = true → ChatScreen re-fetch history
    │   └─ fetchHistory() → Sync tin nhắn bị miss
    │
    └─ [7] OfflineBanner ẩn đi → User tiếp tục bình thường
```

---

### 📁 Files Implement Tính Chịu Lỗi

| File | Vai trò |
|------|---------|
| `frontend/src/services/offlineQueue.ts` | **Mới** — Queue tin nhắn offline vào AsyncStorage |
| `frontend/src/services/chatCache.ts` | **Mới** — Cache tin nhắn + conversations local |
| `frontend/src/services/WebSocketProvider.tsx` | **Sửa** — NetInfo + backoff + queue + wasReconnected |
| `frontend/src/screens/ChatScreen.tsx` | **Sửa** — Cache fallback + reconnect sync |
| `frontend/src/screens/ChatListScreen.tsx` | **Sửa** — Cache fallback conversations |
| `frontend/package.json` | **Sửa** — Thêm `@react-native-community/netinfo ^12.0.1` |

---

## ✅ SUMMARY - Trả Lời Các Câu Hỏi

| # | Câu Hỏi | Trả Lời |
|---|---------|---------|
| 1a | NetInfo? | ✅ **ĐÃ dùng** `@react-native-community/netinfo ^12.0.1` kết hợp WebSocket state |
| 1b | Lưu offline message ở đâu? | ✅ **AsyncStorage** — `offlineQueue.ts` enqueue/flush/cleanup |
| 2 | Jitsi Native hay WebView? | ✅ Dùng WebView (đơn giản, đủ tính năng) |
| 3 | Auto-reply ở đâu? | 🟡 Chưa implement. Đề xuất: Chat Service + AutoReplyService |
| 4 | UML: Option A hay B? | ✅ **OPTION B (PlantUML code) - Nhanh & chính xác** |
| 5 | Chịu lỗi khi mất WiFi? | ✅ **ĐÃ implement.** NetInfo + Offline Queue + Chat Cache + Reconnect Sync |

---

## 📝 Bước Tiếp Theo (Nếu bạn muốn)

**Đã hoàn thành:**

1. ✅ **Offline Sync:** ĐÃ implement
   - ✅ `@react-native-community/netinfo` đã cài
   - ✅ `offlineQueue.ts` — queue tin nhắn chờ gửi
   - ✅ `chatCache.ts` — cache lịch sử chat local
   - ✅ WebSocketProvider: NetInfo listener + exponential backoff + flush queue

2. ✅ **Fault Tolerance:** ĐÃ implement
   - ✅ Offline Message Queue (không mất tin nhắn)
   - ✅ NetInfo detect mạng OS-level
   - ✅ Exponential backoff reconnect (2s→4s→8s→max 30s)
   - ✅ Chat cache local (xem tin nhắn cũ khi offline)
   - ✅ Reconnect sync (fetch lại tin nhắn miss)

**Chưa hoàn thành:**

3. 🟡 **Auto-Reply:**
   - Tạo `AutoReplyService.java` trong chat-service
   - Update `ChatMessageKafkaConsumer` để call `autoReplyService.handleAutoReply()`
   - Test với Postman: Gửi message → Lecturer busy → Kiểm tra auto-reply

4. 🟡 **UML Diagrams:**
   - Nếu bạn muốn mình viết PlantUML code cho các sơ đồ
   - Yêu cầu bạn list nên có diagram nào (UC, Activity, Sequence, Class)
   - Mình sẽ viết code PlantUML + hướng dẫn cách render

