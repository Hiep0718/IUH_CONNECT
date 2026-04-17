# Presence Service

Service này thuộc khối **Backend** của IUH Connect. Nhiệm vụ duy nhất của Service này trong Kiến trúc Hệ thống là:
1. Tiếp nhận kết nối WebSocket từ Client (thường là kết nối ngầm/Ping-pong).
2. Khi Client connect thành công -> Ghi thông tin User Online vào Database **Redis** -> Bắn sự kiện `USER_ONLINE` lên Kafka.
3. Khi Client mất kết nối (Disconnect) -> Cập nhật trạng thái Offline trong **Redis** -> Bắn sự kiện `USER_OFFLINE` lên Kafka.
4. Cung cấp API nội bộ cho các service khác (nếu cần) hỏi xem User A đang Online hay Offline thông qua Redis.

*Tuyệt đối không nhồi nhét logic chat vào service này.*
