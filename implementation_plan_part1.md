# Meeting Feature Implementation Plan — Part 1: Backend

## Quyết định kiến trúc
- **WS**: Mount 1 WS duy nhất ở cấp `App.tsx`, truyền qua React Context
- **Multi-session**: Hoãn, giữ 1 session/user
- **Desktop web**: 1 file HTML tĩnh serve từ Spring Boot
- **Room name**: Giữ pattern `IUHConnect_{id}_{timestamp}`

---

## BƯỚC 1: Thêm CallSignalType enum

**File**: `backend/chat-service/src/main/java/com/iuhconnect/chatservice/dto/CallSignalType.java`

```java
package com.iuhconnect.chatservice.dto;

public enum CallSignalType {
    CALL_INVITE,
    CALL_ACCEPT,
    CALL_REJECT,
    CALL_END,
    HANDOFF_REQUEST,
    HANDOFF_READY,
    DEVICE_JOINED,
    DEVICE_LEFT
}
```

## BƯỚC 2: Thêm CallSignalDto

**File**: `backend/chat-service/src/main/java/com/iuhconnect/chatservice/dto/CallSignalDto.java`

```java
package com.iuhconnect.chatservice.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.*;

@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class CallSignalDto {
    private String type;           // luôn = "CALL_SIGNAL"
    private String signalType;     // enum CallSignalType as string
    private String meetingId;
    private String roomName;
    private String senderId;
    private String senderName;
    private String receiverId;
    private long timestamp;
}
```

## BƯỚC 3: Thêm MeetingStatus enum

**File**: `backend/chat-service/src/main/java/com/iuhconnect/chatservice/model/MeetingStatus.java`

```java
package com.iuhconnect.chatservice.model;

public enum MeetingStatus {
    INVITING, RINGING, ACTIVE, ENDED
}
```

## BƯỚC 4: Thêm MeetingSession model

**File**: `backend/chat-service/src/main/java/com/iuhconnect/chatservice/model/MeetingSession.java`

```java
package com.iuhconnect.chatservice.model;

import lombok.*;
import java.util.*;

@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class MeetingSession {
    private String meetingId;
    private String roomName;
    private String hostUserId;
    private Set<String> participantUserIds;
    private MeetingStatus status;
    private long createdAt;
    private Map<String, String> handoffTokens; // token -> userId
}
```

## BƯỚC 5: Thêm MeetingSessionService

**File**: `backend/chat-service/src/main/java/com/iuhconnect/chatservice/service/MeetingSessionService.java`

```java
package com.iuhconnect.chatservice.service;

import com.iuhconnect.chatservice.model.*;
import org.springframework.stereotype.Service;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class MeetingSessionService {

    private final ConcurrentHashMap<String, MeetingSession> meetings = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, String> handoffTokenToMeetingId = new ConcurrentHashMap<>();

    public MeetingSession createMeeting(String hostUserId, String roomName) {
        String meetingId = UUID.randomUUID().toString();
        MeetingSession session = MeetingSession.builder()
                .meetingId(meetingId)
                .roomName(roomName)
                .hostUserId(hostUserId)
                .participantUserIds(ConcurrentHashMap.newKeySet())
                .status(MeetingStatus.INVITING)
                .createdAt(System.currentTimeMillis())
                .handoffTokens(new ConcurrentHashMap<>())
                .build();
        session.getParticipantUserIds().add(hostUserId);
        meetings.put(meetingId, session);
        return session;
    }

    public MeetingSession acceptMeeting(String meetingId, String userId) {
        MeetingSession session = meetings.get(meetingId);
        if (session != null && session.getStatus() != MeetingStatus.ENDED) {
            session.getParticipantUserIds().add(userId);
            session.setStatus(MeetingStatus.ACTIVE);
        }
        return session;
    }

    public MeetingSession endMeeting(String meetingId) {
        MeetingSession session = meetings.get(meetingId);
        if (session != null) {
            session.setStatus(MeetingStatus.ENDED);
        }
        return session;
    }

    public String createHandoffToken(String meetingId, String userId) {
        String token = UUID.randomUUID().toString();
        MeetingSession session = meetings.get(meetingId);
        if (session != null) {
            session.getHandoffTokens().put(token, userId);
            handoffTokenToMeetingId.put(token, meetingId);
        }
        return token;
    }

    public MeetingSession consumeHandoffToken(String token) {
        String meetingId = handoffTokenToMeetingId.remove(token);
        if (meetingId == null) return null;
        MeetingSession session = meetings.get(meetingId);
        if (session != null) {
            session.getHandoffTokens().remove(token);
        }
        return session;
    }

    public MeetingSession getMeeting(String meetingId) {
        return meetings.get(meetingId);
    }
}
```

## BƯỚC 6: Thêm CallSignalService

**File**: `backend/chat-service/src/main/java/com/iuhconnect/chatservice/service/CallSignalService.java`

```java
package com.iuhconnect.chatservice.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.iuhconnect.chatservice.dto.CallSignalDto;
import com.iuhconnect.chatservice.handler.WebSocketSessionManager;
import com.iuhconnect.chatservice.model.MeetingSession;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

@Service
public class CallSignalService {

    private static final Logger log = LoggerFactory.getLogger(CallSignalService.class);

    private final WebSocketSessionManager sessionManager;
    private final MeetingSessionService meetingSessionService;
    private final PresenceService presenceService;
    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;

    public CallSignalService(WebSocketSessionManager sessionManager,
                             MeetingSessionService meetingSessionService,
                             PresenceService presenceService,
                             StringRedisTemplate redisTemplate,
                             ObjectMapper objectMapper) {
        this.sessionManager = sessionManager;
        this.meetingSessionService = meetingSessionService;
        this.presenceService = presenceService;
        this.redisTemplate = redisTemplate;
        this.objectMapper = objectMapper;
    }

    public void handleSignal(CallSignalDto signal) {
        String signalType = signal.getSignalType();
        log.info("📡 Call Signal [type={}, from={}, to={}]", signalType, signal.getSenderId(), signal.getReceiverId());

        switch (signalType) {
            case "CALL_INVITE":
                handleInvite(signal);
                break;
            case "CALL_ACCEPT":
                handleAccept(signal);
                break;
            case "CALL_REJECT":
            case "CALL_END":
                handleEndOrReject(signal);
                break;
            default:
                relaySignal(signal);
        }
    }

    private void handleInvite(CallSignalDto signal) {
        // Tạo meeting session
        String roomName = signal.getRoomName();
        if (roomName == null || roomName.isEmpty()) {
            roomName = "IUHConnect_" + signal.getSenderId() + "_" + System.currentTimeMillis();
            signal.setRoomName(roomName);
        }
        MeetingSession meeting = meetingSessionService.createMeeting(signal.getSenderId(), roomName);
        signal.setMeetingId(meeting.getMeetingId());
        signal.setTimestamp(System.currentTimeMillis());
        relaySignal(signal);
    }

    private void handleAccept(CallSignalDto signal) {
        if (signal.getMeetingId() != null) {
            meetingSessionService.acceptMeeting(signal.getMeetingId(), signal.getSenderId());
        }
        relaySignal(signal);
    }

    private void handleEndOrReject(CallSignalDto signal) {
        if (signal.getMeetingId() != null) {
            meetingSessionService.endMeeting(signal.getMeetingId());
        }
        relaySignal(signal);
    }

    private void relaySignal(CallSignalDto signal) {
        try {
            String payload = objectMapper.writeValueAsString(signal);
            String receiverId = signal.getReceiverId();

            WebSocketSession receiverSession = sessionManager.getSession(receiverId);
            if (receiverSession != null && receiverSession.isOpen()) {
                receiverSession.sendMessage(new TextMessage(payload));
                log.info("✅ Call Signal delivered [to={}]", receiverId);
            } else {
                String targetInstance = presenceService.getUserInstanceId(receiverId);
                if (targetInstance != null) {
                    redisTemplate.convertAndSend("signaling:" + targetInstance, payload);
                    log.info("📡 Call Signal routed via Redis [to={}]", receiverId);
                } else {
                    log.warn("⚠️ Receiver {} offline", receiverId);
                }
            }
        } catch (Exception e) {
            log.error("❌ Failed to relay call signal: {}", e.getMessage(), e);
        }
    }
}
```

## BƯỚC 7: Sửa ChatWebSocketHandler

**File**: `backend/chat-service/src/main/java/com/iuhconnect/chatservice/handler/ChatWebSocketHandler.java`

**Thay đổi**: Thêm inject `CallSignalService`, đổi branch `"WEBRTC"` → `"CALL_SIGNAL"`, delegate xử lý cho service.

```java
// Thêm import
import com.iuhconnect.chatservice.dto.CallSignalDto;
import com.iuhconnect.chatservice.service.CallSignalService;

// Thêm field + constructor param
private final CallSignalService callSignalService;

// Trong handleTextMessage, thay khối if("WEBRTC") bằng:
if ("CALL_SIGNAL".equals(type)) {
    String senderUsername = (String) session.getAttributes().get("username");
    ((com.fasterxml.jackson.databind.node.ObjectNode) jsonNode).put("senderId", senderUsername);
    CallSignalDto signal = objectMapper.treeToValue(jsonNode, CallSignalDto.class);
    callSignalService.handleSignal(signal);
} else if ("WEBRTC".equals(type)) {
    // GIỮ LẠI tạm để backward-compatible, xóa ở GĐ7
    // ... code cũ giữ nguyên ...
} else {
    // Chat message → Kafka (giữ nguyên)
}
```

## BƯỚC 8: Sửa SignalingRedisSubscriber

**Thay đổi**: Parse `JsonNode` trước, phân nhánh theo `type`.

```java
@Override
public void onMessage(Message message, byte[] pattern) {
    try {
        String payload = new String(message.getBody());
        JsonNode jsonNode = objectMapper.readTree(payload);
        String type = jsonNode.has("type") ? jsonNode.get("type").asText() : "WEBRTC";

        String receiverId;
        if ("CALL_SIGNAL".equals(type)) {
            CallSignalDto signal = objectMapper.treeToValue(jsonNode, CallSignalDto.class);
            receiverId = signal.getReceiverId();
        } else {
            WebRTCSignalingMessage sig = objectMapper.readValue(payload, WebRTCSignalingMessage.class);
            receiverId = sig.getReceiverId();
        }

        WebSocketSession session = sessionManager.getSession(receiverId);
        if (session != null && session.isOpen()) {
            session.sendMessage(new TextMessage(payload));
        }
    } catch (IOException e) {
        log.error("❌ Failed to process signaling from Redis: {}", e.getMessage(), e);
    }
}
```

## BƯỚC 9: Thêm MeetingController + DTO responses

**File**: `backend/chat-service/src/main/java/com/iuhconnect/chatservice/dto/HandoffTokenResponse.java`

```java
package com.iuhconnect.chatservice.dto;
import lombok.*;

@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class HandoffTokenResponse {
    private String handoffToken;
    private String meetingUrl; // desktop URL to open
}
```

**File**: `backend/chat-service/src/main/java/com/iuhconnect/chatservice/dto/MeetingJoinInfoResponse.java`

```java
package com.iuhconnect.chatservice.dto;
import lombok.*;

@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class MeetingJoinInfoResponse {
    private String meetingId;
    private String roomName;
    private String jitsiUrl;
}
```

**File**: `backend/chat-service/src/main/java/com/iuhconnect/chatservice/controller/MeetingController.java`

```java
package com.iuhconnect.chatservice.controller;

import com.iuhconnect.chatservice.dto.*;
import com.iuhconnect.chatservice.model.MeetingSession;
import com.iuhconnect.chatservice.service.MeetingSessionService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/meetings")
public class MeetingController {

    private static final String JITSI_SERVER = "https://meet.jit.si";
    private final MeetingSessionService meetingSessionService;

    public MeetingController(MeetingSessionService meetingSessionService) {
        this.meetingSessionService = meetingSessionService;
    }

    @PostMapping("/{meetingId}/handoff-token")
    public ResponseEntity<HandoffTokenResponse> createHandoffToken(
            @PathVariable String meetingId,
            @RequestParam String userId) {
        String token = meetingSessionService.createHandoffToken(meetingId, userId);
        if (token == null) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(HandoffTokenResponse.builder()
                .handoffToken(token)
                .meetingUrl("/meeting/join/" + token)
                .build());
    }

    @GetMapping("/handoff/{token}")
    public ResponseEntity<MeetingJoinInfoResponse> resolveHandoff(@PathVariable String token) {
        MeetingSession session = meetingSessionService.consumeHandoffToken(token);
        if (session == null) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(MeetingJoinInfoResponse.builder()
                .meetingId(session.getMeetingId())
                .roomName(session.getRoomName())
                .jitsiUrl(JITSI_SERVER + "/" + session.getRoomName())
                .build());
    }
}
```

## BƯỚC 10: Sửa API Gateway route

**File**: `backend/api-gateway/src/main/resources/application.yml`

Thêm route mới sau `chat-service-http`:

```yaml
        # -------- Meeting Service (HTTP) --------
        - id: meeting-service-http
          uri: ${CHAT_SERVICE_HTTP_URL:http://localhost:8082}
          predicates:
            - Path=/api/v1/meetings/**

        # -------- Meeting Web (Static) --------
        - id: meeting-web
          uri: ${CHAT_SERVICE_HTTP_URL:http://localhost:8082}
          predicates:
            - Path=/meeting/**
```

## BƯỚC 11: Desktop Web — HTML tĩnh

**File**: `backend/chat-service/src/main/resources/static/meeting/join/index.html`

```html
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>IUH Connect - Tham gia cuộc họp</title>
    <style>
        * { margin:0; padding:0; box-sizing:border-box; }
        body { font-family:'Segoe UI',sans-serif; background:linear-gradient(135deg,#0F172A,#1E293B); color:#fff; min-height:100vh; display:flex; align-items:center; justify-content:center; }
        .card { background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); border-radius:16px; padding:48px; text-align:center; max-width:420px; width:90%; }
        h1 { font-size:24px; margin-bottom:8px; }
        .subtitle { color:rgba(255,255,255,0.6); margin-bottom:32px; }
        .btn { display:inline-block; padding:14px 32px; background:linear-gradient(135deg,#0077CC,#004A82); color:#fff; border:none; border-radius:12px; font-size:16px; cursor:pointer; text-decoration:none; transition:transform 0.2s; }
        .btn:hover { transform:scale(1.05); }
        .error { color:#F44336; margin-top:16px; }
        .spinner { border:3px solid rgba(255,255,255,0.2); border-top-color:#0077CC; border-radius:50%; width:40px; height:40px; animation:spin 0.8s linear infinite; margin:0 auto 16px; }
        @keyframes spin { to { transform:rotate(360deg); } }
    </style>
</head>
<body>
<div class="card" id="app">
    <div class="spinner" id="loader"></div>
    <h1>IUH Connect</h1>
    <p class="subtitle" id="status">Đang xác thực phiên họp...</p>
    <div id="join-section" style="display:none">
        <p class="subtitle">Phòng: <strong id="room-name"></strong></p>
        <a id="join-btn" class="btn" href="#" target="_blank">🎥 Tham gia cuộc họp</a>
    </div>
    <p class="error" id="error" style="display:none"></p>
</div>
<script>
(async function() {
    const path = window.location.pathname;
    const token = path.split('/').pop();
    if (!token) return showError('Thiếu mã tham gia');

    try {
        const res = await fetch('/api/v1/meetings/handoff/' + token);
        if (!res.ok) return showError('Mã tham gia không hợp lệ hoặc đã hết hạn');
        const data = await res.json();
        document.getElementById('loader').style.display = 'none';
        document.getElementById('status').style.display = 'none';
        document.getElementById('room-name').textContent = data.roomName;
        document.getElementById('join-btn').href = data.jitsiUrl;
        document.getElementById('join-section').style.display = 'block';
    } catch(e) {
        showError('Không thể kết nối server');
    }

    function showError(msg) {
        document.getElementById('loader').style.display = 'none';
        document.getElementById('status').style.display = 'none';
        document.getElementById('error').textContent = msg;
        document.getElementById('error').style.display = 'block';
    }
})();
</script>
</body>
</html>
```
