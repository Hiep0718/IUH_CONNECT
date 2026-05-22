# IUH Connect - Thiết Kế Chi Tiết Hệ Thống

## Mục Lục
1. [Thiết Kế Dữ Liệu (Mục 3.1)](#mục-31-thiết-kế-dữ-liệu)
2. [Thiết Kế Mức Lớp - Class Design (Mục 3.2)](#mục-32-thiết-kế-mức-lớp---class-design)
3. [Thiết Kế Giao Diện Lập Trình - API Specification (Mục 3.3)](#mục-33-thiết-kế-giao-diện-lập-trình---api-specification)

---

## Mục 3.1: Thiết Kế Dữ Liệu

### I. MariaDB (Auth Service) - Cấu Trúc Bảng

#### Bảng 1: `users` - Quản Lý Người Dùng

| Trường | Kiểu | Ràng Buộc | Mô Tả |
|--------|------|----------|-------|
| `id` | BIGINT | PRIMARY KEY, AUTO_INCREMENT | ID duy nhất |
| `username` | VARCHAR(50) | UNIQUE, NOT NULL | Tên đăng nhập |
| `password_hash` | VARCHAR(255) | NOT NULL | Hash mật khẩu (bcrypt) |
| `email` | VARCHAR(100) | UNIQUE | Email |
| `full_name` | VARCHAR(100) | | Họ tên đầy đủ |
| `avatar_url` | VARCHAR(500) | | URL ảnh đại diện |
| `gender` | ENUM('MALE', 'FEMALE', 'OTHER') | | Giới tính |
| `date_of_birth` | DATE | | Ngày sinh |
| `address` | VARCHAR(255) | | Địa chỉ |
| `bio` | VARCHAR(500) | | Tiểu sử cá nhân |
| `phone` | VARCHAR(20) | | Số điện thoại |
| `student_id` | VARCHAR(50) | UNIQUE | Mã sinh viên (nếu là sinh viên) |
| `lecturer_id` | VARCHAR(50) | UNIQUE | Mã giảng viên (nếu là giảng viên) |
| `department` | VARCHAR(100) | | Bộ môn/Khoa |
| `lecturer_status` | ENUM('ACTIVE', 'INACTIVE', 'ON_LEAVE') | | Trạng thái giảng viên |
| `role` | ENUM('STUDENT', 'LECTURER', 'ADMIN') | DEFAULT 'STUDENT' | Vai trò người dùng |
| `fcm_token` | VARCHAR(500) | | Firebase Cloud Messaging token |

**Ví dụ dữ liệu:**
```sql
INSERT INTO users VALUES (
  1, 'hiep123', '$2a$10$...', 'hiep@iuh.edu.vn', 'Trần Thành Hiệp', 
  'https://minio.../avatar.jpg', 'MALE', '2004-01-15', 'TP.HCM', 
  'Sinh viên CNTT', '0912345678', '20210123', NULL, 'CNTT', NULL, 
  'STUDENT', 'fcm_token_here'
);
```

---

#### Bảng 2: `friendships` - Quan Hệ Bạn Bè

| Trường | Kiểu | Ràng Buộc | Mô Tả |
|--------|------|----------|-------|
| `id` | BIGINT | PRIMARY KEY, AUTO_INCREMENT | ID duy nhất |
| `user_id1` | BIGINT | FOREIGN KEY → users(id) | ID người gửi yêu cầu |
| `user_id2` | BIGINT | FOREIGN KEY → users(id) | ID người nhận yêu cầu |
| `status` | ENUM('PENDING', 'ACCEPTED') | NOT NULL | Trạng thái kết bạn |
| `created_at` | TIMESTAMP | NOT NULL | Thời gian tạo |
| `updated_at` | TIMESTAMP | NOT NULL | Thời gian cập nhật |

**Constraint:**
- `UNIQUE(user_id1, user_id2)` - Không có yêu cầu trùng lặp

**Ví dụ dữ liệu:**
```sql
-- Yêu cầu kết bạn chờ duyệt
INSERT INTO friendships VALUES (
  1, 1, 2, 'PENDING', NOW(), NOW()
);

-- Kết bạn đã được chấp nhận
INSERT INTO friendships VALUES (
  2, 1, 3, 'ACCEPTED', NOW(), NOW()
);
```

**Liên kết (Foreign Keys):**
```
users.id ──1────M──> friendships.user_id1
users.id ──1────M──> friendships.user_id2
```

---

### II. MongoDB (Chat Service) - Cấu Trúc Collection

#### Collection 1: `messages` - Lưu Trữ Tin Nhắn

**Cấu trúc JSON:**
```json
{
  "_id": ObjectId("507f1f77bcf86cd799439011"),
  "sender_id": "hiep123",
  "receiver_id": "nam456",
  "content": "Chào bạn!",
  "conversation_id": "conv_hiep123_nam456",
  "timestamp": 1684235400000,
  
  // Media fields
  "message_type": "TEXT",                    // TEXT, IMAGE, VIDEO, FILE, STICKER
  "media_url": "https://minio.../image.jpg",
  "thumbnail_url": "https://minio.../thumb.jpg",
  "file_name": "document.pdf",
  "file_size": 2097152,                      // 2MB
  "mime_type": "application/pdf",
  
  // Read status
  "is_read": false,
  "unread_count": 1,
  
  // Reactions - Map emoji → array users
  "reactions": {
    "❤️": ["nam456", "linh789"],
    "😂": ["user_a"],
    "👍": ["user_b", "user_c"]
  },
  
  // Reply (nếu reply to another message)
  "reply_to_id": ObjectId("507f1f77bcf86cd799439010"),
  "reply_to_text": "Bạn khỏe không?",
  "reply_to_sender": "nam456"
}
```

**Indexes:**
```javascript
// Compound Index để query lịch sử nhanh
db.messages.createIndex({
  "conversation_id": 1,
  "timestamp": -1
})
```

**Lý do thiết kế:**
- Lưu tin nhắn thô trong MongoDB (NoSQL) vì dữ liệu không có schema cố định
- Mỗi tin nhắn là document độc lập
- `reactions` là Map để dễ add/remove emoji
- `is_read` để track trạng thái đọc tin nhắn
- `timestamp` index giúp query nhanh lịch sử

---

#### Collection 2: `conversations` - Phòng Chat & Nhóm

**Cấu trúc JSON:**

```json
{
  "_id": ObjectId("507f1f77bcf86cd799439012"),
  
  // Thông tin nhóm (chỉ có nếu type = GROUP)
  "name": "Nhóm lập trình Java",
  "avatar": "https://minio.../group_avatar.jpg",
  
  "type": "GROUP",                           // SINGLE hoặc GROUP
  "creator_id": "hiep123",                   // Người tạo nhóm
  
  // Danh sách members
  "members": [
    {
      "user_id": "hiep123",
      "role": "ADMIN",                       // ADMIN hoặc MEMBER
      "joined_at": 1684235400000
    },
    {
      "user_id": "nam456",
      "role": "MEMBER",
      "joined_at": 1684235500000
    },
    {
      "user_id": "linh789",
      "role": "MEMBER",
      "joined_at": 1684235600000
    }
  ],
  
  "created_at": 1684235400000,
  "updated_at": 1684235400000,
  "last_message_id": ObjectId("507f1f77bcf86cd799439011")
}
```

**Ví dụ Conversation SINGLE (1-1):**
```json
{
  "_id": ObjectId("507f1f77bcf86cd799439013"),
  "type": "SINGLE",
  "members": [
    {"user_id": "hiep123", "role": "MEMBER", "joined_at": 1684235400000},
    {"user_id": "nam456", "role": "MEMBER", "joined_at": 1684235400000}
  ],
  "created_at": 1684235400000,
  "last_message_id": ObjectId("507f1f77bcf86cd799439011")
}
```

**Lý do thiết kế:**
- Lưu members trong array để dễ query group info
- Role (ADMIN/MEMBER) để phân quyền trong nhóm
- Lưu `last_message_id` để hiển thị preview message gần nhất

---

### III. Redis (Presence Service) - Cấu Trúc Key-Value Trạng Thái Online

#### Key Structure:

**1. Presence Status:**
```
KEY:     presence:{userId}
VALUE:   "ONLINE"
TTL:     90 seconds
```

**Ví dụ:**
```redis
SET presence:hiep123 "ONLINE" EX 90
SET presence:nam456 "ONLINE" EX 90
```

**2. Last Seen Timestamp:**
```
KEY:     lastseen:{userId}
VALUE:   Long (milliseconds)
TTL:     Vĩnh viễn (không expire)
```

**Ví dụ:**
```redis
SET lastseen:hiep123 "1684235400000"
SET lastseen:nam456 "1684235500000"
```

**3. Pub/Sub Channel cho Signaling:**
```
CHANNEL: signaling:{instanceId}
```

#### Flow Trạng Thái Presence:

```
CLIENT CONNECT
    ↓
WebSocket established
    ↓
presenceService.setOnline(username)
    ├─ SET presence:{username} "ONLINE" EX 90
    ├─ SET lastseen:{username} {timestamp}
    └─ PUBLISH presence-events {"userId": username, "status": "ONLINE"}
    ↓
[Mỗi 30 giây - Client gửi PING]
    ↓
presenceService.refreshHeartbeat(username)
    ├─ EXPIRE presence:{username} 90   (Kéo dài TTL)
    └─ SET lastseen:{username} {new_timestamp}
    ↓
[Nếu không gửi PING trong 90s]
    ↓
Redis key expire automatically
    ↓
presenceService.setOffline(username)
    ├─ DEL presence:{username}
    ├─ SET lastseen:{username} {last_timestamp}
    └─ PUBLISH presence-events {"userId": username, "status": "OFFLINE"}
```

**Ví dụ dữ liệu Redis:**
```redis
# User hiện online
PRESENCE:hiep123 = "ONLINE"    TTL: 90s
PRESENCE:nam456 = "ONLINE"     TTL: 90s
LASTSEEN:hiep123 = "1684235400000"
LASTSEEN:nam456 = "1684235500000"

# User offline
LASTSEEN:user_offline = "1684234000000"   (no presence key)
```

---

## Mục 3.2: Thiết Kế Mức Lớp - Class Design

### Kiến Trúc Tổng Quan Chat Service

```
┌─────────────────────────────────────────────────────────┐
│                   Frontend (React Native)                │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ├─ HTTP REST API
                   └─ WebSocket (ws://host/ws/chat)
                   ↓
┌─────────────────────────────────────────────────────────┐
│                   API Gateway                            │
│            (JWT Authentication)                         │
└──────────────┬──────────────────┬──────────────────────┘
               │                  │
               ↓                  ↓
        ┌─────────────┐    ┌──────────────────┐
        │  REST APIs  │    │  WebSocket       │
        └─────────────┘    └──────────────────┘
               │                  │
               ↓                  ↓
        ┌──────────────────────────────────────┐
        │   Chat Service (Spring Boot)         │
        └──────────────────────────────────────┘
```

### Core Classes trong Chat Service

#### 1. **REST Controllers**

##### a) `ChatController`
**Vị trí:** `backend/chat-service/src/main/java/com/iuhconnect/chatservice/controller/ChatController.java`

**Chức năng:**
- Xử lý REST API endpoints liên quan đến tin nhắn

**Các Method Chính:**

```java
@RestController
@RequestMapping("/api/v1/chat")
public class ChatController {
    
    // 1. Lấy lịch sử tin nhắn với phân trang
    @GetMapping("/history/{conversationId}")
    public ResponseEntity<List<MessageEntity>> getHistory(
            @PathVariable String conversationId,
            @RequestParam(required = false) Long before,  // timestamp để pagination
            @RequestParam(defaultValue = "20") int limit) {
        // Lấy tin nhắn trước timestamp 'before', giới hạn 'limit' kết quả
    }
    
    // 2. Lấy danh sách hội thoại gần đây của user
    @GetMapping("/conversations/{userId}")
    public ResponseEntity<List<ConversationSummaryDto>> getRecentConversations(
            @PathVariable String userId) {
        // Trả về các cuộc hội thoại gần nhất cùng last message
    }
    
    // 3. Đánh dấu tin nhắn đã đọc
    @GetMapping("/history/{conversationId}/read")
    public ResponseEntity<Void> markAsRead(
            @PathVariable String conversationId,
            @RequestParam String userId) {
        // Update is_read = true cho tất cả tin nhắn của user
    }
    
    // 4. Thêm/bỏ emoji reaction
    @PutMapping("/messages/{messageId}/react")
    public ResponseEntity<MessageEntity> toggleReaction(
            @PathVariable String messageId,
            @RequestParam String userId,
            @RequestParam String emoji) {  // "❤️", "😂", etc
        // Thêm user vào array emoji, hoặc xóa nếu đã có
        // Broadcast sự kiện đến participants
    }
}
```

---

##### b) `ConversationController`
**Vị trí:** `backend/chat-service/src/main/java/com/iuhconnect/chatservice/controller/ConversationController.java`

**Chức năng:** CRUD phòng chat, quản lý members

**Các Method Chính:**

```java
@RestController
@RequestMapping("/api/v1/chat/conversations")
public class ConversationController {
    
    // 1. Tạo nhóm chat mới
    @PostMapping("/group")
    public ResponseEntity<ConversationEntity> createGroup(
            @RequestBody CreateGroupRequest request) {
        // {name, members: ["user1", "user2"]}
    }
    
    // 2. Lấy tất cả phòng chat của user
    @GetMapping("/user/{userId}")
    public ResponseEntity<List<ConversationEntity>> getUserConversations(
            @PathVariable String userId) {
    }
    
    // 3. Lấy thông tin chi tiết nhóm
    @GetMapping("/group/{conversationId}")
    public ResponseEntity<ConversationEntity> getConversation(
            @PathVariable String conversationId) {
    }
    
    // 4. Đổi tên nhóm (chỉ ADMIN)
    @PutMapping("/group/{conversationId}/name")
    public ResponseEntity<ConversationEntity> updateGroupName(
            @PathVariable String conversationId,
            @RequestParam String requesterId,
            @RequestParam String newName) {
    }
    
    // 5. Thêm members vào nhóm
    @PostMapping("/group/{conversationId}/members")
    public ResponseEntity<ConversationEntity> addMembers(
            @PathVariable String conversationId,
            @RequestParam String requesterId,
            @RequestBody List<String> newMemberIds) {
    }
    
    // 6. Xóa member khỏi nhóm
    @DeleteMapping("/group/{conversationId}/members/{targetUserId}")
    public ResponseEntity<ConversationEntity> removeMember(
            @PathVariable String conversationId,
            @PathVariable String targetUserId,
            @RequestParam String requesterId) {
    }
    
    // 7. Gán quyền ADMIN/MEMBER
    @PutMapping("/group/{conversationId}/members/{targetUserId}/role")
    public ResponseEntity<ConversationEntity> assignRole(
            @PathVariable String conversationId,
            @PathVariable String targetUserId,
            @RequestParam String requesterId,
            @RequestParam com.iuhconnect.chatservice.model.GroupRole newRole) {
    }
    
    // 8. Rời nhóm + chuyển quyền ADMIN cho người khác
    @PostMapping("/group/{conversationId}/leave-transfer")
    public ResponseEntity<ConversationEntity> leaveAndTransfer(
            @PathVariable String conversationId,
            @RequestParam String requesterId,
            @RequestParam String successorId) {
    }
}
```

---

##### c) `MeetingController`
**Vị trí:** `backend/chat-service/src/main/java/com/iuhconnect/chatservice/controller/MeetingController.java`

**Chức năng:** Quản lý video call / meeting

**Các Method Chính:**

```java
@RestController
@RequestMapping("/api/v1/meetings")
public class MeetingController {
    
    // 1. Tạo handoff token (mobile gửi cho desktop)
    @PostMapping("/{meetingId}/handoff-token")
    public ResponseEntity<HandoffTokenResponse> createHandoffToken(
            @PathVariable String meetingId,
            HttpServletRequest request) {
        // Returns: {token, meetingUrl: "/meeting/join?token=..."}
        // TTL: 5 phút
    }
    
    // 2. Xác minh handoff token + lấy meeting info
    @GetMapping("/handoff-token/{token}")
    public ResponseEntity<MeetingJoinInfoResponse> resolveHandoffToken(
            @PathVariable String token) {
        // Returns: {meetingId, roomName, jitsiUrl}
    }
    
    // 3. Desktop thông báo đã join meeting
    @PostMapping("/{meetingId}/device-joined")
    public ResponseEntity<Void> notifyDeviceJoined(
            @PathVariable String meetingId) {
        // Broadcast event để mobile biết desktop đã join
    }
}
```

---

##### d) `FileUploadController`
**Vị trí:** `backend/chat-service/src/main/java/com/iuhconnect/chatservice/controller/FileUploadController.java`

**Chức năng:** Upload file qua MinIO

**Các Method Chính:**

```java
@RestController
@RequestMapping("/api/v1/files")
public class FileUploadController {
    
    // Lấy presigned URL để client upload trực tiếp
    @GetMapping("/upload-presigned")
    public ResponseEntity<Map<String, String>> getPresignedUploadUrl(
            @RequestParam String fileName,
            @RequestParam String mimeType) {
        // Returns: {
        //   presignedUrl: "https://minio.../bucket/file.jpg?...",
        //   objectKey: "bucket/file.jpg",
        //   downloadUrl: "https://minio.../file.jpg"
        // }
    }
    
    @PostConstruct
    public void initBucket() {
        // Tạo bucket trên MinIO nếu chưa có
        // Set public read policy
    }
}
```

---

#### 2. **WebSocket Handlers**

##### a) `ChatWebSocketHandler`
**Vị trí:** `backend/chat-service/src/main/java/com/iuhconnect/chatservice/handler/ChatWebSocketHandler.java`

**Chức năng:** Xử lý real-time messaging qua WebSocket

**Các Method Chính:**

```java
@Component
public class ChatWebSocketHandler extends TextWebSocketHandler {
    
    private static final String TOPIC = "chat-messages";
    
    // 1. Khi client kết nối
    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        String username = (String) session.getAttributes().get("username");
        sessionManager.registerSession(username, session);  // Lưu vào memory
        presenceService.userConnected(username);            // Mark online trên Redis
        log.info("🔗 WebSocket connected [username={}]", username);
    }
    
    // 2. Xử lý tin nhắn từ client
    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) {
        // Parse JSON to check message type
        String type = jsonNode.get("type").asText();
        
        switch(type) {
            case "PING":
                // Heartbeat - refresh presence TTL
                presenceService.refreshHeartbeat(username);
                session.sendMessage(new TextMessage("{\"type\":\"PONG\"}"));
                
            case "CALL_SIGNAL":
                // WebRTC/Meeting call signal
                CallSignalDto signal = objectMapper.treeToValue(jsonNode, CallSignalDto.class);
                callSignalService.handleSignal(signal);
                
            case "WEBRTC":
                // Legacy WebRTC signaling
                // Forward to receiver nếu online, hoặc pub to Redis
                
            case "READ_RECEIPT":
                // Forward read receipt trực tiếp đến receiver
                
            default:  // CHAT message
                // Produce to Kafka topic "chat-messages"
                kafkaTemplate.send(TOPIC, message.getConversationId(), chatMessage);
        }
    }
    
    // 3. Khi client disconnect
    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        String username = (String) session.getAttributes().get("username");
        sessionManager.removeSession(username);  // Xóa khỏi memory
        presenceService.userDisconnected(username);  // Mark offline
        log.info("🔌 WebSocket disconnected [username={}]", username);
    }
}
```

---

##### b) `WebSocketSessionManager`

**Chức năng:** Quản lý map username → WebSocketSession

```java
@Component
public class WebSocketSessionManager {
    
    // Thread-safe map: username → WebSocketSession
    private final ConcurrentHashMap<String, WebSocketSession> sessions = new ConcurrentHashMap<>();
    
    // 1. Đăng ký session khi user connect
    public void registerSession(String username, WebSocketSession session) {
        sessions.put(username, session);
        log.info("Session registered for user: {}", username);
    }
    
    // 2. Lấy session của user (để send message)
    public WebSocketSession getSession(String username) {
        return sessions.get(username);
    }
    
    // 3. Xóa session khi user disconnect
    public void removeSession(String username) {
        sessions.remove(username);
    }
    
    // 4. Broadcast message đến multiple users
    public void broadcastMessage(List<String> usernames, String messageJson) {
        for (String username : usernames) {
            WebSocketSession session = sessions.get(username);
            if (session != null && session.isOpen()) {
                try {
                    session.sendMessage(new TextMessage(messageJson));
                } catch (IOException e) {
                    log.error("Failed to send message to {}", username, e);
                }
            }
        }
    }
}
```

---

##### c) `PresenceWebSocketHandler` (trong Presence Service)

```java
@Component
public class PresenceWebSocketHandler extends TextWebSocketHandler {
    
    private final ConcurrentHashMap<String, WebSocketSession> sessions = new ConcurrentHashMap<>();
    
    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        String username = (String) session.getAttributes().get("username");
        sessions.put(username, session);
        presenceService.setOnline(username);  // Mark online on Redis
        
        // Send acknowledgment
        session.sendMessage(new TextMessage("{\"type\":\"CONNECTED\",\"status\":\"ONLINE\"}"));
    }
    
    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) {
        String username = (String) session.getAttributes().get("username");
        String payload = message.getPayload();
        
        if ("PING".equalsIgnoreCase(payload)) {
            // Refresh TTL
            presenceService.refreshHeartbeat(username);
            session.sendMessage(new TextMessage("{\"type\":\"PONG\"}"));
        }
    }
    
    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        String username = (String) session.getAttributes().get("username");
        sessions.remove(username);
        presenceService.setOffline(username);  // Mark offline
    }
}
```

---

#### 3. **Services**

##### a) `MessageService`

```java
@Service
@RequiredArgsConstructor
public class MessageService {
    
    private final MessageRepository messageRepository;
    
    // 1. Lấy lịch sử tin nhắn (pagination)
    public List<MessageEntity> getHistory(String conversationId, Long before, int limit) {
        Pageable pageable = PageRequest.of(0, limit);
        if (before != null && before > 0) {
            // Lấy tin nhắn TRƯỚC timestamp 'before'
            return messageRepository.findByConversationIdAndTimestampLessThanOrderByTimestampDesc(
                conversationId, before, pageable);
        } else {
            // Lấy tin nhắn mới nhất
            return messageRepository.findByConversationIdOrderByTimestampDesc(
                conversationId, pageable);
        }
    }
    
    // 2. Lấy danh sách hội thoại gần đây
    public List<ConversationSummaryDto> getRecentConversations(String username) {
        return messageRepository.findRecentConversationsForUser(username);
    }
    
    // 3. Đánh dấu tin nhắn đã đọc
    public void markAsRead(String conversationId, String userId) {
        List<MessageEntity> unreadMessages = messageRepository
            .findByConversationIdOrderByTimestampDesc(conversationId, Pageable.unpaged())
            .stream()
            .filter(msg -> !msg.isRead() && userId.equals(msg.getReceiverId()))
            .toList();
        
        for (MessageEntity msg : unreadMessages) {
            msg.setRead(true);
        }
        messageRepository.saveAll(unreadMessages);
    }
    
    // 4. Toggle reaction emoji
    public MessageEntity toggleReaction(String messageId, String userId, String emoji) {
        MessageEntity msg = messageRepository.findById(messageId)
            .orElseThrow(() -> new RuntimeException("Message not found"));
        
        Map<String, List<String>> reactions = msg.getReactions();
        if (reactions == null) {
            reactions = new HashMap<>();
        }
        
        List<String> users = reactions.getOrDefault(emoji, new ArrayList<>());
        if (users.contains(userId)) {
            users.remove(userId);  // Bỏ reaction
            if (users.isEmpty()) {
                reactions.remove(emoji);  // Xóa emoji nếu không ai reaction
            }
        } else {
            users.add(userId);  // Thêm reaction
            reactions.put(emoji, users);
        }
        
        msg.setReactions(reactions);
        return messageRepository.save(msg);
    }
}
```

---

##### b) `ConversationService`

```java
@Service
@RequiredArgsConstructor
public class ConversationService {
    
    private final ConversationRepository conversationRepository;
    private final MessageRepository messageRepository;
    
    // 1. Tạo nhóm chat
    public ConversationEntity createGroup(CreateGroupRequest request) {
        ConversationEntity conv = ConversationEntity.builder()
            .name(request.getName())
            .type(ConversationType.GROUP)
            .creatorId(request.getCreatorId())
            .members(request.getMembers().stream()
                .map(memberId -> new GroupMember(memberId, GroupRole.MEMBER, System.currentTimeMillis()))
                .toList())
            .createdAt(System.currentTimeMillis())
            .updatedAt(System.currentTimeMillis())
            .build();
        
        return conversationRepository.save(conv);
    }
    
    // 2. Lấy tất cả conversation của user
    public List<ConversationEntity> getUserConversations(String userId) {
        return conversationRepository.findByMembersUserId(userId);
    }
    
    // 3. Thêm members vào nhóm
    public ConversationEntity addMembers(String conversationId, String requesterId, 
                                        List<String> newMemberIds) {
        ConversationEntity conv = conversationRepository.findById(conversationId)
            .orElseThrow(() -> new RuntimeException("Conversation not found"));
        
        // Check requesterId is ADMIN
        GroupMember requester = conv.getMembers().stream()
            .filter(m -> m.getUserId().equals(requesterId))
            .findFirst()
            .orElseThrow(() -> new RuntimeException("You are not a member"));
        
        if (requester.getRole() != GroupRole.ADMIN) {
            throw new RuntimeException("Only admin can add members");
        }
        
        // Add new members
        for (String newMemberId : newMemberIds) {
            if (conv.getMembers().stream().noneMatch(m -> m.getUserId().equals(newMemberId))) {
                conv.getMembers().add(
                    new GroupMember(newMemberId, GroupRole.MEMBER, System.currentTimeMillis())
                );
            }
        }
        
        conv.setUpdatedAt(System.currentTimeMillis());
        return conversationRepository.save(conv);
    }
    
    // 4. Xóa member
    public ConversationEntity removeMember(String conversationId, String requesterId, 
                                          String targetUserId) {
        // Check requesterId is ADMIN
        // Remove member from list
        // Save
    }
    
    // 5. Gán role ADMIN cho member
    public ConversationEntity assignRole(String conversationId, String requesterId, 
                                        String targetUserId, GroupRole newRole) {
        // Check requesterId is ADMIN
        // Update target member role
        // Save
    }
}
```

---

##### c) `PresenceService` (Redis-backed)

```java
@Service
public class PresenceService {
    
    private static final String PRESENCE_KEY_PREFIX = "presence:";
    private static final String LAST_SEEN_KEY_PREFIX = "lastseen:";
    private static final long HEARTBEAT_TTL_SECONDS = 90;
    
    private final StringRedisTemplate redisTemplate;
    private final KafkaTemplate<String, Object> kafkaTemplate;
    
    // 1. Mark user online
    public void setOnline(String userId) {
        String key = PRESENCE_KEY_PREFIX + userId;
        long now = System.currentTimeMillis();
        
        redisTemplate.opsForValue().set(key, "ONLINE", HEARTBEAT_TTL_SECONDS, TimeUnit.SECONDS);
        redisTemplate.opsForValue().set(LAST_SEEN_KEY_PREFIX + userId, String.valueOf(now));
        
        // Publish Kafka event
        publishEvent(userId, "ONLINE", now);
    }
    
    // 2. Mark user offline
    public void setOffline(String userId) {
        String key = PRESENCE_KEY_PREFIX + userId;
        long now = System.currentTimeMillis();
        
        redisTemplate.delete(key);
        redisTemplate.opsForValue().set(LAST_SEEN_KEY_PREFIX + userId, String.valueOf(now));
        
        // Publish Kafka event
        publishEvent(userId, "OFFLINE", now);
    }
    
    // 3. Refresh heartbeat (keep user online)
    public void refreshHeartbeat(String userId) {
        String key = PRESENCE_KEY_PREFIX + userId;
        Boolean exists = redisTemplate.hasKey(key);
        
        if (Boolean.TRUE.equals(exists)) {
            redisTemplate.expire(key, HEARTBEAT_TTL_SECONDS, TimeUnit.SECONDS);
        } else {
            setOnline(userId);  // Reconnect
        }
    }
    
    // 4. Check if user online
    public boolean isOnline(String userId) {
        return Boolean.TRUE.equals(redisTemplate.hasKey(PRESENCE_KEY_PREFIX + userId));
    }
    
    // 5. Get presence info
    public PresenceInfo getPresence(String userId) {
        boolean online = isOnline(userId);
        long lastSeen = getLastSeen(userId);
        
        return PresenceInfo.builder()
            .userId(userId)
            .status(online ? "ONLINE" : "OFFLINE")
            .lastSeen(lastSeen)
            .build();
    }
    
    private void publishEvent(String userId, String status, long timestamp) {
        PresenceEventDto event = PresenceEventDto.builder()
            .userId(userId)
            .status(status)
            .timestamp(timestamp)
            .build();
        
        kafkaTemplate.send("presence-events", userId, event);
    }
}
```

---

##### d) `CallSignalService`

```java
@Service
@RequiredArgsConstructor
public class CallSignalService {
    
    private final WebSocketSessionManager sessionManager;
    private final StringRedisTemplate redisTemplate;
    
    public void handleSignal(CallSignalDto signal) {
        String receiverId = signal.getReceiverId();
        String signalType = signal.getSignalType();  // offer, answer, candidate, etc
        
        // Try local instance first
        WebSocketSession receiverSession = sessionManager.getSession(receiverId);
        if (receiverSession != null && receiverSession.isOpen()) {
            try {
                String message = objectMapper.writeValueAsString(signal);
                receiverSession.sendMessage(new TextMessage(message));
                log.info("📡 Sent {} to {} (local)", signalType, receiverId);
            } catch (IOException e) {
                log.error("Failed to send signal", e);
            }
        } else {
            // Forward to other instances via Redis pub/sub
            String targetInstance = getReceiverInstanceId(receiverId);
            if (targetInstance != null) {
                redisTemplate.convertAndSend("signaling:" + targetInstance,
                    objectMapper.writeValueAsString(signal));
                log.info("📡 Published {} for {} to instance {}", signalType, receiverId, targetInstance);
            } else {
                log.warn("⚠️ Receiver {} not found", receiverId);
            }
        }
    }
}
```

---

##### e) `MeetingSessionService`

```java
@Service
public class MeetingSessionService {
    
    private final StringRedisTemplate redisTemplate;
    private static final String HANDOFF_TOKEN_PREFIX = "handoff_token:";
    private static final long HANDOFF_TOKEN_TTL_MINUTES = 5;
    
    // 1. Create handoff token
    public String createHandoffToken(String meetingId, String userId) {
        // Generate JWT token
        String token = Jwts.builder()
            .setSubject(userId)
            .claim("meetingId", meetingId)
            .setIssuedAt(new Date())
            .setExpiration(new Date(System.currentTimeMillis() + HANDOFF_TOKEN_TTL_MINUTES * 60 * 1000))
            .signWith(key, SignatureAlgorithm.HS256)
            .compact();
        
        // Store in Redis for verification
        redisTemplate.opsForValue().set(
            HANDOFF_TOKEN_PREFIX + token,
            meetingId,
            HANDOFF_TOKEN_TTL_MINUTES,
            TimeUnit.MINUTES
        );
        
        return token;
    }
    
    // 2. Resolve handoff token
    public MeetingJoinInfoResponse resolveHandoffToken(String token) {
        String meetingId = redisTemplate.opsForValue().get(HANDOFF_TOKEN_PREFIX + token);
        
        if (meetingId == null) {
            throw new RuntimeException("Invalid or expired token");
        }
        
        // Delete token (one-time use)
        redisTemplate.delete(HANDOFF_TOKEN_PREFIX + token);
        
        // Get meeting info
        String roomName = "room_" + meetingId;
        String jitsiUrl = "https://meet.ffmuc.net/" + roomName;
        
        return MeetingJoinInfoResponse.builder()
            .meetingId(meetingId)
            .roomName(roomName)
            .jitsiUrl(jitsiUrl)
            .build();
    }
}
```

---

#### 4. **Repositories (MongoDB)**

```java
// MessageRepository - Spring Data MongoDB
public interface MessageRepository extends MongoRepository<MessageEntity, String> {
    
    // Find by conversation + timestamp ordering
    List<MessageEntity> findByConversationIdOrderByTimestampDesc(
        String conversationId, Pageable pageable);
    
    // Find before timestamp (for pagination)
    List<MessageEntity> findByConversationIdAndTimestampLessThanOrderByTimestampDesc(
        String conversationId, Long timestamp, Pageable pageable);
    
    // Custom query - find recent conversations
    @Query("""
        {
            "conversation_id": {"$in": ?0},
            "timestamp": {"$gt": ?1}
        }
        """)
    List<ConversationSummaryDto> findRecentConversationsForUser(String username);
}

// ConversationRepository
public interface ConversationRepository extends MongoRepository<ConversationEntity, String> {
    
    @Query("{'members': {'$elemMatch': {'user_id': ?0}}}")
    List<ConversationEntity> findByMembersUserId(String userId);
}
```

---

#### 5. **Kafka Producers & Consumers**

##### a) `ChatMessageKafkaConsumer`

```java
@Component
public class ChatMessageKafkaConsumer {
    
    private static final Logger log = LoggerFactory.getLogger(ChatMessageKafkaConsumer.class);
    
    private final MessageRepository messageRepository;
    private final WebSocketSessionManager webSocketSessionManager;
    private final ObjectMapper objectMapper;
    
    // Topic: "chat-messages"
    @KafkaListener(
        topics = "chat-messages",
        groupId = "#{T(java.util.UUID).randomUUID().toString()}"  // Dynamic group ID
    )
    public void consumeChatMessage(ChatMessageDto message) {
        log.info("📨 Received message from Kafka: from={}, to={}, conv={}",
            message.getSenderId(), message.getReceiverId(), message.getConversationId());
        
        try {
            // 1. Save to MongoDB
            MessageEntity entity = MessageEntity.builder()
                .senderId(message.getSenderId())
                .receiverId(message.getReceiverId())
                .content(message.getContent())
                .conversationId(message.getConversationId())
                .timestamp(message.getTimestamp())
                .messageType(message.getMessageType() != null ? message.getMessageType() : "TEXT")
                .mediaUrl(message.getMediaUrl())
                .thumbnailUrl(message.getThumbnailUrl())
                .fileName(message.getFileName())
                .fileSize(message.getFileSize())
                .mimeType(message.getMimeType())
                .replyToId(message.getReplyToId())
                .replyToText(message.getReplyToText())
                .replyToSender(message.getReplyToSender())
                .build();
            
            entity = messageRepository.save(entity);
            message.setId(entity.getId());
            log.info("💾 Message saved to MongoDB [id={}]", entity.getId());
            
            // 2. Deliver to receiver via WebSocket
            WebSocketSession receiverSession = webSocketSessionManager.getSession(message.getReceiverId());
            if (receiverSession != null && receiverSession.isOpen()) {
                receiverSession.sendMessage(new TextMessage(objectMapper.writeValueAsString(message)));
                log.info("📤 Delivered to receiver [{}]", message.getReceiverId());
            } else {
                log.warn("⚠️ Receiver {} is offline", message.getReceiverId());
            }
            
        } catch (Exception e) {
            log.error("❌ Failed to process message", e);
        }
    }
}
```

---

#### 6. **DTOs (Data Transfer Objects)**

```java
// ChatMessageDto
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class ChatMessageDto {
    private String id;
    private String senderId;
    private String receiverId;
    private String content;
    private String conversationId;
    private long timestamp;
    
    @Builder.Default
    private String messageType = "TEXT";  // TEXT, IMAGE, VIDEO, FILE
    
    private String mediaUrl;
    private String thumbnailUrl;
    private String fileName;
    private long fileSize;
    private String mimeType;
    
    private String replyToId;
    private String replyToText;
    private String replyToSender;
}

// CallSignalDto
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class CallSignalDto {
    private String type;           // "CALL_SIGNAL"
    private String signalType;     // offer, answer, candidate
    private String meetingId;
    private String roomName;
    private String conversationId;
    private String senderId;       // Set by backend from JWT
    private String senderName;
    private String receiverId;
    private long timestamp;
}
```

---

## Mục 3.3: Thiết Kế Giao Diện Lập Trình - API Specification

### I. REST API Endpoints (HTTP)

#### **Auth Service**

| Method | Endpoint | Mô Tả | Request Body | Response |
|--------|----------|-------|--------------|----------|
| `POST` | `/api/v1/auth/login` | Đăng nhập | `{username, password}` | `{accessToken, refreshToken, tokenType}` |
| `POST` | `/api/v1/auth/register` | Đăng ký | `{username, password, fullName, email, role}` | `{accessToken, refreshToken, tokenType}` |
| `GET` | `/api/v1/users/me` | Lấy profile | - | `UserDto` |
| `PUT` | `/api/v1/users/me` | Cập nhật profile | `UpdateUserRequest` | `UserDto` |
| `POST` | `/api/v1/users/fcm-token` | Update FCM token | `{fcmToken}` | - |

**Chi tiết Endpoint Login:**
```bash
POST /api/v1/auth/login HTTP/1.1
Content-Type: application/json

{
  "username": "hiep123",
  "password": "password123"
}

# Response 200 OK
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "tokenType": "Bearer"
}
```

---

#### **Chat Service**

| Method | Endpoint | Mô Tả | Query/Path Params | Response |
|--------|----------|-------|------|----------|
| `GET` | `/api/v1/chat/history/{conversationId}` | Lịch sử tin nhắn | `before={ts}, limit={n}` | `List<MessageEntity>` |
| `GET` | `/api/v1/chat/conversations/{userId}` | Danh sách hội thoại | - | `List<ConversationSummaryDto>` |
| `GET` | `/api/v1/chat/history/{conversationId}/read` | Đánh dấu đã đọc | `userId={id}` | `200 OK` |
| `PUT` | `/api/v1/chat/messages/{messageId}/react` | Thêm/bỏ reaction | `userId={id}, emoji={e}` | `MessageEntity` |

**Chi tiết Endpoint Lấy Lịch Sử:**
```bash
GET /api/v1/chat/history/conv_hiep_nam?limit=20 HTTP/1.1
Authorization: Bearer <token>

# Response 200 OK
[
  {
    "id": "607f1f77bcf86cd799439011",
    "senderId": "hiep123",
    "receiverId": "nam456",
    "content": "Chào bạn!",
    "conversationId": "conv_hiep_nam",
    "timestamp": 1684235400000,
    "messageType": "TEXT",
    "isRead": true
  },
  ...
]

# Pagination với before:
GET /api/v1/chat/history/conv_hiep_nam?limit=20&before=1684235400000
# Trả về 20 tin nhắn trước timestamp 1684235400000
```

---

#### **Conversation Management**

| Method | Endpoint | Mô Tả | Request Body |
|--------|----------|-------|--------------|
| `POST` | `/api/v1/chat/conversations/group` | Tạo nhóm | `{name, members}` |
| `GET` | `/api/v1/chat/conversations/user/{userId}` | Lấy tất cả phòng | - |
| `GET` | `/api/v1/chat/conversations/group/{conversationId}` | Lấy chi tiết nhóm | - |
| `PUT` | `/api/v1/chat/conversations/group/{conversationId}/name` | Đổi tên nhóm | `newName={name}` |
| `POST` | `/api/v1/chat/conversations/group/{conversationId}/members` | Thêm members | `[userId1, userId2, ...]` |
| `DELETE` | `/api/v1/chat/conversations/group/{conversationId}/members/{userId}` | Xóa member | - |
| `PUT` | `/api/v1/chat/conversations/group/{conversationId}/members/{userId}/role` | Gán role | `newRole={ADMIN\|MEMBER}` |
| `POST` | `/api/v1/chat/conversations/group/{conversationId}/leave-transfer` | Rời nhóm | `successorId={id}` |

**Chi tiết Endpoint Tạo Nhóm:**
```bash
POST /api/v1/chat/conversations/group HTTP/1.1
Content-Type: application/json
Authorization: Bearer <token>

{
  "name": "Nhóm Lập Trình Java",
  "members": ["hiep123", "nam456", "linh789"]
}

# Response 200 OK
{
  "id": "607f1f77bcf86cd799439012",
  "name": "Nhóm Lập Trình Java",
  "type": "GROUP",
  "creatorId": "hiep123",
  "members": [
    {
      "user_id": "hiep123",
      "role": "ADMIN",
      "joined_at": 1684235400000
    },
    {
      "user_id": "nam456",
      "role": "MEMBER",
      "joined_at": 1684235500000
    }
  ],
  "created_at": 1684235400000,
  "updated_at": 1684235400000
}
```

---

#### **Meeting Service**

| Method | Endpoint | Mô Tả | Response |
|--------|----------|-------|----------|
| `POST` | `/api/v1/meetings/{meetingId}/handoff-token` | Tạo handoff token | `{token, meetingUrl}` |
| `GET` | `/api/v1/meetings/handoff-token/{token}` | Xác minh token | `{meetingId, roomName, jitsiUrl}` |

**Chi tiết Endpoint Handoff Token:**
```bash
# Mobile gọi để tạo token khi click "Mở trên máy tính"
POST /api/v1/meetings/meet_123/handoff-token HTTP/1.1
Authorization: Bearer <token>

# Response 200 OK
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "meetingUrl": "/meeting/join?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}

# Desktop gọi để join
GET /api/v1/meetings/handoff-token/eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... HTTP/1.1

# Response 200 OK
{
  "meetingId": "meet_123",
  "roomName": "room_meet_123",
  "jitsiUrl": "https://meet.ffmuc.net/room_meet_123"
}
```

---

#### **Presence Service**

| Method | Endpoint | Mô Tả | Response |
|--------|----------|-------|----------|
| `GET` | `/api/v1/presence/{userId}` | Lấy trạng thái user | `{userId, status, lastSeen}` |
| `POST` | `/api/v1/presence/bulk` | Lấy trạng thái nhiều users | `{userId: PresenceInfo, ...}` |
| `GET` | `/api/v1/presence/health` | Health check | `{service, status}` |

**Chi tiết:**
```bash
GET /api/v1/presence/hiep123 HTTP/1.1

# Response 200 OK
{
  "userId": "hiep123",
  "status": "ONLINE",
  "lastSeen": 1684235500000
}

# Bulk query
POST /api/v1/presence/bulk HTTP/1.1
Content-Type: application/json

["hiep123", "nam456", "linh789"]

# Response 200 OK
{
  "hiep123": {
    "userId": "hiep123",
    "status": "ONLINE",
    "lastSeen": 1684235500000
  },
  "nam456": {
    "userId": "nam456",
    "status": "OFFLINE",
    "lastSeen": 1684234000000
  },
  "linh789": {
    "userId": "linh789",
    "status": "ONLINE",
    "lastSeen": 1684235400000
  }
}
```

---

#### **Contact/Friendship Service**

| Method | Endpoint | Mô Tả | Query Params |
|--------|----------|-------|--------------|
| `POST` | `/api/v1/contacts/request` | Gửi lời mời kết bạn | `targetUsername` |
| `POST` | `/api/v1/contacts/accept` | Chấp nhận lời mời | `senderUsername` |
| `GET` | `/api/v1/contacts/pending` | Danh sách lời mời chờ | - |
| `GET` | `/api/v1/contacts/list` | Danh sách bạn bè | - |

---

### II. WebSocket Events (Real-time Communication)

#### **Kết Nối:**
```
Endpoint: ws://api-gateway.iuhconnect.local:8000/ws/chat
Authentication: JWT token (query param hoặc header)

Handshake:
  1. Client gửi: GET /ws/chat?token=JWT
  2. Server validate JWT → extract username
  3. Connection established → mark user ONLINE
```

---

#### **Client → Server Events (Outbound)**

##### 1. **Chat Message**
```json
{
  "type": "CHAT",
  "senderId": "hiep123",
  "receiverId": "nam456",
  "conversationId": "conv_hiep_nam",
  "content": "Chào bạn!",
  "timestamp": 1684235400000,
  "messageType": "TEXT",
  "mediaUrl": null,
  "replyToId": null
}
```

##### 2. **Presence Heartbeat (Ping)**
```json
{
  "type": "PING"
}
```

##### 3. **WebRTC Signaling (Legacy)**
```json
{
  "type": "WEBRTC",
  "signalType": "offer",
  "receiverId": "nam456",
  "senderUsername": "hiep123",
  "data": {
    "sdp": "v=0\r\no=- ...",
    "type": "offer"
  }
}
```

##### 4. **Call Signal (New Meeting Protocol)**
```json
{
  "type": "CALL_SIGNAL",
  "signalType": "call_init",
  "meetingId": "meet_123",
  "roomName": "room_meet_123",
  "conversationId": "conv_hiep_nam",
  "receiverId": "nam456",
  "senderName": "Hiệp",
  "timestamp": 1684235400000
}
```

Call Signal Types:
- `call_init`: Bắt đầu cuộc gọi
- `call_accept`: Chấp nhận cuộc gọi
- `call_reject`: Từ chối cuộc gọi
- `call_end`: Kết thúc cuộc gọi

##### 5. **Read Receipt**
```json
{
  "type": "READ_RECEIPT",
  "conversationId": "conv_hiep_nam",
  "receiverId": "nam456"
}
```

---

#### **Server → Client Events (Inbound)**

##### 1. **Chat Message Delivery**
```json
{
  "id": "607f1f77bcf86cd799439011",
  "senderId": "hiep123",
  "receiverId": "nam456",
  "content": "Chào bạn!",
  "conversationId": "conv_hiep_nam",
  "timestamp": 1684235400000,
  "messageType": "TEXT",
  "isRead": false
}
```

##### 2. **Pong Response**
```json
{
  "type": "PONG"
}
```

##### 3. **Presence Event** (từ Kafka pub/sub)
```json
{
  "userId": "nam456",
  "status": "ONLINE",
  "timestamp": 1684235400000
}
```

##### 4. **Reaction Event**
```json
{
  "type": "REACTION",
  "receiverId": "nam456",
  "actorUserId": "hiep123",
  "messageId": "607f1f77bcf86cd799439011",
  "conversationId": "conv_hiep_nam",
  "reactions": {
    "❤️": ["hiep123", "linh789"],
    "😂": ["nam456"]
  },
  "timestamp": 1684235400000
}
```

##### 5. **Call Signal Response**
```json
{
  "type": "CALL_SIGNAL",
  "signalType": "call_accept",
  "meetingId": "meet_123",
  "roomName": "room_meet_123",
  "senderId": "nam456",
  "senderName": "Nam",
  "receiverId": "hiep123",
  "timestamp": 1684235400000
}
```

---

#### **Presence Service WebSocket**

```
Endpoint: ws://presence-service.iuhconnect.local:8001/ws/presence
Authentication: JWT token

Flow:
  1. Client kết nối + JWT
  2. Server phản hồi:
     {"type":"CONNECTED","status":"ONLINE"}
  3. Client gửi PING mỗi 30s
  4. Server phản hồi PONG
  5. Khi disconnect → mark offline
```

---

### III. Message Flow Diagrams

#### **Diagram 1: Gửi Tin Nhắn**

```
Client A                        Chat Service                       MongoDB              Client B
  │                                 │                                 │                   │
  ├─ WebSocket Connect              │                                 │                   │
  │  + JWT                          │                                 │                   │
  │──────────────────────────────>  │                                 │                   │
  │                         registerSession                           │                   │
  │                                 │                                 │                   │
  ├─ Send CHAT message              │                                 │                   │
  │ {senderId, receiverId, ...}    │                                 │                   │
  │──────────────────────────────>  │                                 │                   │
  │                         Produce to Kafka                          │                   │
  │                                 │                                 │                   │
  │                          KafkaConsumer                            │                   │
  │                                 ├─ Save to MongoDB               │                   │
  │                                 │──────────────────────────────> │                   │
  │                                 │                                 │                   │
  │                          Lookup receiverId                        │                   │
  │                                 │                                 │                   │
  │                          Send via WebSocket                       │                   │
  │                                 ├─────────────────────────────────────────────────> │
  │                                 │                        Message delivery            │
```

---

#### **Diagram 2: Presence (Online/Offline)**

```
Client                   Chat WS              Presence WS          Redis              Kafka
  │                          │                     │                 │                 │
  ├─ Connect to /ws/chat    │                     │                 │                 │
  │─────────────────────────>│                     │                 │                 │
  │                    presenceService.userConnected()               │                 │
  │                          │                     ├─ SET presence:user "ONLINE" EX 90 │
  │                          │                     │─────────────────>│                 │
  │                          │                     │           publishEvent             │
  │                          │                     │────────────────────────────────────>│
  │                          │                     │                 │      ONLINE     │
  │                          │                     │                 │                 │
  ├─ PING every 30s          │                     │                 │                 │
  │─────────────────────────>│                     │                 │                 │
  │                    refreshHeartbeat()          │                 │                 │
  │                          │                     ├─ EXPIRE presence:user 90           │
  │                          │                     │─────────────────>│                 │
  │                          │                     │                 │                 │
  ├─ Disconnect              │                     │                 │                 │
  │────X                     │                     │                 │                 │
  │       presenceService.userDisconnected()       │                 │                 │
  │                          │                     ├─ DEL presence:user                 │
  │                          │                     │─────────────────>│                 │
  │                          │                     │            publishEvent            │
  │                          │                     │────────────────────────────────────>│
  │                          │                     │                 │       OFFLINE   │
```

---

## Tóm Tắt

### **Thiết Kế Dữ Liệu:**
- **MariaDB:** 2 bảng (users, friendships) - Quản lý người dùng & quan hệ bạn bè
- **MongoDB:** 2 collections (messages, conversations) - Lưu tin nhắn & phòng chat
- **Redis:** Key-Value cache - Trạng thái online/offline + signaling

### **Mức Lớp:**
- **Controllers:** 4 classes (ChatController, ConversationController, MeetingController, FileUploadController)
- **WebSocket Handlers:** ChatWebSocketHandler + PresenceWebSocketHandler
- **Services:** 5 services (MessageService, ConversationService, PresenceService, CallSignalService, MeetingSessionService)
- **Kafka:** Consumer xử lý tin nhắn từ Kafka queue, Producer để publish events

### **API Endpoints:**
- **REST:** 20+ endpoints cho CRUD operations
- **WebSocket:** 5 event types (CHAT, PING/PONG, CALL_SIGNAL, WEBRTC, READ_RECEIPT)
- **Pub/Sub:** Presence events qua Kafka

