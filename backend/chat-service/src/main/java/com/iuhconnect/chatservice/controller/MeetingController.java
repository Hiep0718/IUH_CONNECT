package com.iuhconnect.chatservice.controller;

import com.iuhconnect.chatservice.dto.HandoffTokenResponse;
import com.iuhconnect.chatservice.dto.MeetingJoinInfoResponse;
import com.iuhconnect.chatservice.model.MeetingSession;
import com.iuhconnect.chatservice.service.CallSignalService;
import com.iuhconnect.chatservice.service.MeetingSessionService;
import com.iuhconnect.chatservice.dto.CallSignalDto;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import jakarta.servlet.http.HttpServletRequest;

/**
 * REST API cho meeting:
 * - Tạo handoff token (mobile → desktop)
 * - Resolve handoff token (desktop join)
 * - Device joined callback (desktop thông báo đã join)
 */
@RestController
@RequestMapping("/api/v1/meetings")
public class MeetingController {

    private static final Logger log = LoggerFactory.getLogger(MeetingController.class);
    private static final String JITSI_SERVER = "https://meet.jit.si";

    private final MeetingSessionService meetingSessionService;
    private final CallSignalService callSignalService;

    public MeetingController(MeetingSessionService meetingSessionService,
                             CallSignalService callSignalService) {
        this.meetingSessionService = meetingSessionService;
        this.callSignalService = callSignalService;
    }

    /**
     * POST /api/v1/meetings/{meetingId}/handoff-token
     *
     * Mobile gọi khi user bấm "Mở trên máy tính".
     * Tạo handoff token ngắn hạn (TTL 5 phút).
     *
     * Lưu ý: userId lấy từ JWT principal, không nhận từ query param.
     * Tạm thời trong phase này dùng header "X-User-Id" hoặc principal.
     */
    @PostMapping("/{meetingId}/handoff-token")
    public ResponseEntity<HandoffTokenResponse> createHandoffToken(
            @PathVariable String meetingId,
            HttpServletRequest request) {

        // Lấy userId từ request attribute (set bởi JWT filter hoặc gateway)
        String userId = extractUserId(request);
        if (userId == null) {
            return ResponseEntity.status(401).build();
        }

        String token = meetingSessionService.createHandoffToken(meetingId, userId);
        if (token == null) {
            return ResponseEntity.notFound().build();
        }

        String meetingUrl = "/meeting/join?token=" + token;
        log.info("🔗 Handoff token created [meetingId={}, userId={}, url={}]",
                meetingId, userId, meetingUrl);

        return ResponseEntity.ok(HandoffTokenResponse.builder()
                .handoffToken(token)
                .meetingUrl(meetingUrl)
                .build());
    }

    /**
     * GET /api/v1/meetings/handoff/{token}
     *
     * Desktop web gọi để resolve handoff token.
     * Trả về meetingId, roomName, jitsiUrl.
     * KHÔNG tiêu thụ token — token chỉ bị consume sau device-joined.
     */
    @GetMapping("/handoff/{token}")
    public ResponseEntity<MeetingJoinInfoResponse> resolveHandoff(@PathVariable String token) {
        MeetingSession session = meetingSessionService.resolveHandoffToken(token);
        if (session == null) {
            return ResponseEntity.notFound().build();
        }

        String jitsiUrl = JITSI_SERVER + "/" + session.getRoomName();
        log.info("🔍 Handoff resolved [meetingId={}, room={}]",
                session.getMeetingId(), session.getRoomName());

        return ResponseEntity.ok(MeetingJoinInfoResponse.builder()
                .meetingId(session.getMeetingId())
                .roomName(session.getRoomName())
                .jitsiUrl(jitsiUrl)
                .build());
    }

    /**
     * POST /api/v1/meetings/{meetingId}/device-joined
     *
     * Desktop gọi sau khi đã join Jitsi thành công.
     * Backend phát DEVICE_JOINED signal tới participants trên mobile.
     * Token bị consume sau callback này.
     */
    @PostMapping("/{meetingId}/device-joined")
    public ResponseEntity<Void> deviceJoined(
            @PathVariable String meetingId,
            @RequestParam(required = false) String handoffToken) {

        MeetingSession session = meetingSessionService.getMeeting(meetingId);
        if (session == null) {
            return ResponseEntity.notFound().build();
        }

        // Consume handoff token nếu có
        if (handoffToken != null && !handoffToken.isEmpty()) {
            meetingSessionService.consumeHandoffToken(handoffToken);
        }

        // Phát DEVICE_JOINED cho tất cả participants
        for (String participantId : session.getParticipantUserIds()) {
            CallSignalDto signal = CallSignalDto.builder()
                    .type("CALL_SIGNAL")
                    .signalType("DEVICE_JOINED")
                    .meetingId(meetingId)
                    .roomName(session.getRoomName())
                    .senderId("desktop")
                    .receiverId(participantId)
                    .timestamp(System.currentTimeMillis())
                    .build();
            callSignalService.handleSignal(signal);
        }

        log.info("🖥️ Desktop joined meeting [meetingId={}]", meetingId);
        return ResponseEntity.ok().build();
    }

    /**
     * Trích xuất userId từ request.
     * Gateway chuyển tiếp JWT, chat-service có thể dùng header hoặc attribute.
     */
    private String extractUserId(HttpServletRequest request) {
        // Ưu tiên 1: attribute set bởi JWT filter
        Object userAttr = request.getAttribute("username");
        if (userAttr != null) return userAttr.toString();

        // Ưu tiên 2: header X-User-Id (set bởi gateway hoặc filter)
        String headerUser = request.getHeader("X-User-Id");
        if (headerUser != null && !headerUser.isEmpty()) return headerUser;

        // Ưu tiên 3: query param (fallback cho testing)
        String paramUser = request.getParameter("userId");
        return paramUser;
    }
}
