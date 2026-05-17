# Chat Media Messages + Presence Service

Triển khai 2 tính năng chính được giao:
1. **Chat gửi hình ảnh, tệp, video, sticker** qua cơ chế presigned URL (MinIO)
2. **Presence-service hoàn chỉnh** — quản lý trạng thái online/offline/last_seen

## Hiện trạng

### Chat media
- `FileUploadController` đã có endpoint `GET /api/v1/files/presigned-url` sinh presigned PUT URL cho MinIO bucket `chat-media`
- `ChatMessageDto` và `MessageEntity` hiện chỉ có field `content` (text) — **chưa hỗ trợ media type**
- Frontend `ChatScreen` có menu attach (Ảnh, Tài liệu, Camera...) nhưng **chưa có logic xử lý thật**
- MinIO bucket `chat-media` đã cấu hình trong `application.yml`

### Presence
- `presence-service` chỉ có `PresenceServiceApplication.java` (scaffold trống)
- Presence logic thật đang nằm trong `chat-service/PresenceService.java` (chỉ lưu instanceId vào Redis)
- Frontend hardcode `isOnline: false` trong `ChatListScreen` — chưa gọi API presence

---

## Proposed Changes

### Phần 1: Chat Media Messages (Backend)

#### [MODIFY] [ChatMessageDto.java](file:///d:/KienTrucDuAn/IUH_CONNECT/backend/chat-service/src/main/java/com/iuhconnect/chatservice/dto/ChatMessageDto.java)
Thêm các field mới cho media:
```java
private String messageType;   // "TEXT", "IMAGE", "VIDEO", "FILE", "STICKER"
private String mediaUrl;      // URL file trên MinIO sau khi upload
private String thumbnailUrl;  // URL thumbnail (cho video/image)
private String fileName;      // Tên file gốc
private long fileSize;        // Kích thước (bytes)
private String mimeType;      // "image/png", "video/mp4", "application/pdf"...
```

#### [MODIFY] [MessageEntity.java](file:///d:/KienTrucDuAn/IUH_CONNECT/backend/chat-service/src/main/java/com/iuhconnect/chatservice/model/MessageEntity.java)
Thêm các field tương tự để lưu vào MongoDB:
```java
@Field("message_type") private String messageType;
@Field("media_url")    private String mediaUrl;
@Field("thumbnail_url") private String thumbnailUrl;
@Field("file_name")    private String fileName;
@Field("file_size")    private long fileSize;
@Field("mime_type")    private String mimeType;
```

#### [MODIFY] [ChatMessageKafkaConsumer.java](file:///d:/KienTrucDuAn/IUH_CONNECT/backend/chat-service/src/main/java/com/iuhconnect/chatservice/consumer/ChatMessageKafkaConsumer.java)
Cập nhật builder khi lưu MongoDB — map thêm các field media mới từ `ChatMessageDto` sang `MessageEntity`.

#### [MODIFY] [FileUploadController.java](file:///d:/KienTrucDuAn/IUH_CONNECT/backend/chat-service/src/main/java/com/iuhconnect/chatservice/controller/FileUploadController.java)
Cải thiện endpoint presigned URL:
- Trả JSON thay vì plain string: `{ presignedUrl, objectKey, downloadUrl }`
- Tự động tạo bucket `chat-media` nếu chưa tồn tại (startup)
- Thêm endpoint `GET /api/v1/files/download-url` để sinh presigned GET URL (cho phía xem file)
- Validate: giới hạn file size qua tên (optional), whitelist content types

#### [MODIFY] [ChatWebSocketHandler.java](file:///d:/KienTrucDuAn/IUH_CONNECT/backend/chat-service/src/main/java/com/iuhconnect/chatservice/handler/ChatWebSocketHandler.java)
Không cần thay đổi lớn — WebSocket handler đã gọi `objectMapper.treeToValue(jsonNode, ChatMessageDto.class)`, nên các field mới sẽ tự deserialize nếu client gửi lên.

---

### Phần 2: Chat Media Messages (Frontend)

#### [MODIFY] [ChatScreen.tsx](file:///d:/KienTrucDuAn/IUH_CONNECT/frontend/src/screens/ChatScreen.tsx)
Thay đổi chính:
- **Attach menu** → hook vào `react-native-image-picker` (Ảnh/Camera) và `react-native-document-picker` (Tài liệu)
- **Upload flow**: User chọn file → gọi `GET /api/v1/files/presigned-url` lấy presigned URL → `PUT` file lên MinIO → gửi WebSocket message với `messageType + mediaUrl`
- **Render media messages**: Custom `renderMessageImage`, `renderMessageVideo` trong GiftedChat
- **Sticker picker**: Grid emoji/sticker cơ bản (gửi dạng `messageType: "STICKER"`, `content` chứa sticker key)
- **Preview**: Xem ảnh fullscreen, mở file bằng `Linking.openURL`

#### [NEW] [mediaUploadService.ts](file:///d:/KienTrucDuAn/IUH_CONNECT/frontend/src/services/mediaUploadService.ts)
Service riêng xử lý flow upload:
```typescript
export async function uploadMedia(token, file): Promise<MediaUploadResult> {
  // 1. Gọi API lấy presigned URL
  // 2. PUT file lên MinIO qua presigned URL
  // 3. Trả về { mediaUrl, fileName, fileSize, mimeType }
}
```

#### [NEW] [StickerPicker.tsx](file:///d:/KienTrucDuAn/IUH_CONNECT/frontend/src/components/StickerPicker.tsx)
Component sticker grid đơn giản với các sticker categories.

---

### Phần 3: Presence-Service (Backend — viết hoàn chỉnh)

#### [MODIFY] [application.yml](file:///d:/KienTrucDuAn/IUH_CONNECT/backend/presence-service/src/main/resources/application.yml)
Thêm cấu hình Kafka consumer, JWT secret (để validate WebSocket token), và tuning Redis.

#### [NEW] `config/RedisConfig.java`
Cấu hình `StringRedisTemplate` bean.

#### [NEW] `config/KafkaConfig.java`
Cấu hình Kafka producer để publish presence events.

#### [NEW] `config/WebSocketConfig.java`
Đăng ký WebSocket endpoint `/ws/presence` cho heartbeat connections.

#### [NEW] `security/JwtHandshakeInterceptor.java`
Copy pattern từ chat-service — validate JWT token khi WebSocket handshake.

#### [NEW] `handler/PresenceWebSocketHandler.java`
WebSocket handler cho presence heartbeat:
- `afterConnectionEstablished` → user ONLINE, lưu Redis, publish Kafka event
- Nhận PING/heartbeat từ client mỗi 30s → refresh TTL trong Redis
- `afterConnectionClosed` → user OFFLINE, xoá Redis, publish Kafka event

#### [NEW] `service/PresenceService.java`
Core logic:
```java
void setOnline(String userId)       // Redis SET presence:{userId} → {status, lastSeen, instanceId}
void setOffline(String userId)      // Redis DEL, lưu lastSeen
boolean isOnline(String userId)     // Redis EXISTS
PresenceInfo getPresence(String userId) // Trả {status, lastSeen}
Map<String, PresenceInfo> getBulkPresence(List<String> userIds) // Bulk query cho list contacts
```
Redis key pattern: `presence:{userId}` → Hash `{status, lastSeen, instanceId}`

#### [NEW] `dto/PresenceEventDto.java`
```java
String userId;
String status;     // "ONLINE" | "OFFLINE"
long lastSeen;     // Unix timestamp
```

#### [NEW] `dto/PresenceInfo.java`
```java
String userId;
String status;
long lastSeen;
```

#### [NEW] `controller/PresenceController.java`
REST APIs:
```
GET  /api/v1/presence/{userId}          → PresenceInfo
POST /api/v1/presence/bulk              → Map<userId, PresenceInfo>  (body: list of userIds)
```

#### [NEW] `consumer/UserEventConsumer.java`
Listen `user-events` từ auth-service → khi user mới đăng ký, khởi tạo presence = OFFLINE.

---

### Phần 4: Tích hợp Presence vào Frontend

#### [MODIFY] [ChatListScreen.tsx](file:///d:/KienTrucDuAn/IUH_CONNECT/frontend/src/screens/ChatListScreen.tsx)
- Khi load danh sách conversations, gọi `POST /api/v1/presence/bulk` với list userIds → hiển thị chấm xanh/xám
- Thay thế `MOCK_ACTIVE_USERS` bằng danh sách thật từ contacts + presence

#### [MODIFY] [ChatScreen.tsx](file:///d:/KienTrucDuAn/IUH_CONNECT/frontend/src/screens/ChatScreen.tsx)
- Gọi `GET /api/v1/presence/{recipientId}` để hiển thị "Đang hoạt động" / "Hoạt động X phút trước" chính xác
- Subscribe presence changes qua WebSocket listener

#### [MODIFY] [WebSocketProvider.tsx](file:///d:/KienTrucDuAn/IUH_CONNECT/frontend/src/services/WebSocketProvider.tsx)
- Thêm **presence heartbeat**: gửi ping mỗi 30s tới `/ws/presence` (hoặc reuse `/ws/chat` nếu tiện)
- Có thể mở 1 WebSocket riêng cho presence hoặc tích hợp heartbeat qua chat WS

---

### Phần 5: Infrastructure / Docker

#### [MODIFY] [docker-compose.yml](file:///d:/KienTrucDuAn/IUH_CONNECT/docker-compose.yml)
- Thêm `JWT_SECRET` env cho `presence-service`
- Thêm Kafka consumer config cho presence-service

#### [MODIFY] [application.yml (api-gateway)](file:///d:/KienTrucDuAn/IUH_CONNECT/backend/api-gateway/src/main/resources/application.yml)
Thêm routes:
```yaml
# Presence Service (HTTP)
- id: presence-service-http
  uri: ${PRESENCE_SERVICE_URL:http://localhost:8083}
  predicates:
    - Path=/api/v1/presence/**

# Presence Service (WebSocket)
- id: presence-service-ws
  uri: ${PRESENCE_SERVICE_WS_URL:ws://localhost:8083}
  predicates:
    - Path=/ws/presence/**
```

Thêm env trong docker-compose gateway:
```yaml
PRESENCE_SERVICE_URL: http://presence-service:8083
PRESENCE_SERVICE_WS_URL: ws://presence-service:8083
```

---

## Open Questions

> [!IMPORTANT]
> **Presence WebSocket**: Nên mở WebSocket riêng cho presence (`/ws/presence` trên presence-service) hay tích hợp heartbeat vào WebSocket chat hiện tại (`/ws/chat`)? 
> - **Riêng**: Đúng kiến trúc microservice, presence-service hoàn toàn độc lập
> - **Chung**: Đơn giản hơn cho mobile (chỉ 1 kết nối WS), nhưng presence logic vẫn phụ thuộc chat-service
> 
> **Đề xuất**: Dùng WS riêng `/ws/presence` trên presence-service để đúng yêu cầu "viết hoàn chỉnh presence-service"

> [!NOTE]
> **Sticker**: Dùng bộ emoji Unicode sẵn có hay cần custom sticker pack (hình ảnh riêng)?
> **Đề xuất**: Giai đoạn 1 dùng emoji Unicode grid + một số sticker hình ảnh đơn giản (lưu dạng URL trên MinIO)

> [!NOTE]
> **Thư viện Image/Document Picker**: Cần install thêm `react-native-image-picker` và `react-native-document-picker` vào frontend. Có OK không?

---

## Verification Plan

### Automated Tests
```bash
# 1. Build backend services
docker-compose up --build -d

# 2. Test presigned URL flow
curl -H "Authorization: Bearer <token>" \
  "http://localhost:8080/api/v1/files/presigned-url?fileName=test.png&contentType=image/png"

# 3. Test presence API
curl "http://localhost:8080/api/v1/presence/testuser"
curl -X POST "http://localhost:8080/api/v1/presence/bulk" \
  -H "Content-Type: application/json" \
  -d '["testuser","testuser2"]'
```

### Manual Verification
- Mở app trên emulator → đăng nhập → vào chat → bấm đính kèm → chọn ảnh → upload thành công → hiển thị ảnh trong bubble chat
- Mở 2 emulator/2 user → user A online → user B xem danh sách chat → thấy chấm xanh "Đang hoạt động" bên cạnh user A
- User A tắt app → user B thấy chuyển sang "Offline" / "Hoạt động X phút trước"
