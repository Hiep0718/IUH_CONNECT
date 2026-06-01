# Task List: Tách Chat Service

## Phase 1: Tạo `Meeting Service`
- [x] Sao chép/Khởi tạo cấu trúc dự án `backend/meeting-service` từ `chat-service`.
- [x] Đổi tên trong `pom.xml` và các class main.
- [x] Giữ lại các file liên quan đến Meeting & Call: `MeetingController`, `CallSignalController`, `MeetingSessionService`, `CallSignalService`, DTOs, Models.
- [x] Xoá các file không liên quan (Message, Conversation, Media, v.v.) trong `meeting-service`.
- [x] Cập nhật `application.yml` cho `meeting-service` (đổi port, tên service, config phù hợp).
- [x] Cập nhật `backend/api-gateway/src/main/resources/application.yml` thêm route cho `meeting-service`.
- [x] Xoá các file Meeting & Call khỏi `chat-service`.
- [x] Đảm bảo cả hai dịch vụ compile thành công (`mvn clean install`).
- [x] Commit & Push lên GitHub.

## Phase 2: Tạo `Media Service` (File Upload)
- [ ] Khởi tạo dự án `backend/media-service`.
- [ ] Chuyển `FileUploadController` và cấu hình S3 từ `chat-service` sang `media-service`.
- [ ] Cập nhật `api-gateway` thêm route cho `media-service`.
- [ ] Xoá logic upload/download S3 khỏi `chat-service`.
- [ ] Kiểm tra compile.
- [ ] Commit & Push.

## Phase 3: Tạo `Conversation Service`
- [ ] Khởi tạo dự án `backend/conversation-service`.
- [ ] Chuyển `ConversationController`, `UserConversationSettingsController` và các Service/Model tương ứng.
- [ ] Chuyển cấu hình kết nối MongoDB (sử dụng cùng DB hoặc collection riêng).
- [ ] Thiết lập giao tiếp (REST/Feign hoặc Kafka) giữa `Message Service` và `Conversation Service`.
- [ ] Cập nhật `api-gateway` thêm route cho `conversation-service`.
- [ ] Xoá logic Conversation khỏi `chat-service`.
- [ ] Kiểm tra compile.
- [ ] Commit & Push.

## Phase 4: Cập nhật WebSocket & Refactor `chat-service`
- [ ] Refactor `ChatWebSocketHandler` loại bỏ logic CALL_SIGNAL, WEBRTC.
- [ ] Áp dụng Strategy Pattern cho WebSocket Handler.
- [ ] Compile lại dự án.
- [ ] Commit & Push.
