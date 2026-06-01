package com.iuhconnect.meetingservice.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.iuhconnect.meetingservice.dto.CallSignalDto;
import com.iuhconnect.meetingservice.handler.WebSocketSessionManager;
import com.iuhconnect.meetingservice.model.MeetingSession;
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
    private final org.springframework.kafka.core.KafkaTemplate<String, com.iuhconnect.meetingservice.dto.ChatMessageDto> kafkaTemplate;
    private final com.iuhconnect.meetingservice.repository.ConversationRepository conversationRepository;

    public CallSignalService(WebSocketSessionManager sessionManager,
                             MeetingSessionService meetingSessionService,
                             PresenceService presenceService,
                             StringRedisTemplate redisTemplate,
                             ObjectMapper objectMapper,
                             org.springframework.kafka.core.KafkaTemplate<String, com.iuhconnect.meetingservice.dto.ChatMessageDto> kafkaTemplate,
                             com.iuhconnect.meetingservice.repository.ConversationRepository conversationRepository) {
        this.sessionManager = sessionManager;
        this.meetingSessionService = meetingSessionService;
        this.presenceService = presenceService;
        this.redisTemplate = redisTemplate;
        this.objectMapper = objectMapper;
        this.kafkaTemplate = kafkaTemplate;
        this.conversationRepository = conversationRepository;
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
                signal.getSenderId(), roomName, signal.getConversationId());

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
     * CALL_REJECT: Kết thúc meeting (chỉ khi là cuộc gọi 1-1), relay tới caller.
     */
    private void handleReject(CallSignalDto signal) {
        // Chỉ end meeting nếu KHÔNG phải nhóm
        com.iuhconnect.meetingservice.model.ConversationEntity conv = null;
        if (signal.getConversationId() != null) {
            conv = conversationRepository.findById(signal.getConversationId()).orElse(null);
        }
        
        if (conv == null || !"GROUP".equals(conv.getType().name())) {
            if (signal.getMeetingId() != null) {
                meetingSessionService.endMeeting(signal.getMeetingId());
            }
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

            com.iuhconnect.meetingservice.model.ConversationEntity conv = conversationRepository.findById(receiverId).orElse(null);
            
            if (conv != null && "GROUP".equals(conv.getType().name())) {
                log.info("Relaying call signal to group members of {}", receiverId);
                for (com.iuhconnect.meetingservice.model.GroupMember member : conv.getMembers()) {
                    if (member.getUserId().equals(signal.getSenderId())) continue;
                    sendSignalToUser(member.getUserId(), signal, payload);
                }
            } else {
                sendSignalToUser(receiverId, signal, payload);
            }
        } catch (Exception e) {
            log.error("❌ Failed to relay call signal [to={}, signalType={}]: {}",
                    receiverId, signal.getSignalType(), e.getMessage(), e);
        }
    }

    private void sendSignalToUser(String targetUserId, CallSignalDto signal, String payload) {
        try {
            // LUÔN LUÔN gửi Push Notification cho CALL_INVITE để đề phòng "Ghost Socket"
            if ("CALL_INVITE".equals(signal.getSignalType())) {
                com.iuhconnect.meetingservice.dto.ChatMessageDto fakeMsg = new com.iuhconnect.meetingservice.dto.ChatMessageDto();
                fakeMsg.setSenderId(signal.getSenderId());
                fakeMsg.setReceiverId(targetUserId);
                fakeMsg.setConversationId(signal.getReceiverId()); // Lấy ID gốc (group ID hoặc user ID)
                fakeMsg.setMessageType("CALL_INVITE");
                fakeMsg.setContent("Đang gọi video cho bạn");
                kafkaTemplate.send("chat-messages", targetUserId, fakeMsg);
                log.info("🔔 Sent fallback CALL_INVITE push notification to Kafka for user: {}", targetUserId);
            }

            // Ưu tiên 1: Gửi trực tiếp nếu receiver có session local
            WebSocketSession receiverSession = sessionManager.getSession(targetUserId);
            if (receiverSession != null && receiverSession.isOpen()) {
                try {
                    receiverSession.sendMessage(new TextMessage(payload));
                    log.info("✅ Call Signal delivered directly [to={}]", targetUserId);
                    return;
                } catch (Exception ex) {
                    log.warn("⚠️ Failed to deliver signal directly: {}", ex.getMessage());
                    try { receiverSession.close(); } catch (Exception ignore) {}
                }
            }

            // Ưu tiên 2: Route qua Redis Pub/Sub tới instance khác
            String targetInstance = presenceService.getUserInstanceId(targetUserId);
            if (targetInstance != null) {
                redisTemplate.convertAndSend("signaling:" + targetInstance, payload);
                log.info("📡 Call Signal routed via Redis [to={}, instance={}]", targetUserId, targetInstance);
            } else {
                log.warn("⚠️ Receiver {} is not online, signal dropped", targetUserId);
            }
        } catch (Exception e) {
            log.error("Error in sendSignalToUser", e);
        }
    }
}
