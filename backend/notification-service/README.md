# Notification Service

Service này là một **Background Worker** thuần túy trong kiến trúc:
- Trực tiếp Consume (lắng nghe) Kafka Topic `chat-messages`.
- Trích xuất message và gửi Push Notification xuống các thiết bị di động/web thông qua **Firebase Cloud Messaging (FCM)**.
- **KHÔNG** mở bất cứ port REST API nào (`spring.main.web-application-type=none`). Do đó, service này cực kỳ nhẹ và có thể thiết lập Auto Scaling dựa vào độ dài hàng chờ Kafka.
