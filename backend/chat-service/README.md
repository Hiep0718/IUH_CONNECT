# 💬 Chat Service

## Service Description

**Chat Service** là engine nhắn tin thời gian thực của hệ thống IUH Connect. Service này chịu trách nhiệm:

- **WebSocket Server**: Nhận tin nhắn real-time từ client qua kết nối WebSocket (`/ws/chat`), xác thực JWT trong quá trình handshake.
- **Message Pipeline**: Tin nhắn từ WebSocket → Kafka → MongoDB (persist) → Redis Pub/Sub (broadcast) → WebSocket (delivery).
- **User Sync (CQRS Read Model)**: Consume sự kiện `user-events` từ Kafka để đồng bộ thông tin user từ Auth Service (MariaDB) sang MongoDB — đảm bảo Chat Service có dữ liệu user mà không cần gọi trực tiếp Auth Service.
- **Multi-Node Scalability**: Sử dụng Redis Pub/Sub để broadcast tin nhắn đến tất cả instances — mỗi node chỉ quản lý WebSocket sessions của riêng nó, Redis đảm bảo tin nhắn đến đúng node chứa receiver.

---

## Tech Stack & Libraries

| Library | Version | Mục đích |
|---------|---------|----------|
| **Spring Boot** | 3.2.0 | Framework chính |
| **Spring WebSocket** | — | WebSocket server (`TextWebSocketHandler`) |
| **Spring Data MongoDB** | — | ODM cho MongoDB |
| **Spring Data Redis** | — | Redis Pub/Sub + `StringRedisTemplate` |
| **Spring Kafka** | — | Kafka Producer & Consumer |
| **jjwt (io.jsonwebtoken)** | 0.12.3 | Validate JWT trong WebSocket handshake |
| **Lombok** | (managed) | Reduce boilerplate |
| **Jackson** | (managed) | JSON serialization/deserialization |
| **JDK** | 17 | Java version |

---

## Environment Variables

Các biến cấu hình trong `application.yml` — có thể override bằng environment variables:

| Variable | Default | Mô tả |
|----------|---------|-------|
| `SERVER_PORT` | `8082` | Port HTTP/WebSocket của service |
| `SPRING_DATA_MONGODB_URI` | `mongodb://iuh_admin:iuh_mongo_pass@mongodb:27017/iuh_connect_db?authSource=admin` | MongoDB connection URI |
| `SPRING_DATA_REDIS_HOST` | `redis` | Redis host |
| `SPRING_DATA_REDIS_PORT` | `6379` | Redis port |
| `SPRING_DATA_REDIS_PASSWORD` | `iuh_redis_pass` | Redis password |
| `SPRING_KAFKA_BOOTSTRAP_SERVERS` | `kafka:29092` | Kafka broker (nội bộ Docker) |
| `SPRING_KAFKA_CONSUMER_GROUP_ID` | `chat-service-group` | Kafka consumer group |
| `SPRING_KAFKA_CONSUMER_AUTO_OFFSET_RESET` | `earliest` | Đọc từ offset đầu tiên khi group mới |
| `JWT_SECRET` | `IUHConnectSuperSecretKey...` | HMAC-SHA secret (shared với Auth Service) |

> ⚠️ Khi chạy ngoài Docker: `mongodb` → `localhost`, `redis` → `localhost`, `kafka:29092` → `localhost:9092`.

---

## Database & Caching

### MongoDB — Database `iuh_connect_db`

#### Collection: `messages`

Lưu trữ toàn bộ tin nhắn chat. Có compound index trên `(conversation_id, timestamp DESC)` để query lịch sử chat hiệu quả.

| Field | Type | Mô tả |
|-------|------|-------|
| `_id` | `ObjectId` | MongoDB auto-generated ID |
| `sender_id` | `String` | Username người gửi |
| `receiver_id` | `String` | Username người nhận |
| `content` | `String` | Nội dung tin nhắn |
| `conversation_id` | `String` | ID cuộc hội thoại (dùng làm Kafka partition key) |
| `timestamp` | `Long` | Unix timestamp (milliseconds) |

**Index:** `conv_ts_idx` → `{ conversation_id: 1, timestamp: -1 }`

```java
@Document(collection = "messages")
@CompoundIndex(name = "conv_ts_idx", def = "{'conversation_id': 1, 'timestamp': -1}")
public class MessageEntity {
    @Id private String id;
    @Field("sender_id") private String senderId;
    @Field("receiver_id") private String receiverId;
    private String content;
    @Field("conversation_id") private String conversationId;
    private long timestamp;
}
```

---

#### Collection: `chat_users`

Bản sao user profile được đồng bộ từ Auth Service qua Kafka (CQRS Read Model).

| Field | Type | Index | Mô tả |
|-------|------|-------|-------|
| `_id` | `ObjectId` | Primary | MongoDB auto ID |
| `user_id` | `Long` | `UNIQUE` | ID từ MariaDB (Auth Service) |
| `username` | `String` | `UNIQUE` | Tên đăng nhập |
| `avatar_url` | `String` | — | URL ảnh đại diện |

```java
@Document(collection = "chat_users")
public class ChatUser {
    @Id private String id;
    @Indexed(unique = true) @Field("user_id") private Long userId;
    @Indexed(unique = true) private String username;
    @Field("avatar_url") private String avatarUrl;
}
```

**Repositories:**
- `MessageRepository` extends `MongoRepository<MessageEntity, String>`
- `ChatUserRepository` extends `MongoRepository<ChatUser, String>`
  - `Optional<ChatUser> findByUserId(Long userId)`

---

### Redis — Pub/Sub (Không dùng làm Cache)

Redis được sử dụng **chỉ cho Pub/Sub**, không làm cache:

| Channel | Publisher | Subscriber | Mục đích |
|---------|-----------|------------|----------|
| `chat-channel` | `ChatMessageKafkaConsumer` | `RedisMessageSubscriber` | Broadcast tin nhắn đến tất cả Chat Service nodes |

**Config** (`RedisConfig.java`):
- `ChannelTopic("chat-channel")` — topic cố định
- `RedisMessageListenerContainer` — subscribe `chat-channel`, delegate đến `RedisMessageSubscriber`
- Sử dụng `StringRedisTemplate.convertAndSend()` để publish JSON

---

## API Endpoints

Chat Service **không có REST API**. Toàn bộ giao tiếp qua **WebSocket**.

### WebSocket: `ws://host:8082/ws/chat?token=<JWT>`

| Protocol | Path | Auth | Mô tả |
|----------|------|------|-------|
| `WS` | `/ws/chat` | JWT qua query param `?token=xxx` | Kết nối WebSocket để gửi/nhận tin nhắn |

#### Handshake Flow

```
Client → GET /ws/chat?token=eyJhbG...
  ↓
JwtHandshakeInterceptor:
  1. Extract token từ query string
  2. Validate JWT signature (HMAC-SHA, shared secret)
  3. Parse username từ JWT subject
  4. Lưu username vào session attributes
  ↓
✅ Accepted → ChatWebSocketHandler.afterConnectionEstablished()
   → WebSocketSessionManager.registerSession(username, session)
❌ Rejected → 403 (token missing/invalid/expired)
```

#### Message Format (Client → Server)

```json
{
  "senderId": "john",
  "receiverId": "jane",
  "content": "Hello!",
  "conversationId": "conv-john-jane",
  "timestamp": 1711234567890
}
```

> Nếu `timestamp` = 0 hoặc không gửi, server tự set `System.currentTimeMillis()`.

#### Message Format (Server → Client)

Cùng format JSON, broadcast qua Redis Pub/Sub đến cả **sender** (multi-device sync) và **receiver**.

---

## Event Streams (Kafka)

### ✅ Produces

| Topic | Key | Payload | Trigger |
|-------|-----|---------|---------|
| `chat-messages` | `conversationId` | `ChatMessageDto` | Khi nhận WebSocket message từ client |

**`ChatMessageDto` payload:**
```json
{
  "senderId": "john",
  "receiverId": "jane",
  "content": "Hello!",
  "conversationId": "conv-john-jane",
  "timestamp": 1711234567890
}
```

**Producer flow** (`ChatWebSocketHandler.handleTextMessage()`):
1. Parse JSON từ WebSocket `TextMessage`
2. Set timestamp nếu = 0
3. `kafkaTemplate.send("chat-messages", conversationId, chatMessage)`

**Kafka Producer Config** (`KafkaProducerConfig.java`):
- Custom `ProducerFactory<String, ChatMessageDto>`
- Tạo topic `chat-messages` với **3 partitions**, replication factor = 1

---

### 📥 Consumes

#### Topic: `user-events` (from Auth Service)

| Config | Value |
|--------|-------|
| Group ID | `chat-service-group` |
| Container Factory | `kafkaListenerContainerFactory` |
| Deserializer | `JsonDeserializer` (trusted packages: `*`) |

**Consumer** (`UserEventConsumer.java`):
```
Kafka "user-events" → UserEventDto
  ↓
Upsert ChatUser in MongoDB:
  - findByUserId(event.userId)
  - If exists → update username, avatarUrl
  - If not → create new ChatUser
  - chatUserRepository.save()
```

**`UserEventDto` payload:**
```json
{
  "userId": 1,
  "username": "john_doe",
  "avatarUrl": "https://example.com/avatar.png"
}
```

---

#### Topic: `chat-messages` (self-produced)

| Config | Value |
|--------|-------|
| Group ID | `chat-service-group` |

**Consumer** (`ChatMessageKafkaConsumer.java`):
```
Kafka "chat-messages" → ChatMessageDto
  ↓
1. Save to MongoDB (MessageEntity)
  ↓
2. Publish to Redis Pub/Sub channel "chat-channel" (JSON string)
  ↓
RedisMessageSubscriber.onMessage():
  ↓
3. Deliver to receiver via WebSocket (if connected to this node)
4. Deliver to sender via WebSocket (multi-device sync)
```

---

## Full Message Pipeline

```
📱 Client (WebSocket)
  │
  ▼
ChatWebSocketHandler.handleTextMessage()
  │ parse JSON → ChatMessageDto
  ▼
KafkaTemplate.send("chat-messages", conversationId, message)
  │
  ▼
[Apache Kafka — topic: chat-messages, 3 partitions]
  │
  ▼
ChatMessageKafkaConsumer.consumeChatMessage()
  ├──▶ MessageRepository.save() → MongoDB (persist)
  └──▶ RedisTemplate.convertAndSend("chat-channel", json)
                │
                ▼
        [Redis Pub/Sub — channel: chat-channel]
                │
                ▼ (broadcast to ALL nodes)
        RedisMessageSubscriber.onMessage()
          ├──▶ sessionManager.getSession(receiverId) → send WebSocket
          └──▶ sessionManager.getSession(senderId)  → send WebSocket
```

---

## Dependencies (Inter-Service Communication)

Chat Service **không gọi trực tiếp** (HTTP/gRPC) tới bất kỳ service nào.

Toàn bộ giao tiếp là **bất đồng bộ qua Kafka**:

```
Auth Service ──(Kafka: user-events)──▶ Chat Service
```

Chat Service là consumer thuần túy — nhận events, không gửi response lại.

---

## Source Code Structure

```
chat-service/
├── Dockerfile                 # Multi-stage build (Maven → JRE 17)
├── pom.xml                    # Dependencies & build config
└── src/main/java/com/iuhconnect/chatservice/
    ├── ChatServiceApplication.java              # @SpringBootApplication entry point
    │
    ├── config/
    │   ├── WebSocketConfig.java                 # Register /ws/chat handler + JWT interceptor
    │   ├── RedisConfig.java                     # ChannelTopic, MessageListener, Container
    │   └── KafkaProducerConfig.java             # ProducerFactory, KafkaTemplate, Topic
    │
    ├── consumer/
    │   ├── UserEventConsumer.java               # @KafkaListener("user-events") → upsert ChatUser
    │   └── ChatMessageKafkaConsumer.java        # @KafkaListener("chat-messages") → save + Redis pub
    │
    ├── dto/
    │   ├── ChatMessageDto.java                  # senderId, receiverId, content, conversationId, timestamp
    │   └── UserEventDto.java                    # userId, username, avatarUrl
    │
    ├── handler/
    │   ├── ChatWebSocketHandler.java            # WebSocket connect/message/disconnect
    │   └── WebSocketSessionManager.java         # ConcurrentHashMap<username, WebSocketSession>
    │
    ├── model/
    │   ├── MessageEntity.java                   # MongoDB document "messages"
    │   └── ChatUser.java                        # MongoDB document "chat_users"
    │
    ├── redis/
    │   └── RedisMessageSubscriber.java          # Redis → deliver via WebSocket to local sessions
    │
    ├── repository/
    │   ├── MessageRepository.java               # MongoRepository<MessageEntity>
    │   └── ChatUserRepository.java              # MongoRepository<ChatUser> + findByUserId()
    │
    └── security/
        └── JwtHandshakeInterceptor.java         # Validate JWT during WebSocket upgrade
```

---

## Quick Start (Standalone)

```bash
# Yêu cầu: MongoDB, Redis, Kafka đều chạy trên localhost

set SPRING_DATA_MONGODB_URI=mongodb://iuh_admin:iuh_mongo_pass@localhost:27017/iuh_connect_db?authSource=admin
set SPRING_DATA_REDIS_HOST=localhost
set SPRING_KAFKA_BOOTSTRAP_SERVERS=localhost:9092

# Build & Run (cần Maven hoặc Maven wrapper)
mvn spring-boot:run
```

Hoặc chạy qua Docker Compose (khuyến nghị):
```bash
cd ../../
docker-compose up --build chat-service
```
