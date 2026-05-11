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

/**
 * Service xử lý call signaling cho meeting.
 *
 * Trách nhiệm:
 * - Validate payload call signal
 * - Tạo meetingId và roomName khi CALL_INVITE
 * - Cập nhật MeetingSessionService khi accept/reject/end
 * - Relay signal tới receiver qua local session hoặc Redis Pub/Sub
 *
 * Nguyên tắc:
 * - Không dùng Kafka chat topic cho call signal
 * - senderId luôn do caller (ChatWebSocketHandler) inject từ authenticated session
 */
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

    /**
     * Entry point — phân nhánh xử lý theo signalType.
     */
    public void handleSignal(CallSignalDto signal) {
        String signalType = signal.getSignalType();
        if (signalType == null || signalType.isEmpty()) {
            log.warn("⚠️ Call signal missing signalType, ignoring");
            return;
        }

        log.info("📡 Call Signal [type={}, from={}, to={}]",
                signalType, signal.getSenderId(), signal.getReceiverId());

        switch (signalType) {
            case "CALL_INVITE":
                handleInvite(signal);
                break;
            case "CALL_ACCEPT":
                handleAccept(signal);
                break;
            case "CALL_REJECT":
                handleReject(signal);
                break;
            case "CALL_END":
                handleEnd(signal);
                break;
            default:
                // Các signal khác (DEVICE_JOINED, HANDOFF_*, ...) relay trực tiếp
                relaySignal(signal);
                break;
        }
    }

    /**
     * CALL_INVITE: Tạo meeting session mới, gán meetingId vào signal, relay tới receiver.
     */
    private void handleInvite(CallSignalDto signal) {
        // Đảm bảo có roomName
        String roomName = signal.getRoomName();
        if (roomName == null || roomName.isEmpty()) {
            roomName = "IUHConnect_" + signal.getSenderId() + "_" + System.currentTimeMillis();
            signal.setRoomName(roomName);
        }

        // Tạo meeting session trong Redis
        MeetingSession meeting = meetingSessionService.createMeeting(
                signal.getSenderId(), roomName);

        // Inject meetingId vào signal để callee biết
        signal.setMeetingId(meeting.getMeetingId());
        signal.setTimestamp(System.currentTimeMillis());

        log.info("📞 CALL_INVITE processed [meetingId={}, room={}, from={}, to={}]",
                meeting.getMeetingId(), roomName, signal.getSenderId(), signal.getReceiverId());

        relaySignal(signal);
    }

    /**
     * CALL_ACCEPT: Cập nhật meeting sang ACTIVE, relay tới caller.
     */
    private void handleAccept(CallSignalDto signal) {
        if (signal.getMeetingId() != null) {
            meetingSessionService.acceptMeeting(signal.getMeetingId(), signal.getSenderId());
        }
        signal.setTimestamp(System.currentTimeMillis());

        log.info("✅ CALL_ACCEPT processed [meetingId={}, from={}]",
                signal.getMeetingId(), signal.getSenderId());

        relaySignal(signal);
    }

    /**
     * CALL_REJECT: Kết thúc meeting, relay tới caller.
     */
    private void handleReject(CallSignalDto signal) {
        if (signal.getMeetingId() != null) {
            meetingSessionService.endMeeting(signal.getMeetingId());
        }
        signal.setTimestamp(System.currentTimeMillis());

        log.info("❌ CALL_REJECT processed [meetingId={}, from={}]",
                signal.getMeetingId(), signal.getSenderId());

        relaySignal(signal);
    }

    /**
     * CALL_END: Kết thúc meeting, relay tới bên còn lại.
     */
    private void handleEnd(CallSignalDto signal) {
        if (signal.getMeetingId() != null) {
            meetingSessionService.endMeeting(signal.getMeetingId());
        }
        signal.setTimestamp(System.currentTimeMillis());

        log.info("🔴 CALL_END processed [meetingId={}, from={}]",
                signal.getMeetingId(), signal.getSenderId());

        relaySignal(signal);
    }

    /**
     * Relay signal tới receiver.
     * Ưu tiên gửi trực tiếp qua local WebSocket session.
     * Nếu receiver ở instance khác thì dùng Redis Pub/Sub.
     */
    private void relaySignal(CallSignalDto signal) {
        String receiverId = signal.getReceiverId();
        if (receiverId == null || receiverId.isEmpty()) {
            log.warn("⚠️ Call signal missing receiverId, cannot relay");
            return;
        }

        try {
            String payload = objectMapper.writeValueAsString(signal);

            // Ưu tiên 1: Gửi trực tiếp nếu receiver có session local
            WebSocketSession receiverSession = sessionManager.getSession(receiverId);
            if (receiverSession != null && receiverSession.isOpen()) {
                receiverSession.sendMessage(new TextMessage(payload));
                log.info("✅ Call Signal delivered directly [to={}]", receiverId);
                return;
            }

            // Ưu tiên 2: Route qua Redis Pub/Sub tới instance khác
            String targetInstance = presenceService.getUserInstanceId(receiverId);
            if (targetInstance != null) {
                redisTemplate.convertAndSend("signaling:" + targetInstance, payload);
                log.info("📡 Call Signal routed via Redis [to={}, instance={}]",
                        receiverId, targetInstance);
            } else {
                log.warn("⚠️ Receiver {} is not online, signal dropped [signalType={}]",
                        receiverId, signal.getSignalType());
            }
        } catch (Exception e) {
            log.error("❌ Failed to relay call signal [to={}, signalType={}]: {}",
                    receiverId, signal.getSignalType(), e.getMessage(), e);
        }
    }
}
