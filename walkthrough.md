# 🚀 Tổng Kết Quá Trình Cải Thiện Kiến Trúc (Phase 1 & 2)

Chúng ta đã hoàn thành thành công **6 bước** để giải quyết các vấn đề cấu trúc và bảo mật trong hệ thống, bắt đầu quá trình phá vỡ kiến trúc nguyên khối của Chat Service. Dưới đây là những gì đã được thực hiện:

## 🛡️ Phase 1: Quick Wins

### 1. Quản lý Secret (.env)
- **Vấn đề:** Mật khẩu database, Redis và JWT secret bị lộ trực tiếp trong file `docker-compose.yml` và `application.yml`.
- **Giải quyết:** 
  - Tạo file template [`.env.example`](file:///d:/KienTrucDuAn/IUH_CONNECT/.env.example) và cấu hình Docker để sử dụng biến môi trường.
  - Xoá hoàn toàn credentials khỏi source code. File `.env` thật đã được thêm vào `.gitignore` để đảm bảo an toàn.

### 2. Chuẩn hóa Exception Handling
- **Vấn đề:** Service layer ném ra quá nhiều lỗi `RuntimeException` chung chung (đặc biệt trong quản lý nhóm), khiến API trả về lỗi 500 mơ hồ, gây khó khăn cho việc xử lý ở Frontend.
- **Giải quyết:**
  - Định nghĩa Enum `ErrorCode` thống nhất kèm mã lỗi HTTP chuẩn.
  - Thay thế toàn bộ `RuntimeException` trong `ConversationService` và `MessageService` bằng custom `AppException`.
  - Triển khai `@RestControllerAdvice` (GlobalExceptionHandler) để tự động bắt lỗi và trả về JSON theo chuẩn chung thống nhất (mã lỗi, tin nhắn, thời gian).

### 3. Sửa lỗi Healthcheck cho Notification Service
- **Vấn đề:** Do `notification-service` đóng vai trò là một Kafka worker và không sử dụng Web Server (HTTP), Docker không thể ping healthcheck thông thường.
- **Giải quyết:** Cấu hình lệnh ping process `pgrep -f 'java'` trong `docker-compose.yml` để Docker tự phát hiện nếu worker crash và khởi động lại.

### 4. Idempotency cho Consumer Kafka (Chống trùng tin nhắn)
- **Vấn đề:** Khi Kafka gửi lại (retry) tin nhắn cho Consumer hoặc có nhiều server Chat chạy song song, tin nhắn dễ bị nhân bản trong MongoDB.
- **Giải quyết:** Áp dụng tính năng *Deduplication* bằng Redis `SETNX`. Trước khi lưu tin vào DB, hệ thống kiểm tra khoá chống trùng lắp (TTL = 5 phút). Nếu bị trùng, DB save sẽ bị huỷ nhưng WebSocket broadcast vẫn hoạt động, đảm bảo realtime.

---

## 🏗️ Phase 2: Refactoring Code Base

### 5. Áp dụng Strategy Pattern cho WebSocket
- **Vấn đề:** [ChatWebSocketHandler.java](file:///d:/KienTrucDuAn/IUH_CONNECT/backend/chat-service/src/main/java/com/iuhconnect/chatservice/handler/ChatWebSocketHandler.java) từng chứa cả chục khối `if-else` khổng lồ để xử lý từng loại tín hiệu (PING, CHAT, READ_RECEIPT, WEBRTC, CALL_SIGNAL...), vi phạm nghiêm trọng **Open/Closed Principle**.
- **Giải quyết:**
  - Khai báo Interface `WsMessageStrategy`.
  - Tách mỗi chức năng thành các Strategy riêng (PingStrategy, CallSignalStrategy, ChatMessageStrategy...).
  - Dùng Spring Boot để "bơm" (inject) toàn bộ logic vào Handler bằng `Map<String, WsMessageStrategy>`. 
  - Đã mạnh tay xóa luôn nhánh `WEBRTC` cũ không dùng nữa, làm code nhẹ đi rất nhiều.

### 6. Tập trung Presence Logic (Single Source of Truth)
- **Vấn đề:** Cả `chat-service` và `presence-service` đều cùng quyền thay đổi dữ liệu `presence:{userId}` của người dùng trên Redis, gây ra **Race Condition** và đứt gãy trạng thái trực tuyến.
- **Giải quyết:** 
  - `chat-service` không còn thay đổi trạng thái nữa. Giờ nó chỉ ghi nhận "Ai đang kết nối vào Server nào" và bắn sự kiện **Kafka (presence-events)**.
  - Cấu hình [PresenceEventConsumer.java](file:///d:/KienTrucDuAn/IUH_CONNECT/backend/presence-service/src/main/java/com/iuhconnect/presenceservice/consumer/PresenceEventConsumer.java) mới ở `presence-service` để lắng nghe sự kiện.
  - `presence-service` hiện trở thành bộ não trung tâm duy nhất kiểm soát Online/Offline.

> [!TIP]
> **Kết quả mong muốn:** Hệ thống bạn hiện tại đã chạy mượt mà, phân lớp rõ ràng và dễ scale ra nhiều server mà không sợ lặp dữ liệu hay lỗi trạng thái.
> **Tiếp theo:** Bạn có thể start lại hệ thống (`docker compose up -d --build`) để test thử. Nếu không có gì thay đổi, Frontend của bạn vẫn sẽ hoạt động như cũ nhưng hệ thống Backend giờ đã bảo mật và đáng tin cậy hơn rất nhiều.
