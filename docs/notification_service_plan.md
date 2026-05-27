# 🔔 Master Implementation Plan: Notification Service

Tài liệu này là bản kế hoạch triển khai chi tiết (Step-by-Step) cho `Notification Service`, tuân thủ **100%** theo kiến trúc C4 Model: **Notification Service là một Pure Event-Driven Worker**, không kết nối database ngoài (Redis/MariaDB/MongoDB), không mở REST API, chỉ giao tiếp với Kafka (Consume) và Firebase Cloud Messaging (Push HTTP).

---

## 🎯 Mục Tiêu Khóa
1. **Frontend:** Gửi FCM token lên Auth Service. Lắng nghe Push Notification.
2. **Auth Service:** Lưu FCM Token vào MariaDB. Publish event `USER_FCM_TOKEN_UPDATED` lên Kafka.
3. **Notification Service:**
   - Dùng **Local Cache (Caffeine/In-memory)** để lưu trạng thái Online/Offline và FCM Token.
   - Consume `presence-events` để build cache Online/Offline.
   - Consume `user-events` để build cache FCM Token.
   - Consume `chat-messages`: Nếu user **OFFLINE** + Có **FCM Token** -> Bắn push via FCM.

---

## 🚀 KẾ HOẠCH CHI TIẾT 5 PHASES

### Phase 1: Chuẩn Bị Firebase & Môi Trường (Setup)
*Yêu cầu thiết lập môi trường để có credential kết nối FCM.*

- [ ] **1.1 Tạo Project trên Firebase Console:** Tạo project mới.
- [ ] **1.2 Cấu hình Android:**
  - Lấy package name (vd: `com.iuhconnect`).
  - Tải file `google-services.json` bỏ vào `frontend/android/app/`.
- [ ] **1.3 Tạo Service Account cho Backend:**
  - Vào Firebase Console -> Project Settings -> Service Accounts -> Generate new private key.
  - Lưu file thành `firebase-service-account.json` đặt vào `backend/notification-service/src/main/resources/`.

---

### Phase 2: Nâng cấp Auth Service (API & Kafka Producer)
*Do Notification Service không có API, Mobile App sẽ gửi FCM token qua Auth Service (Service quản lý user).*

- [ ] **2.1 Thêm Field DB:** Thêm thuộc tính `fcmToken` (String) vào Entity `User.java` (Auth Service).
- [ ] **2.2 DTO & Controller:** 
  - Tạo `FcmTokenRequest.java` `{ fcmToken: string }`.
  - Thêm endpoint `POST /api/users/fcm-token` trong `UserController.java`.
- [ ] **2.3 Logic Service & Kafka:** 
  - Cập nhật `fcmToken` vào `MariaDB`.
  - Gọi `UserEventProducer` publish event lên Kafka topic `user-events` với cấu trúc:
    ```json
    { "eventType": "FCM_TOKEN_UPDATED", "userId": "...", "fcmToken": "..." }
    ```

---

### Phase 3: Core Notification Service (Local Cache & Firebase SDK)
*Xây dựng bộ khung Worker không trạng thái (stateless) với In-memory Cache.*

- [ ] **3.1 Cập nhật `pom.xml`:** Thêm các dependencies:
  - `spring-kafka`
  - `firebase-admin` (v9.2.0)
  - `caffeine` (Cho in-memory cache tốc độ cao)
- [ ] **3.2 Cấu hình Firebase (`FirebaseConfig.java`):**
  - Đọc `firebase-service-account.json` và khởi tạo `FirebaseApp`.
- [ ] **3.3 Quản Lý Local Cache (`LocalCacheService.java`):**
  - Khởi tạo 2 biến Concurrent/Caffeine Cache:
    1. `presenceCache`: `Map<String, Boolean>` (Lưu trạng thái Online/Offline).
    2. `tokenCache`: `Map<String, String>` (Lưu FCM Token).
  - Viết các hàm update/get từ cache.
- [ ] **3.4 Dịch Vụ Push (`FcmPushService.java`):**
  - Hàm `sendPush(String targetToken, String title, String body, Map<String, String> data)`.
  - Handle lỗi khi token hết hạn -> Xóa token khỏi `tokenCache`.

---

### Phase 4: Kafka Consumers (Trái Tim Hệ Thống)
*Lắng nghe các sự kiện theo đúng sơ đồ C4 và xử lý Logic Push.*

- [ ] **4.1 Lắng nghe User Events (`UserEventConsumer.java`):**
  - Topic: `user-events`.
  - Logic: Nếu type là `FCM_TOKEN_UPDATED`, lấy token lưu vào `LocalCacheService.tokenCache`.
- [ ] **4.2 Lắng nghe Presence Events (`PresenceEventConsumer.java`):**
  - Topic: `presence-events`.
  - Logic: Nếu status là `ONLINE` -> lưu `true`, `OFFLINE` -> lưu `false` vào `LocalCacheService.presenceCache`.
- [ ] **4.3 Lắng nghe Chat Messages (`ChatMessageConsumer.java`):**
  - Topic: `chat-messages`.
  - **Logic Cốt Lõi:**
    1. Lấy `receiverId` từ message.
    2. Check `presenceCache`: Nếu đang `ONLINE` -> **Bỏ qua** (App đã nhận qua WebSocket).
    3. Nếu `OFFLINE` (hoặc không có trong cache): Check `tokenCache`.
    4. Nếu có FCM Token -> Gọi `FcmPushService.sendPush()` báo "Bạn có tin nhắn mới".

---

### Phase 5: Tích Hợp Frontend (React Native Mobile App)
*Xử lý nhận thông báo trên app và gửi token lên server.*

- [ ] **5.1 Cài đặt thư viện:** 
  - `npm install @react-native-firebase/app @react-native-firebase/messaging`
  - Chạy `pod install` (nếu có iOS).
  - Cấu hình file `build.gradle` (Thêm plugin `google-services`).
- [ ] **5.2 Xin Quyền & Lấy Token (`notificationService.ts`):**
  - Request permission người dùng.
  - Gọi `messaging().getToken()`.
  - Sau khi đăng nhập thành công, gọi API `POST /api/users/fcm-token` (của Auth Service) để gửi token.
- [ ] **5.3 Xử lý nhận thông báo (App.tsx / Index.js):**
  - Lắng nghe tin nhắn Foreground (`messaging().onMessage`).
  - Lắng nghe tin nhắn Background/Quit (`messaging().setBackgroundMessageHandler`).

---

## 🛠 Tóm Tắt Quy Trình Triển Khai (Flow)
Khi người dùng A (Online) nhắn tin cho người dùng B (Offline):
1. **B** đã gửi FCM Token lên `Auth`, Kafka bắn event -> **Notification Service** đã có token của **B** ở Local Cache.
2. **B** tắt app -> `Presence Service` bắn event OFFLINE -> **Notification Service** đã update cache thành Offline.
3. **A** gửi tin nhắn -> `Chat Service` bắn lên Kafka.
4. **Notification Service** nhận tin nhắn, thấy **B** offline và có token -> Bắn Push qua FCM -> Máy **B** rung lên nhận thông báo. 

*(Quy trình này không tốn một query nào xuống Database, độ trễ tiệm cận 0ms).*
