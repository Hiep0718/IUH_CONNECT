# Chat Service

Service này thuộc khối **Backend** của IUH Connect, chịu trách nhiệm xử lý các tác vụ liên quan đến Nhắn tin.

## Kiến trúc Mới (Đã Refactor)
1. **Database:** `MongoDB`. Toàn bộ dữ liệu Chat (Cấu trúc Message, Conversation) đều nằm tại đây để tối ưu IOPS cực cao.
2. **Real-time Engine:** Cấu hình bằng Spring WebSocket (`/ws/chat`). 
3. **No-Redis Rule:** Gỡ bỏ hoàn toàn `Redis`. Theo kiến trúc mới, Redis là vùng cấm của Chat Service và chỉ ưu tiên cho Gateway/Presence Service.
4. **Broadcast Architecture (Kafka):** Khi node "Chat Service A" nhận 1 tin nhắn WebSocket, nó lập tức đẩy vào topic `chat-messages` lên Kafka. Mỗi node Chat Service (B, C, D) đều được cấu hình với **Auto-generated Consumer Group ID**. Điều này biến Kafka thành một luồng Broadcast thực thụ: TẤT CẢ các node Chat Service đều sẽ nhận được message đó, sau đó mỗi node tự check xem ID người nhận có đang cắm WebSocket Session trên node mình hay không, nếu có thì Push xuống.
5. **Pre-signed URL for File Upload:** Backend không thiết kế API dạng `multipart/form-data` để nhận gửi file, việc đó gây thắt cổ chai. Sinh viên cần gửi file -> Gọi API `/api/v1/files/presigned-url` -> Chat Service sinh ra link từ `MinIO` -> Trả về Client -> Client bốc dỡ file trực tiếp vào MinIO.
6. **Synchronous Call:** Bổ sung `OpenFeign` để gọi API User Service lấy data tức thời khi cần thiết. Tuy nhiên, luồng cũ đồng bộ User qua Event `UserEventConsumer` vẫn được giữ nguyên.
