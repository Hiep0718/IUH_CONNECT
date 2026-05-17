# IUH Connect - Architecture & C4 Model Documentation

Tài liệu này cung cấp mô tả chi tiết và chuẩn hóa về kiến trúc của hệ thống **IUH Connect**, phục vụ trực tiếp cho việc vẽ các biểu đồ Use Case, C4 Model (Context, Container, Component), và các sơ đồ kiến trúc hệ thống.

---

## 1. Use Case Diagram (Biểu đồ Tương tác Người dùng)

### 1.1. Các Tác nhân (Actors)
- **Sinh viên (Student):** Người dùng chính của hệ thống, sử dụng ứng dụng để liên lạc, trao đổi học tập và nhận thông báo từ trường.
- **Giảng viên (Lecturer):** Người dùng sử dụng hệ thống để hỗ trợ giảng dạy, liên lạc với sinh viên, tổ chức các cuộc họp trực tuyến.
- **Hệ thống Quản lý Đào tạo (IUH Portal):** Hệ thống bên ngoài (được giả lập bởi mock service) cung cấp dữ liệu về thời khóa biểu, lịch thi, danh sách lớp.
- **Jitsi Meet Server:** Nền tảng bên ngoài hỗ trợ xử lý luồng Media (Video/Audio) cho tính năng gọi điện trực tuyến.

### 1.2. Các Use Case Chính (Core Use Cases)
- **Quản lý Tài khoản & Hồ sơ:**
  - Đăng ký / Đăng nhập (Xác thực bằng JWT).
  - Cập nhật thông tin cá nhân, ảnh đại diện (Upload qua MinIO).
- **Quản lý Liên lạc (Contact & Friendship):**
  - Tìm kiếm người dùng (Sinh viên/Giảng viên).
  - Gửi lời mời kết bạn / Chấp nhận / Hủy kết bạn.
  - Xem danh sách bạn bè, người liên lạc.
- **Nhắn tin Thời gian thực (Real-time Chat):**
  - Gửi/Nhận tin nhắn cá nhân (1-1) và nhóm.
  - Gửi file đính kèm, hình ảnh, video.
  - Xem lịch sử trò chuyện.
  - Hiển thị trạng thái Online / Offline (Presence).
- **Gọi Video & Họp trực tuyến (Meeting / Video Call):**
  - Khởi tạo cuộc gọi Video từ thiết bị di động (Tích hợp Jitsi).
  - **Chuyển thiết bị (Handoff):** Quét mã QR để chuyển tiếp (handoff) cuộc gọi từ thiết bị di động sang nền tảng Desktop Web để tiện chia sẻ màn hình.
- **Tra cứu Thông tin Trường học (Tích hợp Portal):**
  - Xem thời khóa biểu cá nhân.
  - Xem lịch thi, thông báo học vụ.
  - Nhận Push Notification về các thay đổi học vụ.

---

## 2. C4 Model - Level 1: System Context Diagram

Biểu đồ Context mô tả hệ thống ở mức tổng quan nhất, thể hiện sự tương tác giữa người dùng, hệ thống IUH Connect và các hệ thống bên ngoài.

**Các thành phần trong Context Diagram:**
1. **User (Sinh viên / Giảng viên):** Tương tác với IUH Connect qua thiết bị Mobile hoặc Desktop Web.
2. **IUH Connect System (Hệ thống chính):** Nền tảng giao tiếp nội bộ thời gian thực dành cho trường Đại học.
3. **IUH Portal (External System):** Hệ thống quản lý đào tạo của trường. Cung cấp dữ liệu sinh viên, giảng viên, thời khóa biểu (Hiện tại dùng Mock Service để giả lập).
4. **Jitsi Meet Server (External System):** Nền tảng hội nghị truyền hình bên ngoài. Xử lý truyền tải video/audio.
5. **Push Notification Service (FCM/APNs) (External System):** Dịch vụ gửi thông báo đẩy đến các thiết bị di động.

**Mô tả Tương tác (Relationships):**
- **User** -> [Sử dụng] -> **IUH Connect System**
- **IUH Connect System** -> [Lấy dữ liệu TKB, Lịch thi] -> **IUH Portal**
- **IUH Connect System** -> [Khởi tạo & Điều hướng Media] -> **Jitsi Meet Server**
- **IUH Connect System** -> [Gửi thông báo] -> **Push Notification Service**

---

## 3. C4 Model - Level 2: Container Diagram

Phân rã hệ thống **IUH Connect System** thành các Container (Ứng dụng, Dịch vụ, Cơ sở dữ liệu). Hệ thống được thiết kế theo kiến trúc Microservices.

### 3.1. Phía Client (Frontend)
- **Mobile App (React Native):** Giao diện chính của hệ thống. Chạy trên Android/iOS. Chứa logic UI cho Chat, Video Call, Contacts, Profile. Giao tiếp qua REST API và WebSocket.
- **Desktop Web Client (React/HTML tĩnh):** Giao diện web thu gọn phục vụ tính năng "Handoff" cuộc họp qua mã QR. Chạy trên trình duyệt máy tính.

### 3.2. Phía Backend (Microservices)
- **API Gateway (Spring Cloud Gateway):**
  - Cổng giao tiếp duy nhất (Single Entry Point).
  - Định tuyến các request HTTP (REST) và WebSocket (ws://) đến các service tương ứng.
- **Auth Service (Spring Boot):**
  - Container quản lý định danh và quyền truy cập.
  - Xử lý Đăng ký, Đăng nhập (JWT), Quản lý người dùng, Danh bạ (Contacts).
  - Ghi dữ liệu vào MariaDB. Đẩy sự kiện (`user-events`) lên Kafka.
- **Chat Service (Spring Boot):**
  - Container xử lý logic chat thời gian thực và tín hiệu (signaling) cuộc gọi.
  - Quản lý kết nối WebSocket.
  - Đồng bộ trạng thái trực tuyến (Presence) qua Redis.
  - Lưu trữ tin nhắn vào MongoDB thông qua Kafka consumer.
  - Cung cấp Presigned URL để client upload file lên MinIO.
- **Presence Service (Spring Boot):**
  - Quản lý tập trung trạng thái Online/Offline của thiết bị. (Đang trong quá trình tách biệt từ Chat Service).
- **Notification Service (Spring Boot):**
  - Container chịu trách nhiệm gửi Push Notification qua FCM. Lắng nghe các event từ Kafka.
- **IUH Portal Mock Service (Node.js):**
  - Container đóng vai trò như một Proxy/Mock giả lập hệ thống thật của nhà trường để trả về dữ liệu mẫu (Mock data).

### 3.3. Infrastructure & Databases (Storage)
- **MariaDB (Relational DB):** Lưu trữ dữ liệu cấu trúc cao: Thông tin User, Thông tin xác thực, Danh bạ bạn bè.
- **MongoDB (NoSQL DB):** Lưu trữ dữ liệu phi cấu trúc, tần suất ghi cao: Lịch sử tin nhắn, Hội thoại chat.
- **Redis (In-memory Data Grid):** Lưu trữ tạm thời (Cache), quản lý session WebSocket, trạng thái Presence, và làm Pub/Sub Broker cho Signaling Video Call giữa các instances.
- **Apache Kafka & Zookeeper (Message Broker):** Xử lý bất đồng bộ (Asynchronous Messaging). Các topic chính: `chat-messages`, `user-events`. Đảm bảo tính mở rộng và chịu lỗi cho việc lưu trữ tin nhắn.
- **MinIO (Object Storage):** Tương thích Amazon S3. Dùng để lưu trữ File tĩnh, Hình ảnh đính kèm, Video, Avatar.

**Mô tả Tương tác giữa các Container (Flows):**
- **Mobile App** -> `[REST/HTTPS]` -> **API Gateway**
- **Mobile App** -> `[WebSocket]` -> **API Gateway** -> `[Forward]` -> **Chat Service**
- **API Gateway** -> `[REST]` -> **Auth Service** / **Chat Service** / **IUH Portal Mock**
- **Auth Service** -> `[Đọc/Ghi JDBC]` -> **MariaDB**
- **Auth Service** -> `[Publish Event]` -> **Kafka**
- **Chat Service** -> `[Publish Message]` -> **Kafka** -> `[Consume]` -> **Chat Service (Worker)** -> `[Lưu BSON]` -> **MongoDB**
- **Chat Service** -> `[Lấy Token/URL]` -> **MinIO**
- **Chat Service** -> `[Pub/Sub Signaling & Trạng thái]` -> **Redis**
- **Notification Service** -> `[Consume Event]` -> **Kafka**

---

## 4. Gợi ý thiết kế C4 Model - Le2vel 3: Component Diagram (Cho Chat Service)

Vì Chat Service là core phức tạp nhất, dưới đây là gợi ý các Components bên trong nó để vẽ Level 3:

- **ChatController / FileUploadController:** Nhận HTTP REST request liên quan đến lấy lịch sử chat, sinh URL upload file.
- **ChatWebSocketHandler:** Cổng lắng nghe và xử lý các WebSocket frames từ thiết bị của User. Phân loại tin nhắn (Chat Message vs Call Signaling).
- **WebSocketSessionManager:** Quản lý vòng đời của WebSocket sessions đang kết nối tại Node hiện tại.
- **MessageService:** Chứa logic nghiệp vụ liên quan đến tin nhắn.
- **ChatMessageKafkaProducer:** Đóng gói tin nhắn và đẩy vào Kafka topic `chat-messages`.
- **ChatMessageKafkaConsumer:** Lắng nghe Kafka topic `chat-messages`. Gọi Repository để lưu DB và tìm kiếm các WebSocketSession tương ứng để đẩy (Push) tin nhắn về cho người nhận.
- **SignalingRedisSubscriber:** Nhận các tín hiệu Call (WebRTC/Jitsi handoff) từ các instance khác qua Redis Pub/Sub để điều phối cuộc gọi đa thiết bị.
- **MongoChatMessageRepository:** Giao tiếp với MongoDB.

---

## 5. Đặc tả Hệ thống Handoff Meeting (Cho luồng Use Case nâng cao)
Hệ thống cho phép người dùng chuyển thiết bị mượt mà:
1. **Mobile App** khởi tạo cuộc gọi.
2. Người dùng muốn chia sẻ màn hình máy tính -> Mở **Desktop Web** (Màn hình Join).
3. Web hiển thị mã **QR Code** chứa Session ID định danh Socket Desktop.
4. **Mobile App** quét mã QR -> Gửi gói tin Signaling `DEVICE_JOINED` qua WebSocket vào **Chat Service**.
5. **Chat Service** broadcast qua **Redis** -> Báo cho Desktop Web tự động chuyển hướng (Redirect) vào phòng Jitsi.
6. **Mobile App** có thể giữ vai trò Companion (Remote) hoặc ngắt kết nối âm thanh để tránh dội âm.

---
*(Sử dụng file này làm tài liệu nền tảng, bạn có thể dễ dàng map các tác nhân, container, databases vào công cụ vẽ như Draw.io, PlantUML hoặc Structurizr để sinh ra sơ đồ C4 chính xác nhất.)*
