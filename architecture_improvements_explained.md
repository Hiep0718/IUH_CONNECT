# Giải Thích Chi Tiết Cải Thiện Kiến Trúc (Phase 1 & 2)

*Tài liệu này giải thích các thay đổi về mặt kiến trúc hệ thống một cách dễ hiểu, sử dụng các ví dụ thực tế để minh họa lý do "Tại sao phải làm vậy". Dùng để thuyết trình hoặc giải thích cho người mới/giảng viên.*

---

## 🛡️ Phase 1: Các sửa đổi nhanh (Quick Wins)

Mục tiêu của Phase này là giải quyết nhanh các "lỗ hổng" về bảo mật và các lỗi gây khó chịu trong quá trình vận hành hệ thống.

### 1. Quản lý Secret (.env)

*   **Vấn đề cũ:** Mật khẩu database, Redis và JWT secret bị viết trực tiếp (hardcode) vào các file cấu hình như `docker-compose.yml` và `application.yml`.
*   **Ví dụ đời thực:** Giống như việc bạn viết mật khẩu két sắt hay mã PIN thẻ ATM dán ngay trước cửa nhà. Bất kỳ ai nhìn thấy source code (khi đưa lên GitHub) đều có thể đánh cắp dữ liệu.
*   **Cách giải quyết:**
    *   Tạo ra một file tên là `.env` đóng vai trò như một "chiếc hộp khóa kín" chứa toàn bộ mật khẩu.
    *   Cấu hình Docker và Spring Boot để "đọc" từ chiếc hộp này.
    *   File `.env` được đưa vào `.gitignore` để KHÔNG BAO GIỜ bị đẩy lên mạng. Mã nguồn lúc này chỉ chứa lệnh: *"Hãy lấy mật khẩu từ biến môi trường"*.

### 2. Chuẩn hóa Exception Handling (Xử lý lỗi)

*   **Vấn đề cũ:** Service layer (tầng xử lý logic) ném ra quá nhiều lỗi `RuntimeException` chung chung (đặc biệt trong các tính năng quản lý nhóm). Điều này khiến API luôn trả về lỗi 500 mơ hồ, Frontend không biết nguyên nhân gốc rễ là gì để thông báo cho người dùng.
*   **Ví dụ đời thực:** Khách hàng ăn phở thấy có con ruồi, gọi bồi bàn hỏi. Bồi bàn chỉ đáp: *"Dạ có lỗi xảy ra"* rồi bỏ đi. Khách hàng cực kỳ ức chế vì không nhận được lời giải thích thỏa đáng.
*   **Cách giải quyết:**
    *   Tạo Enum `ErrorCode` để quy chuẩn hóa mọi lỗi thành các mã dễ hiểu (ví dụ: `USER_NOT_FOUND`, `GROUP_FULL`).
    *   Triển khai `@RestControllerAdvice` (GlobalExceptionHandler). Đây là một "Bộ phận chăm sóc khách hàng" chuyên tự động bắt các lỗi do hệ thống ném ra, và dịch chúng thành một chuẩn JSON thống nhất để trả về cho Frontend xử lý.

### 3. Sửa lỗi Healthcheck cho Notification Service

*   **Vấn đề cũ:** Docker liên tục khởi động lại `notification-service` vì nghĩ rằng nó đã bị crash (chết). Lý do là service này làm nhiệm vụ chạy ngầm (Kafka worker) và không mở cổng Web/HTTP, nên các lệnh ping HTTP thông thường của Docker đều thất bại.
*   **Ví dụ đời thực:** Một anh bảo vệ làm việc trong kho, không có bộ đàm. Quản lý đứng ở cửa gọi tên anh ta (ping), không thấy thưa nên tưởng anh ta đã trốn việc, liền sa thải và tuyển người mới (restart service).
*   **Cách giải quyết:** Đổi phương thức kiểm tra. Thay vì gọi hỏi (HTTP), Docker sẽ dùng lệnh `pgrep -f 'java'` để kiểm tra trực tiếp xem tiến trình (process) của anh bảo vệ có đang chạy (nhúc nhích) hay không.

### 4. Idempotency (Chống trùng tin nhắn cho Consumer Kafka)

*   **Vấn đề cũ:** Khi Kafka gặp độ trễ mạng hoặc gửi lại (retry) tin nhắn cho Consumer, hoặc khi có nhiều server cùng chạy song song, tin nhắn dễ bị xử lý 2 lần, dẫn đến việc lưu trùng lặp tin nhắn vào MongoDB.
*   **Ví dụ đời thực:** Bạn nhờ bưu tá giao 1 bức thư. Do đường tắc, bạn tưởng thư chưa tới nên nhờ giao thêm 1 lần nữa. Kết quả người nhận nhận được 2 bức thư y hệt nhau.
*   **Cách giải quyết:**
    *   Áp dụng tính năng *Deduplication* bằng Redis `SETNX` (Set if Not eXists).
    *   Redis đóng vai trò như một "cuốn sổ ghi danh sách đã xử lý". Trước khi lưu tin nhắn mới vào DB, hệ thống sẽ mở sổ ra xem mã tin nhắn này đã xuất hiện trong 5 phút qua chưa. Nếu rồi thì bỏ qua không lưu nữa, chỉ gửi Broadcast qua WebSocket để đảm bảo Realtime.

---

## 🏗️ Phase 2: Tái cấu trúc Code (Refactoring)

Mục tiêu của Phase này là chia nhỏ cấu trúc code để dễ bảo trì, dễ mở rộng, và loại bỏ sự chồng chéo logic giữa các service.

### 5. Áp dụng Strategy Pattern cho WebSocket

*   **Vấn đề cũ:** File `ChatWebSocketHandler.java` là một "God Class" (Lớp làm mọi thứ). Nó chứa hàng chục khối `if-else` khổng lồ để xử lý PING, CHAT, READ_RECEIPT, WEBRTC, CALL_SIGNAL. Code rất dài, rối rắm và vi phạm nguyên tắc **Open/Closed Principle** (khi muốn thêm tính năng mới phải sửa trực tiếp vào file này, dễ làm hỏng tính năng cũ).
*   **Ví dụ đời thực:** Giống như một cái công tắc đa năng khổng lồ điều khiển cả tivi, quạt, tủ lạnh, máy sưởi. Dây điện bên trong chằng chịt. Mỗi lần sửa dây quạt là dễ làm đứt luôn dây tivi.
*   **Cách giải quyết:**
    *   Tách mỗi chức năng ra thành một class độc lập (các "ổ cắm" riêng biệt) thông qua Interface `WsMessageStrategy` (PingStrategy, CallSignalStrategy...).
    *   Sử dụng Spring Dependency Injection để tự động gom nhóm các Strategy này. Giờ đây, Handler trung tâm chỉ làm nhiệm vụ "chuyển phát nhanh": Nhìn vào loại tin nhắn và giao cho Strategy tương ứng xử lý.

### 6. Tập trung Presence Logic (Single Source of Truth)

*   **Vấn đề cũ:** Trong kiến trúc cũ, cả `chat-service` (khi kết nối WebSocket) và `presence-service` (API) đều tự ý ghi đè dữ liệu Online/Offline của người dùng lên Redis. Khi hệ thống có độ trễ, việc 2 bên tranh nhau ghi dữ liệu gây ra hiện tượng **Race Condition** (dữ liệu đá nhau).
*   **Ví dụ đời thực:** Hai người cùng có chìa khóa để lật tấm bảng "Đóng/Mở cửa" của cửa hàng. Người A vừa lật "Mở", người B chạy tới lật "Đóng" khiến khách hàng (Frontend) không biết đường nào mà lần.
*   **Cách giải quyết:**
    *   Áp dụng nguyên tắc **Single Source of Truth** (Một nguồn chân lý duy nhất).
    *   Tước quyền ghi dữ liệu Presence của `chat-service`. Giờ `chat-service` chỉ có nhiệm vụ bắn sự kiện Kafka: *"Này anh Presence Service, có người dùng A vừa online nhé"*.
    *   Chỉ duy nhất `presence-service` (nhờ `PresenceEventConsumer.java` mới được tạo) mới được quyền đọc sự kiện này và cập nhật trạng thái lên Redis. Mọi thứ trở nên trật tự và đồng nhất.
