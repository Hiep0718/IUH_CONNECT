package com.iuhconnect.chatservice.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.iuhconnect.chatservice.model.MeetingSession;
import com.iuhconnect.chatservice.model.MeetingStatus;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.util.HashSet;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

/**
 * Service quản lý vòng đời meeting session và handoff token.
 * Dùng Redis làm shared store để hỗ trợ multi-instance.
 *
 * Key patterns:
 * - meeting:session:{meetingId}  → JSON MeetingSession (TTL 24h)
 * - meeting:handoff:{token}      → meetingId + userId (TTL 5 phút)
 */
@Service
public class MeetingSessionService {

    private static final Logger log = LoggerFactory.getLogger(MeetingSessionService.class);

    private static final String SESSION_KEY_PREFIX = "meeting:session:";
    private static final String HANDOFF_KEY_PREFIX = "meeting:handoff:";
    private static final long SESSION_TTL_HOURS = 24;
    private static final long HANDOFF_TTL_SECONDS = 300; // 5 phút

    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;

    public MeetingSessionService(StringRedisTemplate redisTemplate, ObjectMapper objectMapper) {
        this.redisTemplate = redisTemplate;
        this.objectMapper = objectMapper;
    }

    // ==================== Meeting Session ====================

    /**
     * Tạo meeting session mới khi caller gửi CALL_INVITE.
     */
    public MeetingSession createMeeting(String hostUserId, String roomName) {
        String meetingId = UUID.randomUUID().toString();
        long now = System.currentTimeMillis();

        HashSet<String> participants = new HashSet<>();
        participants.add(hostUserId);

        MeetingSession session = MeetingSession.builder()
                .meetingId(meetingId)
                .roomName(roomName)
                .hostUserId(hostUserId)
                .participantUserIds(participants)
                .status(MeetingStatus.INVITING)
                .createdAt(now)
                .updatedAt(now)
                .build();

        saveMeeting(session);
        log.info("📋 Meeting created [meetingId={}, room={}, host={}]", meetingId, roomName, hostUserId);
        return session;
    }

    /**
     * Lấy meeting session theo meetingId.
     */
    public MeetingSession getMeeting(String meetingId) {
        String key = SESSION_KEY_PREFIX + meetingId;
        String json = redisTemplate.opsForValue().get(key);
        if (json == null) return null;
        try {
            return objectMapper.readValue(json, MeetingSession.class);
        } catch (JsonProcessingException e) {
            log.error("❌ Failed to deserialize meeting [meetingId={}]: {}", meetingId, e.getMessage());
            return null;
        }
    }

    /**
     * Cập nhật meeting sang ACTIVE khi callee accept.
     */
    public MeetingSession acceptMeeting(String meetingId, String userId) {
        MeetingSession session = getMeeting(meetingId);
        if (session == null || session.getStatus() == MeetingStatus.ENDED) {
            log.warn("⚠️ Cannot accept meeting [meetingId={}, status={}]",
                    meetingId, session != null ? session.getStatus() : "NOT_FOUND");
            return session;
        }
        session.getParticipantUserIds().add(userId);
        session.setStatus(MeetingStatus.ACTIVE);
        session.setUpdatedAt(System.currentTimeMillis());
        saveMeeting(session);
        log.info("✅ Meeting accepted [meetingId={}, userId={}]", meetingId, userId);
        return session;
    }

    /**
     * Kết thúc meeting.
     */
    public MeetingSession endMeeting(String meetingId) {
        MeetingSession session = getMeeting(meetingId);
        if (session == null) return null;
        session.setStatus(MeetingStatus.ENDED);
        session.setUpdatedAt(System.currentTimeMillis());
        saveMeeting(session);
        log.info("🔴 Meeting ended [meetingId={}]", meetingId);
        return session;
    }

    // ==================== Handoff Token ====================

    /**
     * Tạo handoff token ngắn hạn để desktop join meeting.
     * Token lưu trong Redis với TTL 5 phút.
     */
    public String createHandoffToken(String meetingId, String userId) {
        MeetingSession session = getMeeting(meetingId);
        if (session == null || session.getStatus() == MeetingStatus.ENDED) {
            log.warn("⚠️ Cannot create handoff for meeting [meetingId={}]", meetingId);
            return null;
        }

        // Kiểm tra user có thuộc meeting không
        if (!session.getParticipantUserIds().contains(userId)) {
            log.warn("⚠️ User {} not in meeting {}", userId, meetingId);
            return null;
        }

        String token = UUID.randomUUID().toString();
        String value = meetingId + "|" + userId;
        String key = HANDOFF_KEY_PREFIX + token;

        redisTemplate.opsForValue().set(key, value, HANDOFF_TTL_SECONDS, TimeUnit.SECONDS);
        log.info("🔗 Handoff token created [meetingId={}, userId={}, ttl={}s]",
                meetingId, userId, HANDOFF_TTL_SECONDS);
        return token;
    }

    /**
     * Resolve handoff token — trả về meeting info mà KHÔNG tiêu thụ token.
     * Token chỉ bị tiêu thụ khi desktop gọi device-joined hoặc hết TTL.
     */
    public MeetingSession resolveHandoffToken(String token) {
        String key = HANDOFF_KEY_PREFIX + token;
        String value = redisTemplate.opsForValue().get(key);
        if (value == null) {
            log.warn("⚠️ Handoff token not found or expired [token={}]", token);
            return null;
        }

        String meetingId = value.split("\\|")[0];
        MeetingSession session = getMeeting(meetingId);
        if (session == null || session.getStatus() == MeetingStatus.ENDED) {
            log.warn("⚠️ Meeting not found or ended for handoff [meetingId={}]", meetingId);
            return null;
        }

        log.info("🔍 Handoff token resolved [meetingId={}, room={}]", meetingId, session.getRoomName());
        return session;
    }

    /**
     * Tiêu thụ handoff token sau khi desktop đã join thành công.
     */
    public void consumeHandoffToken(String token) {
        String key = HANDOFF_KEY_PREFIX + token;
        redisTemplate.delete(key);
        log.info("🗑️ Handoff token consumed [token={}]", token);
    }

    // ==================== Internal ====================

    private void saveMeeting(MeetingSession session) {
        try {
            String key = SESSION_KEY_PREFIX + session.getMeetingId();
            String json = objectMapper.writeValueAsString(session);
            redisTemplate.opsForValue().set(key, json, SESSION_TTL_HOURS, TimeUnit.HOURS);
        } catch (JsonProcessingException e) {
            log.error("❌ Failed to serialize meeting [meetingId={}]: {}",
                    session.getMeetingId(), e.getMessage());
        }
    }
}
