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
import org.springframework.beans.factory.annotation.Value;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import jakarta.annotation.PostConstruct;
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
    private static final String JITSI_SERVER = "https://meet.ffmuc.net";

    private final MeetingSessionService meetingSessionService;
    private final CallSignalService callSignalService;

    @Value("${jwt.secret}")
    private String jwtSecret;

    private SecretKey key;

    @PostConstruct
    public void init() {
        this.key = Keys.hmacShaKeyFor(jwtSecret.getBytes(StandardCharsets.UTF_8));
    }

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
     * POST /api/v1/meetings/{meetingId}/link-desktop/{sessionId}
     *
     * Mobile quét QR và gọi API này để liên kết meeting với desktop session.
     */
    @PostMapping("/{meetingId}/link-desktop/{sessionId}")
    public ResponseEntity<Void> linkDesktop(
            @PathVariable String meetingId,
            @PathVariable String sessionId,
            HttpServletRequest request) {
        String userId = extractUserId(request);
        if (userId == null) {
            return ResponseEntity.status(401).build();
        }

        boolean linked = meetingSessionService.linkDesktopSession(meetingId, sessionId, userId);
        if (!linked) {
            return ResponseEntity.badRequest().build();
        }
        return ResponseEntity.ok().build();
    }

    /**
     * GET /api/v1/meetings/desktop-session/{sessionId}
     *
     * Desktop gọi định kỳ (polling) để chờ mobile scan.
     */
    @GetMapping("/desktop-session/{sessionId}")
    public ResponseEntity<MeetingJoinInfoResponse> checkDesktopSession(@PathVariable String sessionId) {
        MeetingSession session = meetingSessionService.checkDesktopSession(sessionId);
        if (session == null) {
            return ResponseEntity.notFound().build(); // 404 nghĩa là đang chờ hoặc hết hạn
        }

        String jitsiUrl = JITSI_SERVER + "/" + session.getRoomName();
        return ResponseEntity.ok(MeetingJoinInfoResponse.builder()
                .meetingId(session.getMeetingId())
                .roomName(session.getRoomName())
                .jitsiUrl(jitsiUrl)
                .build());
    }

    /**
     * Trích xuất userId từ request.
     */
    private String extractUserId(HttpServletRequest request) {
        // Ưu tiên 1: Authorization Header (JWT)
        String authHeader = request.getHeader("Authorization");
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            String token = authHeader.substring(7);
            try {
                return Jwts.parser()
                        .verifyWith(key)
                        .build()
                        .parseSignedClaims(token)
                        .getPayload()
                        .getSubject();
            } catch (Exception e) {
                log.warn("Invalid JWT in MeetingController: {}", e.getMessage());
            }
        }

        // Ưu tiên 2: attribute set bởi JWT filter (nếu có sau này)
        Object userAttr = request.getAttribute("username");
        if (userAttr != null) return userAttr.toString();

        // Ưu tiên 3: header X-User-Id (set bởi gateway)
        String headerUser = request.getHeader("X-User-Id");
        if (headerUser != null && !headerUser.isEmpty()) return headerUser;

        // Ưu tiên 4: query param (fallback)
        return request.getParameter("userId");
    }
}
