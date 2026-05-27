# Implementing React Native Frontend for Service Testing

Dựa vào các [README.md](file:///d:/Study/KienTruc/BaiTapLon/frontend/README.md) của `api-gateway`, `auth-service` và `chat-service`, chúng ta sẽ xây dựng một ứng dụng React Native đơn giản để test luồng hoạt động của toàn bộ hệ thống. 

## User Review Required

> [!NOTE]
> Ứng dụng này sẽ được thiết kế hướng tới việc **test** (kiểm thử) các API nên giao diện sẽ tối giản, tập trung vào việc có thể nhập cấu hình server (do Android Emulator dùng IP khác với máy tính, hoặc test trên máy thật cùng mạng LAN), đăng nhập, đăng ký và gửi tin nhắn chat realtime.
> 
> Xác nhận kế hoạch trước khi tiến hành code.

## Proposed Changes

Chúng ta sẽ chỉnh sửa ứng dụng React Native tại thư mục `frontend/` (hoặc cụ thể là [App.tsx](file:///d:/Study/KienTruc/BaiTapLon/frontend/App.tsx) hoặc tạo các components tương ứng theo cấu trúc).

### React Native App (frontend)

Sẽ tạo một ứng dụng 1 màn hình đơn giản hoặc dùng state để chuyển đổi giữa màn hình Auth và màn hình Chat. Do để test sơ bộ, ta dùng state nội bộ thay vì setup React Navigation phức tạp để code chạy nhanh, trực quan và dễ debug.

#### [MODIFY] [App.tsx](file:///d:/Study/KienTruc/BaiTapLon/frontend/App.tsx)
Thay đổi toàn bộ nội dung của [App.tsx](file:///d:/Study/KienTruc/BaiTapLon/frontend/App.tsx) để bao gồm 2 phần chính:
1. **Auth View**:
   - Trường nhập `Server URL` (mặc định cho Android Emulator là `http://10.0.2.2:8080`).
   - Trường nhập `Username` và `Password`.
   - Nút `Login` (POST `/api/v1/auth/login`).
   - Nút `Register` (POST `/api/v1/auth/register`).
2. **Chat View** (sau khi login thành công có Auth Token):
   - Quản lý kết nối `WebSocket` tới `ws://<server_host>:<port>/ws/chat?token=<Token>`.
   - Trường nhập `Receiver ID` (Người nhận).
   - Trường nhập `Message Content`.
   - Nút `Send` - gửi JSON format:
     ```json
     {
       "senderId": "tên người gửi hiện tại",
       "receiverId": "người nhận",
       "content": "tin nhắn",
       "conversationId": "chuỗi kết hợp giữa 2 người",
       "timestamp": 0
     }
     ```
   - Khu vực hiển thị logs tin nhắn (cả tin nhắn nhận và gửi, cũng như các log kết nối).

## Verification Plan

### Manual Verification
1. Chạy hệ thống Backend (Gateway, Auth, Chat, Kafka, MariaDB, MongoDB, Redis) qua Docker Compose.
2. Chạy ứng dụng React Native trên Android Emulator (`npm run android` hoặc `npx react-native run-android`).
3. Dùng màn hình Auth để **Register** một hoặc hai users (VD: `userA`, `userB`).
4. **Login** với `userA`, quan sát JWT token trả về.
5. Mở Web Socket connection, gửi tin nhắn từ `userA` sang `userB` và theo dõi logs hiển thị tin nhắn được gửi đi, sau đó được phản hồi về màn hình của `userA` (do cơ chế multi-device sync của Redis).
