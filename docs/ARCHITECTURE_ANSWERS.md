# KIẾN TRÚC HỆ THỐNG: CÂU HỎI & ĐÁP ÁN CHI TIẾT

## PHẦN 1: THÔNG TIN CHO SƠ ĐỒ KIẾN TRÚC TỔNG THỂ (3.4)

### 1. Service Discovery & Load Balancing (Khám phá dịch vụ)

#### Q1.1: Hệ thống có dùng Service Registry không? Hay dùng Static Routing?

**ĐÁP ÁN:** 
- **Dùng Static Routing qua Docker Container Names** ✓
- **Không dùng Service Registry** (không có Netflix Eureka, Consul)

**Bằng chứng từ code:**
- `docker-compose.yml` định nghĩa tất cả services với tên container cố định:
  - `iuh-auth-service` → port 8085
  - `iuh-chat-service` → port 8082
  - `iuh-presence-service` → port 8083
  - `iuh-notification-service` → (no HTTP port, worker only)
  - `iuh-api-gateway` → port 8080

- Mỗi service configure kết nối bằng **environment variables** với container name cố định:
  ```yaml
  api-gateway/application.yml:
    AUTH_SERVICE_URL: http://auth-service:8085
    CHAT_SERVICE_HTTP_URL: http://chat-service:8082
    PRESENCE_SERVICE_URL: http://presence-service:8083
  ```

- Các services trong Docker network `iuh-connect-network` có thể resolve tên container thành IP tự động.

---

#### Q1.2: API Gateway dùng công nghệ gì? Có Circuit Breaker không?

**ĐÁP ÁN:**

**API Gateway:**
- ✓ **Spring Cloud Gateway** (reactive)
- Phiên bản: Spring Cloud 2023.0.0

**Bằng chứng:**
```xml
<!-- api-gateway/pom.xml -->
<dependency>
    <groupId>org.springframework.cloud</groupId>
    <artifactId>spring-cloud-starter-gateway</artifactId>
</dependency>
```

**Tính năng Gateway:**
- ✓ **Rate Limiter** (Redis-backed):
  - Sử dụng Redis để lưu trạng thái rate limit
  - Default: 10 requests/sec, burst capacity 20
  - Configured cho từng route (auth, chat, presence, files, etc.)

```yaml
# Routes trong application.yml
filters:
  - name: RequestRateLimiter
    args:
      redis-rate-limiter.replenishRate: 10
      redis-rate-limiter.burstCapacity: 20
      key-resolver: "#{@userKeyResolver}"
```

**Circuit Breaker & Tracing:**
- ✅ **ĐÃ tích hợp Circuit Breaker** (Sử dụng Resilience4j tại API Gateway và Feign Client trong Chat Service)
- Có `FallbackController` xử lý phản hồi lỗi nhẹ nhàng khi service sập.
- ✅ **ĐÃ tích hợp Distributed Tracing** (Sử dụng Micrometer Tracing và Zipkin) để theo dõi request qua tất cả các microservices với traceId chung.
---

### 2. Trục sự kiện Apache Kafka

#### Q2.1: Ngoài chat-messages, còn topics nào khác?

**ĐÁP ÁN: CÓ 4 TOPICS**

**Kafka Topics sử dụng:**

1. **`chat-messages`** → Messages từ chat thông thường
   - **Producer:** Chat Service (khi user gửi message)
   - **Consumers:** 
     - Chat Service (broadcast đến receiver via WebSocket)
     - Notification Service (gửi push FCM nếu receiver offline)

2. **`presence-events`** → Online/Offline status events
   - **Producer:** Presence Service (khi user online/offline)
   - **Consumers:**
     - Chat Service (update status trong conversation)
     - Notification Service (cache trạng thái online/offline)

3. **`user-events`** → User lifecycle events (FCM token updates, etc.)
   - **Producer:** Auth Service / Chat Service
   - **Consumers:**
     - Presence Service (track user events)
     - Notification Service (cache FCM tokens)
   - **Event Types:** `FCM_TOKEN_UPDATED`

4. **`contact-events`** → Friend request, friend acceptance events
   - **Producer:** Chat Service / Auth Service
   - **Consumers:**
     - Chat Service (update contact list)
     - Notification Service (push notification về friend request)

**Bằng chứng từ @KafkaListener annotations:**

```java
// Chat Service (consumers)
@KafkaListener(topics = "chat-messages", groupId = "chat-service-group")
@KafkaListener(topics = "presence-events", groupId = "...")
@KafkaListener(topics = "contact-events", groupId = "...")
@KafkaListener(topics = "user-events", groupId = "...")

// Notification Service (consumers)
@KafkaListener(topics = "chat-messages", groupId = "notification-service-chat-group")
@KafkaListener(topics = "presence-events", groupId = "notification-service-presence-group")
@KafkaListener(topics = "contact-events", groupId = "notification-service-contact-group")
@KafkaListener(topics = "user-events", groupId = "notification-service-user-group")

// Presence Service (consumers)
@KafkaListener(topics = "user-events", groupId = "presence-service-group")
```

---

### 3. Giao tiếp liên dịch vụ (Inter-service Communication)

#### Q3.1: Có luồng gọi trực tiếp (Synchronous) nào khác giữa các service?

**ĐÁP ÁN: CÓ GỌI ĐỒNG BỘ QUED (OpenFeign)**

**Synchronous Calls (OpenFeign):**

1. **Chat Service → Auth Service** (User Avatar retrieval)
   - **Client:** `UserServiceClient` (Feign Client)
   - **Endpoint:** `/api/v1/users/{userId}/avatar`
   - **Khi nào:** Khi Chat Service cần lấy thông tin user
   - **URL configure:** `http://auth-service:8085/api/v1/users`

```java
@FeignClient(name = "user-service", url = "${user.service.url:http://localhost:8085/api/v1/users}")
public interface UserServiceClient {
    @GetMapping("/{userId}/avatar")
    String getUserAvatar(@PathVariable("userId") String userId);
}
```

2. **API Gateway → Backend Services** (HTTP/WebSocket routes)
   - Gateway routing đến:
     - Auth Service (8085): `/api/v1/auth/**`, `/api/v1/contacts/**`, `/api/v1/users/**`
     - Chat Service (8082): `/api/v1/chat/**`, `/api/v1/meetings/**`, `/api/v1/files/**`
     - Presence Service (8083): `/api/v1/presence/**`

**Async Communication (Kafka):**
- Mọi business events khác đều dùng Kafka (không gọi trực tiếp)
- Tránh tight coupling, improve resilience

---

### 4. Dịch vụ Thông báo (Notification Service)

#### Q4.1: Có Notification Service riêng? Hay logic FCM nhét chung trong Chat Service?

**ĐÁP ÁN: CÓ NOTIFICATION SERVICE RIÊNG CHUYÊN BIỆT** ✓

**Notification Service Architecture:**

- **Type:** Background Worker (không có web server)
  ```yaml
  # notification-service/application.yml
  spring:
    main:
      web-application-type: none  # Chạy ngầm, không Tomcat
  ```

- **Chức năng:**
  - Lắng nghe 4 Kafka topics: `chat-messages`, `presence-events`, `user-events`, `contact-events`
  - Kiểm tra trạng thái online/offline qua cache (Caffeine)
  - Nếu receiver **OFFLINE**, gọi Firebase Cloud Messaging (FCM) để push notification
  - Nếu receiver **ONLINE**, skip (WebSocket sẽ handle)

- **Consumers:**
  - `ChatMessageConsumer` → push notification khi có tin nhắn mới
  - `PresenceEventConsumer` → cache online/offline status
  - `UserEventConsumer` → cache FCM tokens
  - `ContactEventConsumer` → push notification cho friend request/acceptance

- **Push Logic:**
  ```java
  if (localCacheService.isOnline(receiverId)) {
      log.info("⏩ User {} is ONLINE, skipping push notification", receiverId);
      return;  // WebSocket đã handle, không cần push
  }
  
  String token = localCacheService.getToken(receiverId);
  if (token != null) {
      fcmPushService.sendPush(token, ...);  // Gọi Firebase FCM
  }
  ```

- **Dependencies:**
  - Firebase Admin SDK v9.2.0
  - Spring Kafka
  - Caffeine Cache (in-memory cache, không Redis)
  - **Không có web server**, chỉ pure consumer

---

## PHẦN 2: THÔNG TIN CHO SƠ ĐỒ TRIỂN KHAI VẬT LÝ (3.5)

### 1. Cấu trúc máy chủ (Cloud Infrastructure)

#### Q1.1: Toàn bộ backend được triển khai trên single EC2 hay cụm nhiều máy?

**ĐÁP ÁN: SINGLE MACHINE ARCHITECTURE (Docker Compose)**

**Infrastructure:**
- ✓ Tất cả services chạy trên **1 máy chủ duy nhất** bằng Docker Compose
- Không dùng Docker Swarm / Kubernetes
- Không scaled horizontally (replicas đều = 1)

**Bằng chứng:**
```yaml
# docker-compose.yml
services:
  auth-service:
    deploy:
      replicas: 1  # Chỉ 1 instance
      resources:
        limits:
          cpus: '0.5'
          memory: 512M
```

**Mạng:**
- Tất cả containers kết nối qua **Docker Bridge Network:** `iuh-connect-network`
- Internal DNS resolution bằng container names

---

#### Q1.2: Máy chủ EC2 chạy hệ điều hành gì?

**ĐÁP ÁN: KHÔNG THỂ TRẢ LỜI TỪ CODE** ❌

**Note:** Thông tin OS không có trong code. Cần hỏi:
- [ ] Bạn dùng Ubuntu 22.04 LTS, CentOS, hay OS khác?
- [ ] Docker Engine version nào?

---

### 2. Lưu trữ Cơ sở dữ liệu (Databases Hosting)

#### Q2.1: DB chạy dưới dạng Docker Container hay Managed Services?

**ĐÁP ÁN: DOCKER CONTAINERS (On-premise, cùng single EC2)**

**Databases & Services:**

| Service | Technology | Hosting | Container Name | Port |
|---------|-----------|---------|---|---|
| **SQL** | MariaDB 11 | Docker | `iuh-mariadb` | 3307 |
| **NoSQL** | MongoDB 7.0 | Docker | `iuh-mongodb` | 27017 |
| **Cache** | Redis 7.2 | Docker | `iuh-redis` | 6379 |
| **Object Storage** | MinIO | Docker | `iuh-minio` | 9000, 9001 |
| **Message Broker** | Kafka 7.5.0 | Docker | `iuh-kafka` | 9092 |
| **ZK** | Zookeeper 7.5.0 | Docker | `iuh-zookeeper` | 2181 |

**Không dùng Managed Services:**
- ❌ Không dùng MongoDB Atlas
- ❌ Không dùng AWS RDS
- ❌ Không dùng Upstash Redis
- ✓ Dùng MinIO (self-hosted, S3-compatible, thay thế AWS S3)

**Data Persistence:**
```yaml
volumes:
  mariadb-data:
  mongodb-data:
  redis-data:
  kafka-data:
  minio-data:
```
- Tất cả dữ liệu lưu trên Docker named volumes

---

### 3. Reverse Proxy & Bảo mật (Mặt tiền hệ thống)

#### Q3.1: Có Nginx/HAProxy/Traefik phía trước API Gateway không? HTTPS/WSS?

**ĐÁP ÁN: KHÔNG CÓ REVERSE PROXY** ❌

**Hiện tại:**
- ❌ **Không có Nginx / HAProxy / Traefik**
- ❌ **Không có SSL/HTTPS/WSS**
- API Gateway tiếp nhận trực tiếp HTTP/WS trên port 8080

**Cảnh báo về security & WebRTC:**
- WebRTC/Jitsi cần **HTTPS/WSS** để hoạt động (đặc biệt trên production)
- Định vị (geolocation) cũng bắt buộc HTTPS
- Hiện tại: **HTTP không an toàn, không phù hợp production**

**Khuyến nghị:**
- [ ] Cần thêm Nginx làm reverse proxy phía trước Gateway
- [ ] Cài SSL certificate (Let's Encrypt)
- [ ] Enable HTTPS/WSS trên port 443

---

### 4. Dịch vụ Ngoại vi (External Nodes)

#### Q4.1: S3 - Dùng AWS S3 thật hay MinIO giả lập?

**ĐÁP ÁN: DÙNG MinIO (SELF-HOSTED S3-COMPATIBLE)** ✓

**Object Storage:**
- ✓ **MinIO (RELEASE.2023-11-20)**
- ✓ Container: `iuh-minio`
- ✓ Console UI: port 9001 (quản lý files)
- ✓ API: port 9000 (client access)
- ✓ Credentials: 
  - Username: `iuh_minio_admin`
  - Password: `iuh_minio_password`
- ✓ Bucket default: `chat-media`

**Code integration:**
```yaml
# chat-service/application.yml
spring:
  minio:
    url: http://minio:9000
    access-key: iuh_minio_admin
    secret-key: iuh_minio_password
    bucket-name: chat-media
```

```xml
<!-- chat-service/pom.xml -->
<dependency>
    <groupId>io.minio</groupId>
    <artifactId>minio</artifactId>
    <version>8.5.7</version>
</dependency>
```

---

#### Q4.2: Jitsi Server - Dùng server công cộng hay self-hosted?

**ĐÁP ÁN: DÙNG SERVER CÔNG CỘNG (EXTERNAL)**

**Video Meeting:**
- ✓ **meet.jit.si** (công cộng, ngoài hệ thống)
- ✓ Không self-host Jitsi

**Code:**
```typescript
// frontend/src/screens/VideoCallScreen.tsx
const JITSI_SERVER = 'https://meet.jit.si';

const openJitsiMeeting = (room: string) => {
    const jitsiUrl = `${JITSI_SERVER}/${room}#config.prejoinPageEnabled=false...`;
    Linking.openURL(jitsiUrl).catch((err) => {
        console.error('Failed to open Jitsi URL:', err);
    });
};
```

**Cách hoạt động:**
- Frontend open Jitsi URL trong trình duyệt
- Mỗi video call là một "room" riêng
- Không cần backend tích hợp WebRTC logic
- **Advantage:** Giảm tải server, outsource video complexity
- **Disadvantage:** Phụ thuộc external service, không kiểm soát

---

### 5. Luồng CI/CD (Tích hợp & Triển khai liên tục)

#### Q5.1: Có thiết lập luồng tự động (CI/CD) không?

**ĐÁP ÁN: KHÔNG CÓ CI/CD PIPELINE** ❌

**Tìm kiếm kết quả:**
- ❌ Không tìm thấy `.github/workflows/` (GitHub Actions)
- ❌ Không tìm thấy `.gitlab-ci.yml` (GitLab CI)
- ❌ Không tìm thấy `.circleci/config.yml` (CircleCI)

**Hiện tại: Manual Deployment**
- Build services: `mvn package`
- Build images: `docker build`
- Deploy: `docker-compose up`
- **Không tự động hóa**

**Khuyến nghị cho A+ point:**
- [ ] Thiết lập GitHub Actions CI/CD:
  1. GitHub Push → Trigger workflow
  2. Build Java service → Maven
  3. Build Docker image → Push to Docker Hub
  4. Deploy to EC2 → docker-compose pull && up
  5. Run tests, health checks

**Example workflow structure:**
```yaml
name: Deploy Backend
on: [push]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Build with Maven
        run: mvn -B package
      - name: Build & Push Docker Images
        run: docker build . -t myapp:latest
      - name: Deploy to Server
        run: ssh deploy@server "docker-compose pull && docker-compose up"
```

---

## TÓMLƯỢC KIẾN TRÚC HIỆN TẠI

### Architecture Pattern:
- ✓ **Microservices** (5 services)
- ✓ **Event-driven** (Kafka 4 topics)
- ✓ **API Gateway** (Spring Cloud Gateway)
- ❌ **No Service Discovery** (static routing)
- ❌ **No Circuit Breaker** (no Resilience4j)

### Deployment:
- ✓ **Docker Compose** (single machine)
- ✓ **All-in-one infrastructure** (DB, Cache, Broker, Services)
- ❌ **No Kubernetes / Swarm**
- ❌ **No Load Balancing** (not needed for single machine)

### External Services:
- ✓ MinIO (self-hosted S3-compatible)
- ✓ Jitsi Meet (external, public)
- ✓ Firebase FCM (external)

### Gaps for Production:
- ❌ No HTTPS/WSS (need Nginx + SSL)
- ❌ No CI/CD pipeline
- ❌ No container registry
- ❌ No horizontal scaling
- ❌ No circuit breaker/resilience4j
- [ ] **Recommended improvements for A+:**
  1. Add Nginx reverse proxy with SSL
  2. Implement GitHub Actions CI/CD
  3. Add Resilience4j Circuit Breaker to Feign clients
  4. Setup container registry (Docker Hub / ECR)
  5. Add distributed tracing (Jaeger)

---

## CÂU HỎI CẦN NGƯỜI DÙNG TRẢ LỜI

- [ ] **Q1:** Máy chủ EC2 chạy hệ điều hành gì? (Ubuntu, CentOS, etc.) CentOS
- [ ] **Q2:** Docker Engine version? không biết, chắc là mới nhất
- [ ] **Q3:** Đã deploy lên AWS hay còn chạy local? local thôi (giả lập 3 node như 3 ec2 ấy)
- [ ] **Q4:** Plan deployment strategy nào? (scaling, backup, monitoring) chưa nghĩ tới
- [ ] **Q5:** Có setup SSL certificate chưa? chưa
Project hiện tại đang Chạy MinIO trên Local (Máy mình) nhưng tôi sẽ thay đổi thành S3 khi cuẩn bị deploy

