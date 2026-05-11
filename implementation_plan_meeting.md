# Meeting Feature Implementation Plan

## 1. Mục tiêu

Triển khai lại tính năng gọi họp theo hướng ổn định và phù hợp với nhu cầu thực tế của project:

- Mobile app vẫn là nơi khởi tạo, nhận và điều phối cuộc họp.
- Cuộc họp media thật dùng Jitsi để giảm độ phức tạp WebRTC native.
- Người dùng có thể chuyển cuộc họp từ mobile sang một web desktop tối giản để dễ quan sát và chia sẻ màn hình.
- Tách hẳn `meeting signaling` khỏi `chat message`, không dùng chung DTO hoặc luồng Kafka chat hiện tại.

## 2. Phạm vi của phase này

Phase này chỉ giải quyết:

- gọi 1-1
- nhận cuộc gọi trên mobile
- accept / reject / end cuộc gọi
- mở cùng một phòng Jitsi từ 2 thiết bị
- tạo handoff link từ mobile để mở cuộc họp trên desktop web

Phase này chưa giải quyết:

- group meeting hoàn chỉnh
- call history / missed call
- push notification khi app background hoặc app bị kill
- nhiều session đồng thời cho cùng 1 user
- embedded Jitsi UI tùy biến sâu

## 3. Quyết định kiến trúc

### 3.1. Media engine

- Không tiếp tục làm WebRTC native custom.
- Dùng Jitsi Meet làm media engine cho cả mobile và desktop.
- App chỉ làm signaling và handoff.

### 3.2. Signaling

- Signaling đi qua WebSocket hiện có của `chat-service`.
- Tạo contract mới `CALL_SIGNAL`, không reuse `ChatMessageDto`.
- Không đưa signaling meeting vào Kafka pipeline của chat.
- Signaling được relay trực tiếp tới WebSocket session đích.

### 3.3. Meeting state

- Không dùng in-memory store nếu vẫn giữ khả năng multi-instance.
- Meeting session và handoff token phải nằm ở shared store.
- Trong phase này dùng Redis là hợp lý nhất vì project đã có Redis và `chat-service` đã có dependency Redis.

### 3.4. Desktop web

- Không tạo route kiểu static `/meeting/join/{token}` nếu không có controller forward.
- Dùng 1 trang desktop web tối giản serve từ `chat-service`.
- Desktop join URL nên theo dạng:
  - `/meeting/join?token=<handoffToken>`
- Cách này tránh lỗi mapping static path với token động.

### 3.5. Frontend WebSocket

- Chỉ duy trì 1 WebSocket dùng chung cho phần authenticated app.
- `WebSocketProvider` phải nằm ngoài navigator tree hoặc trong authenticated shell hợp lệ, không chèn trực tiếp làm child của `Stack.Navigator`.
- Incoming call không được phụ thuộc vào `ChatScreen`.
- Phải có một listener toàn cục ở cấp authenticated app để nhận `CALL_INVITE` từ mọi màn hình.

## 4. Luồng nghiệp vụ đích

### 4.1. Gọi cuộc họp từ mobile

1. User A bấm gọi từ `ChatScreen`.
2. Mobile gửi `CALL_INVITE` qua WebSocket.
3. Backend tạo `meeting session` với `meetingId` và `roomName`.
4. Backend relay `CALL_INVITE` tới user B.
5. Mobile B hiện popup nhận cuộc gọi.

### 4.2. Chấp nhận cuộc gọi

1. User B bấm accept.
2. Mobile B gửi `CALL_ACCEPT`.
3. Backend cập nhật `meeting session` sang `ACTIVE`.
4. Backend relay `CALL_ACCEPT` về user A.
5. Cả 2 bên mở cùng một Jitsi room.

### 4.3. Chuyển sang desktop

1. Trong `MeetingScreen`, user bấm `Mở trên máy tính`.
2. Mobile gọi REST API tạo `handoff token`.
3. Backend sinh token ngắn hạn, bind với meeting và user hiện tại.
4. Mobile hiển thị link hoặc QR code.
5. Desktop mở `/meeting/join?token=...`.
6. Trang web gọi API resolve token.
7. Backend xác thực token và trả về `meetingId`, `roomName`, `jitsiUrl`.
8. Desktop gọi callback `device-joined` về backend.
9. Backend phát `DEVICE_JOINED` cho mobile liên quan.
10. Desktop mở Jitsi room.

### 4.4. Kết thúc cuộc họp

1. Một bên gửi `CALL_END`.
2. Backend cập nhật trạng thái meeting `ENDED`.
3. Backend relay event kết thúc tới bên còn lại.
4. Mobile đóng màn hình họp.

### 4.5. Vòng đời soft-state của meeting

Vì media chạy ở Jitsi ngoài app, backend không thể coi trạng thái meeting là tuyệt đối chính xác. Phase này phải chấp nhận mô hình `soft-state`:

- nếu `CALL_INVITE` không được `CALL_ACCEPT` trong một khoảng timeout, meeting tự hết hạn
- nếu handoff token được tạo nhưng không dùng trong thời gian ngắn, token tự hết hạn
- nếu meeting đã `ACTIVE` nhưng không còn activity từ app trong một khoảng thời gian đủ lớn, meeting được cleanup nền
- việc user đóng tab Jitsi hoặc rời Jitsi trực tiếp không phải lúc nào cũng phản ánh ngay vào backend

Do đó:

- `CALL_END` là tín hiệu chủ động từ app
- không phải nguồn sự thật tuyệt đối cho media session thực tế trên Jitsi

## 5. Thiết kế dữ liệu signaling và meeting

### 5.1. CallSignalType

Tạo enum:

- `CALL_INVITE`
- `CALL_ACCEPT`
- `CALL_REJECT`
- `CALL_END`
- `HANDOFF_REQUEST`
- `HANDOFF_READY`
- `DEVICE_JOINED`
- `DEVICE_LEFT`

### 5.2. CallSignalDto

Tạo DTO riêng cho signaling:

- `type`: luôn là `CALL_SIGNAL`
- `signalType`
- `meetingId`
- `roomName`
- `senderId`
- `senderName`
- `receiverId`
- `timestamp`

Ghi chú:

- `senderId` không lấy từ client gửi lên như nguồn sự thật.
- Backend sẽ override `senderId` từ user đã xác thực trong WebSocket session.

### 5.3. MeetingSession

Meeting session cần các field:

- `meetingId`
- `roomName`
- `hostUserId`
- `participantUserIds`
- `status`
- `createdAt`
- `updatedAt`

### 5.4. HandoffToken

Handoff token cần:

- `token`
- `meetingId`
- `userId`
- `expiresAt`
- `consumedAt` hoặc trạng thái tương đương nếu muốn theo dõi vòng đời token

Không được:

- để token sống vô hạn
- nhận `userId` từ query param như nguồn sự thật

Semantics của token trong phase này:

- `resolve token` dùng để validate token và lấy thông tin meeting
- `resolve token` không nên làm token mất hiệu lực ngay lập tức
- token chỉ nên bị đánh dấu đã dùng khi desktop thực sự gọi callback `device-joined`, hoặc phải có một replay window ngắn để chịu được refresh / prefetch
- nếu browser refresh lại trong thời gian rất ngắn sau khi resolve, flow vẫn phải hoạt động được

## 6. Backend implementation plan

### 6.1. DTO và model mới

Tạo mới:

- [backend/chat-service/src/main/java/com/iuhconnect/chatservice/dto/CallSignalType.java](D:/Study/KienTruc/BaiTapLon/backend/chat-service/src/main/java/com/iuhconnect/chatservice/dto/CallSignalType.java)
- [backend/chat-service/src/main/java/com/iuhconnect/chatservice/dto/CallSignalDto.java](D:/Study/KienTruc/BaiTapLon/backend/chat-service/src/main/java/com/iuhconnect/chatservice/dto/CallSignalDto.java)
- [backend/chat-service/src/main/java/com/iuhconnect/chatservice/model/MeetingStatus.java](D:/Study/KienTruc/BaiTapLon/backend/chat-service/src/main/java/com/iuhconnect/chatservice/model/MeetingStatus.java)
- [backend/chat-service/src/main/java/com/iuhconnect/chatservice/model/MeetingSession.java](D:/Study/KienTruc/BaiTapLon/backend/chat-service/src/main/java/com/iuhconnect/chatservice/model/MeetingSession.java)
- [backend/chat-service/src/main/java/com/iuhconnect/chatservice/dto/HandoffTokenResponse.java](D:/Study/KienTruc/BaiTapLon/backend/chat-service/src/main/java/com/iuhconnect/chatservice/dto/HandoffTokenResponse.java)
- [backend/chat-service/src/main/java/com/iuhconnect/chatservice/dto/MeetingJoinInfoResponse.java](D:/Study/KienTruc/BaiTapLon/backend/chat-service/src/main/java/com/iuhconnect/chatservice/dto/MeetingJoinInfoResponse.java)

### 6.2. Meeting store dùng Redis

Tạo service mới:

- [backend/chat-service/src/main/java/com/iuhconnect/chatservice/service/MeetingSessionService.java](D:/Study/KienTruc/BaiTapLon/backend/chat-service/src/main/java/com/iuhconnect/chatservice/service/MeetingSessionService.java)

Trách nhiệm:

- tạo meeting
- lấy meeting theo `meetingId`
- accept meeting
- reject / end meeting
- tạo handoff token có TTL
- resolve token

Triển khai:

- dùng `StringRedisTemplate`
- serialize `MeetingSession` bằng JSON
- key ví dụ:
  - `meeting:session:{meetingId}`
  - `meeting:handoff:{token}`

TTL đề xuất:

- `meeting:handoff:{token}`: 300 giây
- `meeting:session:{meetingId}`: có thể 12-24 giờ hoặc cleanup sau khi `ENDED`

### 6.3. Call signaling service

Tạo:

- [backend/chat-service/src/main/java/com/iuhconnect/chatservice/service/CallSignalService.java](D:/Study/KienTruc/BaiTapLon/backend/chat-service/src/main/java/com/iuhconnect/chatservice/service/CallSignalService.java)

Trách nhiệm:

- validate payload call signal
- tạo `meetingId` và `roomName` khi invite
- update `MeetingSessionService`
- relay signal tới receiver
- phát event `DEVICE_JOINED` nếu desktop join thành công
- áp dụng timeout / cleanup rule cho meeting soft-state

Nguyên tắc:

- nếu receiver đang online ở local session thì gửi trực tiếp
- nếu receiver ở instance khác thì vẫn dùng `PresenceService` + Redis signaling như codebase hiện tại
- không dùng Kafka chat topic cho call signal

### 6.4. Sửa ChatWebSocketHandler

Sửa file:

- [backend/chat-service/src/main/java/com/iuhconnect/chatservice/handler/ChatWebSocketHandler.java](D:/Study/KienTruc/BaiTapLon/backend/chat-service/src/main/java/com/iuhconnect/chatservice/handler/ChatWebSocketHandler.java)

Việc cần làm:

- parse payload thành `JsonNode`
- xác định `type`
- nếu `type == "CALL_SIGNAL"`:
  - lấy `senderId` từ authenticated session
  - map sang `CallSignalDto`
  - gọi `CallSignalService`
- nếu không phải `CALL_SIGNAL`:
  - giữ nguyên luồng chat hiện tại

Không để:

- `CALL_SIGNAL` bị map vào `ChatMessageDto`
- client tự quyết định `senderId`

### 6.5. Sửa SignalingRedisSubscriber

Sửa file:

- [backend/chat-service/src/main/java/com/iuhconnect/chatservice/handler/SignalingRedisSubscriber.java](D:/Study/KienTruc/BaiTapLon/backend/chat-service/src/main/java/com/iuhconnect/chatservice/handler/SignalingRedisSubscriber.java)

Việc cần làm:

- parse `JsonNode` trước
- nếu `CALL_SIGNAL` thì deserialize bằng `CallSignalDto`
- nếu legacy `WEBRTC` còn tồn tại thì tạm hỗ trợ trong giai đoạn chuyển đổi

### 6.6. Meeting REST API

Tạo controller:

- [backend/chat-service/src/main/java/com/iuhconnect/chatservice/controller/MeetingController.java](D:/Study/KienTruc/BaiTapLon/backend/chat-service/src/main/java/com/iuhconnect/chatservice/controller/MeetingController.java)

Endpoints:

- `POST /api/v1/meetings/{meetingId}/handoff-token`
- `GET /api/v1/meetings/handoff/{token}`
- `POST /api/v1/meetings/{meetingId}/device-joined`

Yêu cầu bảo mật:

- `POST /handoff-token` phải lấy user hiện tại từ JWT principal, không nhận `userId` từ query param như nguồn sự thật
- backend phải kiểm tra user đó có thuộc meeting không
- `POST /device-joined` phải xác thực token hoặc meeting context đủ chặt để không ai giả mạo desktop join

`meetingUrl` trả về nên là:

- `/meeting/join?token=<handoffToken>`

không phải:

- `/meeting/join/<handoffToken>`

Quy ước lifecycle của token:

- `GET /handoff/{token}`: validate + trả dữ liệu join, không tiêu thụ token ngay
- `POST /{meetingId}/device-joined`: xác nhận desktop đã dùng token thành công
- token có TTL ngắn, ví dụ 5 phút
- nếu cần, sau `device-joined` có thể đánh dấu token đã dùng để ngăn reuse kéo dài

### 6.7. Gateway route

Sửa:

- [backend/api-gateway/src/main/resources/application.yml](D:/Study/KienTruc/BaiTapLon/backend/api-gateway/src/main/resources/application.yml)

Thêm route:

- `/api/v1/meetings/**` -> `chat-service`
- `/meeting/**` -> `chat-service`

### 6.8. Desktop web tối giản

Tạo:

- [backend/chat-service/src/main/resources/static/meeting/join/index.html](D:/Study/KienTruc/BaiTapLon/backend/chat-service/src/main/resources/static/meeting/join/index.html)

Trang này sẽ:

- đọc token từ query string `?token=...`
- gọi `GET /api/v1/meetings/handoff/{token}`
- sau khi resolve thành công, gọi `POST /api/v1/meetings/{meetingId}/device-joined`
- render nút mở Jitsi

Không dùng path token động trong phase này.

## 7. Frontend mobile implementation plan

### 7.1. Tạo WebSocketProvider

Tạo:

- [frontend/src/services/WebSocketProvider.tsx](D:/Study/KienTruc/BaiTapLon/frontend/src/services/WebSocketProvider.tsx)

Mục tiêu:

- chỉ có 1 WebSocket dùng chung cho toàn app đã authenticated
- cho phép `addListener/removeListener`
- quản lý reconnect

Ngoài provider, cần thêm một tầng điều phối global incoming call:

- `IncomingCallCoordinator` hoặc component tương đương
- component này subscribe `CALL_SIGNAL` ở cấp app
- nếu nhận `CALL_INVITE`, nó hiển thị popup toàn cục và điều hướng vào `MeetingScreen`
- không để logic nhận cuộc gọi chỉ sống trong `ChatScreen`

Yêu cầu sửa so với plan cũ:

- `WebSocketProvider` phải đặt ngoài `Stack.Navigator` hoặc trong một authenticated shell component hợp lệ
- không chèn `Provider` trực tiếp như child xen giữa các `Stack.Screen`

### 7.2. Tạo callSignaling helper

Tạo:

- [frontend/src/services/callSignaling.ts](D:/Study/KienTruc/BaiTapLon/frontend/src/services/callSignaling.ts)

Bao gồm:

- type guard `isCallSignal`
- builder cho:
  - `CALL_INVITE`
  - `CALL_ACCEPT`
  - `CALL_REJECT`
  - `CALL_END`

### 7.3. Tạo meetingApi

Tạo:

- [frontend/src/services/meetingApi.ts](D:/Study/KienTruc/BaiTapLon/frontend/src/services/meetingApi.ts)

Bao gồm:

- `createHandoffToken(meetingId, token)`

Lưu ý:

- không gửi `userId` nếu backend đã lấy user từ JWT

### 7.4. Sửa navigation types

Sửa:

- [frontend/src/types/types.ts](D:/Study/KienTruc/BaiTapLon/frontend/src/types/types.ts)

Việc cần làm:

- đổi route `VideoCall` thành `Meeting`
- thêm params:
  - `callerId`
  - `callerName`
  - `callerAvatar?`
  - `isIncoming?`
  - `roomName?`
  - `meetingId?`

### 7.5. Refactor ChatScreen

Sửa:

- [frontend/src/screens/ChatScreen.tsx](D:/Study/KienTruc/BaiTapLon/frontend/src/screens/ChatScreen.tsx)

Việc cần làm:

- bỏ WebSocket riêng của màn chat
- dùng `useWebSocket()`
- chat message thường vẫn append như cũ

Nút video call:

- từ `ChatScreen` bấm gọi sẽ `navigate('Meeting', ...)`
- không tự mở Jitsi từ `ChatScreen`

Lưu ý:

- `ChatScreen` có thể bỏ hoàn toàn trách nhiệm nhận incoming call
- incoming call nên được xử lý ở global coordinator
- `ChatScreen` chỉ còn trách nhiệm khởi tạo outgoing meeting từ context của cuộc chat

### 7.6. Tạo MeetingScreen

Tạo mới:

- [frontend/src/screens/MeetingScreen.tsx](D:/Study/KienTruc/BaiTapLon/frontend/src/screens/MeetingScreen.tsx)

Khuyến nghị:

- copy logic UI hữu ích từ `VideoCallScreen.tsx`
- nhưng bỏ toàn bộ logic signaling tự mở socket riêng

Trách nhiệm của `MeetingScreen`:

- gửi `CALL_INVITE` nếu là caller
- gửi `CALL_ACCEPT` nếu là callee
- nhận `CALL_ACCEPT`, `CALL_REJECT`, `CALL_END`
- nhận trạng thái `DEVICE_JOINED` nếu cần hiển thị "Đã kết nối trên máy tính"
- mở Jitsi room
- nút `Mở trên máy tính`
- nút `Kết thúc`

### 7.7. Thêm handoff UI

Nếu muốn hiển thị QR/link đẹp hơn:

- tạo [frontend/src/components/MeetingHandoffModal.tsx](D:/Study/KienTruc/BaiTapLon/frontend/src/components/MeetingHandoffModal.tsx)

Option:

- vòng đầu chỉ hiển thị link để copy
- vòng sau thêm QR code

Khi desktop join thành công:

- mobile nên hiển thị trạng thái như `Đã kết nối trên máy tính`
- đây là trạng thái nhận từ callback `device-joined`, không suy đoán từ việc token đã được tạo

### 7.8. Sửa App.tsx

Sửa:

- [frontend/App.tsx](D:/Study/KienTruc/BaiTapLon/frontend/App.tsx)

Việc cần làm:

- import `WebSocketProvider`
- import `MeetingScreen`
- authenticated subtree phải được bọc bởi `WebSocketProvider`
- route `VideoCall` đổi thành `Meeting`

Khuyến nghị cấu trúc:

- `WebSocketProvider` bọc ngoài `NavigationContainer`
- hoặc bọc ngoài authenticated branch nhưng vẫn phải giữ tree hợp lệ

## 8. Cleanup plan

### 8.1. Cleanup backend

Sau khi flow mới ổn định:

- bỏ branch `WEBRTC` cũ trong [ChatWebSocketHandler.java](D:/Study/KienTruc/BaiTapLon/backend/chat-service/src/main/java/com/iuhconnect/chatservice/handler/ChatWebSocketHandler.java)
- xóa [backend/chat-service/src/main/java/com/iuhconnect/chatservice/dto/WebRTCSignalingMessage.java](D:/Study/KienTruc/BaiTapLon/backend/chat-service/src/main/java/com/iuhconnect/chatservice/dto/WebRTCSignalingMessage.java) nếu không còn dùng

### 8.2. Cleanup frontend

- xóa [frontend/src/screens/VideoCallScreen.tsx](D:/Study/KienTruc/BaiTapLon/frontend/src/screens/VideoCallScreen.tsx) sau khi `MeetingScreen` thay thế hoàn chỉnh
- bỏ logic signaling ad-hoc còn sót trong `ChatScreen`

## 9. Test plan

### Milestone 1: signaling ổn định

- Mobile A gửi `CALL_INVITE`
- Mobile B nhận popup từ bất kỳ màn hình nào trong authenticated app
- Bấm reject thì A nhận `CALL_REJECT`
- Bấm accept thì A nhận `CALL_ACCEPT`

### Milestone 2: Jitsi room hoạt động

- A và B cùng mở đúng một `roomName`
- end call hoạt động

### Milestone 3: desktop handoff

- Từ mobile tạo handoff token
- Desktop mở `/meeting/join?token=...`
- Resolve token thành công
- Desktop gọi callback `device-joined`
- Mobile nhận được trạng thái desktop joined
- Desktop mở đúng Jitsi room

### Milestone 4: cross-instance

- Nếu có nhiều instance `chat-service`
- signaling và handoff vẫn hoạt động do meeting state nằm trong Redis

## 10. Rủi ro còn lại

- `WebSocketSessionManager` hiện vẫn thiên về 1 session / 1 user; nếu cùng 1 user mở nhiều thiết bị thì cần mở rộng sau
- app đang chạy trên Android thật và emulator nên cần test kỹ `WS_URL`, `API_URL`, LAN IP
- Jitsi mở bằng external browser/deep link nên UX không hoàn toàn native
- chưa có missed call khi app nền hoặc app tắt
- trạng thái rời cuộc họp từ phía Jitsi browser có thể không phản ánh ngay về app/backend

## 11. Thứ tự triển khai khuyến nghị

1. Backend DTO + MeetingSessionService dùng Redis
2. Backend `CallSignalService`
3. Backend sửa `ChatWebSocketHandler` và `SignalingRedisSubscriber`
4. Backend `MeetingController` + static desktop join page
5. Frontend `WebSocketProvider` + global incoming call coordinator
6. Frontend `callSignaling.ts` + `meetingApi.ts`
7. Frontend refactor `ChatScreen`
8. Frontend tạo `MeetingScreen`
9. Frontend thêm handoff UI + desktop joined state
10. Cleanup code cũ

## 12. Definition of done

Tính năng được xem là hoàn thành khi:

- không còn dùng `ChatMessageDto` cho meeting signaling
- mobile A có thể gọi mobile B
- mobile B có thể accept / reject
- mobile B có thể nhận incoming call dù đang ở ngoài `ChatScreen`
- cả 2 mở được cùng phòng Jitsi
- mobile có thể tạo handoff link
- desktop web có thể join đúng cuộc họp từ handoff token
- mobile nhận được tín hiệu desktop đã join nếu callback thành công
- code cũ kiểu `WEBRTC` ad-hoc không còn là luồng chính
