# IUH Connect - Phân Tích Chi Tiết 4 Câu Hỏi Thiết Kế

## 1️⃣ Về Luồng Đồng Bộ Offline (UC-01 & Mục 3.6)

### **Câu hỏi 1a: Thư viện bắt sự kiện mạng trở lại?**

**Trả lời:** 
- ❌ **CHƯA sử dụng @react-native-community/netinfo**
- ✅ **Hiện tại dùng WebSocket connection state để detect offline**

**Cách hiện tại hoạt động:**

```typescript
// frontend/src/services/WebSocketProvider.tsx
const [isConnected, setIsConnected] = useState(false);

// WebSocket connection events
ws.onopen = () => {
  setIsConnected(true);  // Network OK
};

ws.onerror = () => {
  setIsConnected(false);  // Network down
};

ws.onclose = () => {
  setIsConnected(false);  // Network down
  // Auto-reconnect sau 5 giây
  reconnectTimeoutRef.current = setTimeout(() => {
    if (shouldReconnectRef.current) {
      // Reconnect logic
    }
  }, 5000);
};
```

**Hiển thị trạng thái:**
```typescript
// frontend/src/components/OfflineBanner.tsx
// Banner hiển thị "Không có kết nối mạng" khi offline
<OfflineBanner isOffline={!isConnected} />

// Trong ChatScreen: Tin nhắn đưa vào state với status = 'sending'
// Nếu mất mạng, display banner và user biết mình offline
```

**🔴 Vấn đề hiện tại:** Chỉ detect offline khi WebSocket close, không detect mất mạng real-time từ hệ thống

**💡 Đề xuất cải tiến:**
```typescript
// Thêm package: @react-native-community/netinfo
import NetInfo from "@react-native-community/netinfo";

// Trong WebSocketProvider.tsx
useEffect(() => {
  const unsubscribe = NetInfo.addEventListener(state => {
    if (state.isConnected && !isConnected && shouldReconnectRef.current) {
      // Network trở lại → reconnect WebSocket
      connectWebSocket();
    }
    setIsConnected(state.isConnected ?? false);
  });
  
  return () => unsubscribe();
}, [isConnected]);
```

---

### **Câu hỏi 1b: Lưu tin nhắn chờ gửi ở đâu?**

**Trả lời:** 
- 🟡 **Hiện tại chỉ lưu trong state React (bộ nhớ tạm)**
- ❌ **Chưa persist vào device storage**

**Cách hiện tại:**
```typescript
// frontend/src/screens/ChatScreen.tsx
const onSend = (newMessages: IMessage[] = []) => {
  const optimisticMessages: ExtendedMessage[] = newMessages.map(msg => ({
    ...msg,
    _id: createLocalMessageId(),  // LOCAL_ID format
    status: isOffline ? 'sending' : 'sent',
    isOffline,  // Mark as offline message
  }));

  // Chỉ lưu vào state (bộ nhớ tạm)
  setMessages(prev => GiftedChat.append(prev, optimisticMessages));
  
  // Gửi qua WebSocket
  sendMessage({...});  // Fail nếu offline
};
```

**⚠️ Vấn đề:** 
- Khi user close app → mất tất cả pending messages
- Khi offline quá lâu → browser crash → tin nhắn mất

**💡 Đề xuất sử dụng AsyncStorage:**

```typescript
// frontend/src/services/offlineMessageService.ts
import AsyncStorage from '@react-native-async-storage/async-storage';

const PENDING_MESSAGES_KEY = '@pending_messages';

// Lưu tin nhắn chờ gửi
export const savePendingMessage = async (message: ExtendedMessage) => {
  try {
    const existing = await AsyncStorage.getItem(PENDING_MESSAGES_KEY);
    const messages = existing ? JSON.parse(existing) : [];
    messages.push({
      ...message,
      savedAt: Date.now(),
    });
    await AsyncStorage.setItem(PENDING_MESSAGES_KEY, JSON.stringify(messages));
  } catch (e) {
    console.error('Failed to save pending message', e);
  }
};

// Lấy tất cả tin nhắn chờ
export const getPendingMessages = async () => {
  try {
    const data = await AsyncStorage.getItem(PENDING_MESSAGES_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
};

// Gửi lại khi mạng trở lại
export const retryPendingMessages = async (sendMessage: (msg: any) => void) => {
  const pending = await getPendingMessages();
  for (const msg of pending) {
    sendMessage(msg);
  }
  // Clear sau khi gửi
  await AsyncStorage.removeItem(PENDING_MESSAGES_KEY);
};
```

**Cấu trúc dữ liệu AsyncStorage:**
```json
{
  "@pending_messages": [
    {
      "_id": "local-1684235400000-abc123",
      "senderId": "hiep123",
      "receiverId": "nam456",
      "content": "Chào bạn!",
      "conversationId": "conv_hiep_nam",
      "messageType": "TEXT",
      "status": "sending",
      "savedAt": 1684235400000
    },
    {
      "_id": "local-1684235410000-def456",
      "senderId": "hiep123",
      "receiverId": "nam456",
      "content": "Bạn khỏe không?",
      "conversationId": "conv_hiep_nam",
      "messageType": "TEXT",
      "status": "sending",
      "savedAt": 1684235410000
    }
  ]
}
```

**So sánh các tùy chọn lưu trữ:**

| Tùy chọn | Dung lượng | Tốc độ | Vĩnh viễn | Khuyên dùng |
|----------|-----------|-------|----------|-----------|
| AsyncStorage | ~5MB | Chậm | ✅ Có | ✅ Cho tin nhắn chờ gửi |
| SQLite | Không giới hạn | Nhanh | ✅ Có | ❌ Overkill cho project này |
| WatermelonDB | Không giới hạn | Cực nhanh | ✅ Có | ❌ Phức tạp, không cần |
| Memory (state) | RAM | Cực nhanh | ❌ Không | ❌ Mất dữ liệu khi close app |

**✅ Khuyến cáo:** Dùng **AsyncStorage** (đơn giản, đủ dung lượng, dễ implement)

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
- 🔴 **CHƯA có cơ chế chịu lỗi toàn diện khi mất WiFi**
- 🟡 **Chỉ có một số xử lý cơ bản, chưa đủ cho production**

---

### 📊 Phân Tích Hiện Trạng (Đã Có vs Chưa Có)

| Khả năng | Trạng thái | Mô tả |
|----------|-----------|-------|
| Detect mất mạng | 🟡 Một phần | Chỉ qua WebSocket `onclose/onerror`, không dùng OS-level network API |
| Hiển thị banner offline | ✅ Có | `OfflineBanner.tsx` - hiển thị "Không có kết nối mạng" với animation |
| Auto-reconnect WebSocket | ✅ Có | Reconnect sau 3 giây khi `ws.onclose` fire |
| Heartbeat (keep-alive) | ✅ Có | Ping mỗi 30 giây để giữ kết nối |
| Lưu tin nhắn chờ gửi (persist) | ❌ Chưa | Tin nhắn chỉ nằm trong React state (RAM), close app = mất |
| Queue & retry tin nhắn offline | ❌ Chưa | `sendMessage()` gọi `ws.send()` trực tiếp, fail silent nếu offline |
| Sync lại lịch sử khi online | ❌ Chưa | Không fetch lại tin nhắn bị miss trong lúc offline |
| Cache danh sách chat/contacts | ❌ Chưa | Mất mạng = blank screen (không xem được gì) |
| Exponential backoff reconnect | ❌ Chưa | Reconnect cố định 3 giây, có thể gây DDoS server |
| Detect mạng trở lại (OS-level) | ❌ Chưa | Không dùng NetInfo, phải đợi WebSocket timeout mới biết |

---

### 🔴 6 Lỗ Hổng Chính Khi Mất WiFi

#### **Lỗ hổng 1: Tin nhắn gửi khi offline bị "nuốt" (Silent Failure)**

```typescript
// WebSocketProvider.tsx - Line 371-378
const sendMessage = useCallback((data: object) => {
  const ws = wsRef.current;
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
    return;
  }
  // ⚠️ Chỉ log warning, KHÔNG queue lại tin nhắn
  console.warn('[WSProvider] WebSocket is not connected');
}, []);
```

**Vấn đề:** Khi offline, `sendMessage()` chỉ log warning → tin nhắn biến mất hoàn toàn. User thấy tin nhắn hiện trên UI (optimistic update) nhưng nó không bao giờ được gửi đi.

#### **Lỗ hổng 2: Không có Message Queue persist**

```typescript
// ChatScreen.tsx - Line 734-787
const onSend = useCallback((newMessages: IMessage[] = []) => {
  const optimisticMessages = newMessages.map(msg => ({
    ...msg,
    status: isOffline ? 'sending' : 'sent',
    isOffline,
  }));

  // ⚠️ Chỉ lưu vào React state (RAM)
  setMessages(prev => GiftedChat.append(prev, optimisticMessages));

  // ⚠️ Gọi sendMessage trực tiếp - fail nếu offline
  optimisticMessages.forEach(message => {
    sendMessage({...});  // → console.warn nếu offline
  });
}, [...]);
```

**Vấn đề:** Close app khi offline → tất cả tin nhắn "đang gửi" mất vĩnh viễn.

#### **Lỗ hổng 3: Reconnect không có Exponential Backoff**

```typescript
// WebSocketProvider.tsx - Line 340-344
ws.onclose = () => {
  // ⚠️ Luôn retry sau 3 giây cố định
  reconnectTimeoutRef.current = setTimeout(() => {
    if (isMountedRef.current && shouldReconnectRef.current) {
      connect();  // → Thất bại → Lại 3 giây → Lại thất bại → Vòng lặp
    }
  }, 3000);
};
```

**Vấn đề:** Nếu mất mạng 30 phút → hệ thống retry 600 lần (mỗi 3 giây). Khi có hàng nghìn user cùng mất mạng (sự cố ISP), server bị DDoS bởi reconnect requests.

#### **Lỗ hổng 4: Không sync lại lịch sử khi online trở lại**

```typescript
// WebSocketProvider.tsx - ws.onopen
ws.onopen = () => {
  console.log('✅ [WSProvider] WebSocket connected');
  setIsConnected(true);
  startHeartbeat();
  // ⚠️ KHÔNG có logic nào để:
  // - Fetch lại tin nhắn bị miss
  // - Retry pending messages
  // - Sync conversation list
};
```

**Vấn đề:** User offline 10 phút → 5 tin nhắn mới từ bạn bè → User online lại → Không thấy 5 tin nhắn đó cho đến khi mở lại ChatScreen.

#### **Lỗ hổng 5: Không detect mạng ở mức hệ điều hành**

```typescript
// ⚠️ Hiện tại chỉ dựa vào WebSocket connection state
const isOffline = !isConnected;  // ChatScreen.tsx - Line 338

// Vấn đề: WebSocket có thể vẫn "open" nhưng mạng đã chết
// (TCP keepalive timeout có thể lên đến 2 phút)
// → User tưởng online → Gửi tin nhắn → Mất
```

#### **Lỗ hổng 6: Blank screen khi mất mạng**

Khi mở app hoặc navigate đến ChatScreen/ConversationsScreen mà không có mạng:
- `fetchHistory()` fail → `messages = []` → Blank
- `fetchPresence()` fail → Không biết trạng thái
- Không có local cache → User không xem được tin nhắn cũ

---

### ✅ Giải Pháp Đề Xuất Toàn Diện

#### **Giải pháp 1: Offline Message Queue với AsyncStorage**

```typescript
// frontend/src/services/offlineQueue.ts
import AsyncStorage from '@react-native-async-storage/async-storage';

const QUEUE_KEY = '@offline_message_queue';

interface QueuedMessage {
  id: string;
  payload: object;
  createdAt: number;
  retryCount: number;
}

export const offlineQueue = {
  // Thêm tin nhắn vào queue
  async enqueue(payload: object): Promise<string> {
    const id = `queue_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const queue = await this.getAll();
    queue.push({ id, payload, createdAt: Date.now(), retryCount: 0 });
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    return id;
  },

  // Lấy tất cả tin nhắn chờ
  async getAll(): Promise<QueuedMessage[]> {
    const data = await AsyncStorage.getItem(QUEUE_KEY);
    return data ? JSON.parse(data) : [];
  },

  // Xóa tin nhắn đã gửi thành công
  async dequeue(id: string): Promise<void> {
    const queue = await this.getAll();
    const filtered = queue.filter(item => item.id !== id);
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(filtered));
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
      } catch {
        // Giữ lại trong queue để retry sau
        break;
      }
    }
    return sent;
  },

  // Xóa tin nhắn quá 24 giờ
  async cleanup(): Promise<void> {
    const queue = await this.getAll();
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    const valid = queue.filter(item => item.createdAt > cutoff);
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(valid));
  },
};
```

#### **Giải pháp 2: Tích hợp NetInfo + Reconnect thông minh**

```typescript
// Cập nhật WebSocketProvider.tsx
import NetInfo from '@react-native-community/netinfo';
import { offlineQueue } from './offlineQueue';

// Trong WebSocketProvider:
const reconnectAttemptsRef = useRef(0);
const MAX_RECONNECT_DELAY = 30000; // Max 30 giây

// Exponential backoff
const getReconnectDelay = () => {
  const attempt = reconnectAttemptsRef.current;
  const delay = Math.min(
    1000 * Math.pow(2, attempt) + Math.random() * 1000,  // Jitter
    MAX_RECONNECT_DELAY
  );
  return delay;
};

// NetInfo listener - detect mạng ở mức OS
useEffect(() => {
  const unsubscribe = NetInfo.addEventListener(state => {
    if (state.isConnected && !isConnected) {
      // Mạng vừa trở lại → reconnect ngay
      reconnectAttemptsRef.current = 0;
      connect();
    }
  });
  return () => unsubscribe();
}, [isConnected, connect]);

// Cập nhật ws.onopen - flush queue khi reconnect
ws.onopen = () => {
  setIsConnected(true);
  reconnectAttemptsRef.current = 0;  // Reset backoff
  startHeartbeat();

  // ✅ Flush offline queue
  offlineQueue.flush((payload) => {
    ws.send(JSON.stringify(payload));
  }).then(count => {
    if (count > 0) {
      console.log(`✅ Đã gửi ${count} tin nhắn offline`);
    }
  });
};

// Cập nhật ws.onclose - exponential backoff
ws.onclose = () => {
  setIsConnected(false);
  stopHeartbeat();

  if (shouldReconnectRef.current) {
    const delay = getReconnectDelay();
    reconnectAttemptsRef.current++;
    console.log(`🔄 Reconnect sau ${Math.round(delay/1000)}s (lần ${reconnectAttemptsRef.current})`);
    
    reconnectTimeoutRef.current = setTimeout(() => {
      if (isMountedRef.current && shouldReconnectRef.current) {
        connect();
      }
    }, delay);
  }
};

// Cập nhật sendMessage - queue nếu offline
const sendMessage = useCallback((data: object) => {
  const ws = wsRef.current;
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
    return;
  }
  // ✅ Queue thay vì chỉ log warning
  offlineQueue.enqueue(data).then(id => {
    console.log(`📥 Queued message: ${id}`);
  });
}, []);
```

#### **Giải pháp 3: Cache lịch sử chat local**

```typescript
// frontend/src/services/chatCache.ts
import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_PREFIX = '@chat_cache_';
const MAX_CACHED_MESSAGES = 50; // Cache 50 tin nhắn gần nhất mỗi conversation

export const chatCache = {
  async save(conversationId: string, messages: any[]): Promise<void> {
    const key = `${CACHE_PREFIX}${conversationId}`;
    const sliced = messages.slice(0, MAX_CACHED_MESSAGES);
    await AsyncStorage.setItem(key, JSON.stringify(sliced));
  },

  async load(conversationId: string): Promise<any[]> {
    const key = `${CACHE_PREFIX}${conversationId}`;
    const data = await AsyncStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  },

  async clear(conversationId: string): Promise<void> {
    await AsyncStorage.removeItem(`${CACHE_PREFIX}${conversationId}`);
  },
};

// Sử dụng trong ChatScreen.tsx:
// 1. Khi fetchHistory thành công → cache lại
const fetchHistory = useCallback(async (beforeTimestamp?: number) => {
  try {
    // ... fetch logic ...
    const historyMessages = data.map(msg => mapServerMessage(msg, currentUser));
    
    // ✅ Cache vào local storage
    if (!beforeTimestamp) {
      await chatCache.save(conversationId, historyMessages);
    }
    
    setMessages(historyMessages);
  } catch (error) {
    // ✅ Fallback: load từ cache khi mất mạng
    console.log('Fetch failed, loading from cache...');
    const cached = await chatCache.load(conversationId);
    if (cached.length > 0) {
      setMessages(cached);
    }
  }
}, [conversationId, currentUser]);
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
    │   ├─ Update message status: 'sending' → 'sent'
    │   └─ fetchHistory() → Sync tin nhắn bị miss
    │
    └─ [7] OfflineBanner ẩn đi → User tiếp tục bình thường
```

---

### 📦 Packages Cần Thêm

```bash
# Detect trạng thái mạng ở mức OS
npm install @react-native-community/netinfo

# AsyncStorage đã có sẵn trong project (dùng cho auth)
# Không cần cài thêm
```

---

## ✅ SUMMARY - Trả Lời Các Câu Hỏi

| # | Câu Hỏi | Trả Lời |
|---|---------|---------|
| 1a | NetInfo? | ❌ Chưa dùng, chỉ dùng WebSocket state. Đề xuất thêm NetInfo |
| 1b | Lưu offline message ở đâu? | 🟡 Hiện tại: Memory state. Đề xuất: AsyncStorage |
| 2 | Jitsi Native hay WebView? | ✅ Dùng WebView (đơn giản, đủ tính năng) |
| 3 | Auto-reply ở đâu? | 🟡 Chưa implement. Đề xuất: Chat Service + AutoReplyService |
| 4 | UML: Option A hay B? | ✅ **OPTION B (PlantUML code) - Nhanh & chính xác** |
| 5 | Chịu lỗi khi mất WiFi? | 🔴 **Chưa có.** Chỉ có banner + auto-reconnect cơ bản. Thiếu: queue persist, backoff, cache, sync |

---

## 📝 Bước Tiếp Theo (Nếu bạn muốn)

**Để hoàn thiện features:**

1. ✅ **Offline Sync:**
   - Thêm `@react-native-community/netinfo` vào package.json
   - Implement `offlineQueue.ts` (queue tin nhắn chờ gửi)
   - Implement `chatCache.ts` (cache lịch sử chat local)
   - Update WebSocketProvider: NetInfo listener + exponential backoff + flush queue

2. ✅ **Auto-Reply:**
   - Tạo `AutoReplyService.java` trong chat-service
   - Update `ChatMessageKafkaConsumer` để call `autoReplyService.handleAutoReply()`
   - Test với Postman: Gửi message → Lecturer busy → Kiểm tra auto-reply

3. ✅ **UML Diagrams:**
   - Nếu bạn muốn mình viết PlantUML code cho các sơ đồ
   - Yêu cầu bạn list nên có diagram nào (UC, Activity, Sequence, Class)
   - Mình sẽ viết code PlantUML + hướng dẫn cách render

4. 🔴 **Fault Tolerance (Ưu tiên cao):**
   - Implement `offlineQueue.ts` → Không mất tin nhắn khi offline
   - Thêm NetInfo → Detect mạng nhanh hơn (không đợi WebSocket timeout)
   - Exponential backoff → Tránh DDoS server khi nhiều user reconnect
   - Chat cache → User vẫn xem được tin nhắn cũ khi mất mạng

