package com.iuhconnect.conversationservice.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.iuhconnect.conversationservice.dto.ChatMessageDto;
import com.iuhconnect.conversationservice.dto.ConversationSummaryDto;
import com.iuhconnect.conversationservice.model.ConversationEntity;
import com.iuhconnect.conversationservice.model.ConversationType;
import com.iuhconnect.conversationservice.repository.ConversationRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

/**
 * CQRS Read Model Service — Quản lý "Bảng Tóm Tắt" trong Redis.
 *
 * <p>Chịu trách nhiệm 2 việc:</p>
 * <ul>
 *   <li><b>Update:</b> Cập nhật bảng tóm tắt khi có tin nhắn mới (Command side)</li>
 *   <li><b>Query:</b> Đọc bảng tóm tắt siêu nhanh từ Redis (Query side)</li>
 * </ul>
 *
 * <p>Redis Key Structure:</p>
 * <pre>
 *   conv_summary:{userId}  — Hash: conversationId → JSON(ConversationSummaryDto)
 *   conv_unread:{userId}   — Hash: conversationId → unreadCount (integer)
 * </pre>
 */
@Service
public class ConversationReadModelService {

    private static final Logger log = LoggerFactory.getLogger(ConversationReadModelService.class);
    private static final String SUMMARY_KEY_PREFIX = "conv_summary:";
    private static final String UNREAD_KEY_PREFIX = "conv_unread:";

    private final StringRedisTemplate redisTemplate;
    private final ConversationRepository conversationRepository;
    private final ObjectMapper objectMapper;

    public ConversationReadModelService(StringRedisTemplate redisTemplate,
                                         ConversationRepository conversationRepository) {
        this.redisTemplate = redisTemplate;
        this.conversationRepository = conversationRepository;
        this.objectMapper = new ObjectMapper();
    }

    // ========== COMMAND SIDE: Cập nhật bảng tóm tắt ==========

    /**
     * Cập nhật Read Model khi có tin nhắn mới.
     * Được gọi từ ChatMessageKafkaConsumer sau khi lưu MongoDB.
     *
     * <p>Hành động:</p>
     * <ul>
     *   <li>Lưu tin cuối cùng vào conv_summary cho TẤT CẢ participants</li>
     *   <li>Tăng unreadCount cho người NHẬN (không tăng cho người gửi)</li>
     * </ul>
     */
    public void updateReadModel(ChatMessageDto message) {
        try {
            // Build summary từ tin nhắn mới
            ConversationSummaryDto summary = new ConversationSummaryDto();
            summary.setId(message.getId());
            summary.setSenderId(message.getSenderId());
            summary.setReceiverId(message.getReceiverId());
            summary.setContent(message.getContent());
            summary.setConversationId(message.getConversationId());
            summary.setTimestamp(message.getTimestamp());
            summary.setMessageType(message.getMessageType() != null ? message.getMessageType() : "TEXT");
            summary.setMediaUrl(message.getMediaUrl());
            summary.setThumbnailUrl(message.getThumbnailUrl());
            summary.setFileName(message.getFileName());
            summary.setFileSize(message.getFileSize());
            summary.setMimeType(message.getMimeType());
            summary.setRead(false);

            String summaryJson = objectMapper.writeValueAsString(summary);
            String conversationId = message.getConversationId();

            // Xác định tất cả participants cần cập nhật
            List<String> participants = getParticipants(message);

            for (String userId : participants) {
                // Cập nhật tin cuối cùng cho mọi participant
                redisTemplate.opsForHash().put(
                        SUMMARY_KEY_PREFIX + userId,
                        conversationId,
                        summaryJson
                );

                // Tăng unreadCount cho người NHẬN (không phải người gửi)
                if (!userId.equals(message.getSenderId())) {
                    redisTemplate.opsForHash().increment(
                            UNREAD_KEY_PREFIX + userId,
                            conversationId,
                            1
                    );
                }
            }

            log.info("📋 CQRS: Read Model updated for conversation [{}], participants: {}",
                    conversationId, participants);

        } catch (Exception e) {
            log.error("❌ CQRS: Failed to update Read Model: {}", e.getMessage(), e);
            // Không throw exception — Read Model update là best-effort,
            // tin nhắn đã lưu MongoDB rồi nên không ảnh hưởng tính đúng đắn
        }
    }

    /**
     * Reset unreadCount khi user đánh dấu đã đọc.
     */
    public void resetUnreadCount(String conversationId, String userId) {
        try {
            redisTemplate.opsForHash().put(
                    UNREAD_KEY_PREFIX + userId,
                    conversationId,
                    "0"
            );
            log.info("📋 CQRS: Unread count reset for user [{}] conv [{}]", userId, conversationId);
        } catch (Exception e) {
            log.error("❌ CQRS: Failed to reset unread count: {}", e.getMessage());
        }
    }

    // ========== QUERY SIDE: Đọc bảng tóm tắt ==========

    /**
     * Đọc danh sách conversation từ Redis (CQRS Query).
     * Nếu Redis trống → trả về null để caller fallback về MongoDB.
     */
    public List<ConversationSummaryDto> getRecentConversations(String userId) {
        try {
            String summaryKey = SUMMARY_KEY_PREFIX + userId;
            Map<Object, Object> entries = redisTemplate.opsForHash().entries(summaryKey);

            if (entries.isEmpty()) {
                log.info("📋 CQRS: Redis empty for user [{}], fallback to MongoDB", userId);
                return null; // Caller sẽ fallback về MongoDB
            }

            // Đọc unread counts
            String unreadKey = UNREAD_KEY_PREFIX + userId;
            Map<Object, Object> unreadEntries = redisTemplate.opsForHash().entries(unreadKey);

            List<ConversationSummaryDto> result = new ArrayList<>();
            for (Map.Entry<Object, Object> entry : entries.entrySet()) {
                String json = (String) entry.getValue();
                String convId = (String) entry.getKey();

                ConversationSummaryDto dto = objectMapper.readValue(json, ConversationSummaryDto.class);

                // Gắn unreadCount từ Redis
                Object unreadObj = unreadEntries.get(convId);
                int unread = 0;
                if (unreadObj != null) {
                    unread = Integer.parseInt(unreadObj.toString());
                }
                dto.setUnreadCount(unread);

                result.add(dto);
            }

            // Sắp xếp theo timestamp mới nhất trước
            result.sort(Comparator.comparingLong(ConversationSummaryDto::getTimestamp).reversed());

            log.info("📋 CQRS: Loaded {} conversations from Redis for user [{}]", result.size(), userId);
            return result;

        } catch (Exception e) {
            log.error("❌ CQRS: Failed to read from Redis: {}", e.getMessage());
            return null; // Fallback về MongoDB
        }
    }

    /**
     * Rebuild toàn bộ Read Model từ MongoDB cho 1 user.
     * Dùng khi: Redis trống lần đầu, hoặc cần sửa lỗi dữ liệu.
     */
    public void rebuildReadModel(String userId, List<ConversationSummaryDto> summaries) {
        try {
            String summaryKey = SUMMARY_KEY_PREFIX + userId;
            String unreadKey = UNREAD_KEY_PREFIX + userId;

            // Xóa dữ liệu cũ
            redisTemplate.delete(summaryKey);
            redisTemplate.delete(unreadKey);

            // Ghi lại từng summary vào Redis
            for (ConversationSummaryDto dto : summaries) {
                String json = objectMapper.writeValueAsString(dto);
                redisTemplate.opsForHash().put(summaryKey, dto.getConversationId(), json);

                // Ghi unreadCount
                int unread = dto.getUnreadCount() != null ? dto.getUnreadCount() : 0;
                redisTemplate.opsForHash().put(unreadKey, dto.getConversationId(), String.valueOf(unread));
            }

            log.info("📋 CQRS: Rebuilt Read Model for user [{}] with {} conversations",
                    userId, summaries.size());

        } catch (Exception e) {
            log.error("❌ CQRS: Failed to rebuild Read Model: {}", e.getMessage());
        }
    }

    // ========== Private Helpers ==========

    /**
     * Lấy danh sách tất cả user tham gia cuộc trò chuyện.
     * Hỗ trợ cả chat 1-1 và chat nhóm.
     */
    private List<String> getParticipants(ChatMessageDto message) {
        List<String> participants = new ArrayList<>();

        // Kiểm tra xem đây là group chat hay 1-1
        Optional<ConversationEntity> convOpt =
                conversationRepository.findById(message.getConversationId());

        if (convOpt.isPresent() && convOpt.get().getType() == ConversationType.GROUP) {
            // Group chat: lấy tất cả members
            participants = convOpt.get().getMembers().stream()
                    .map(m -> m.getUserId())
                    .collect(Collectors.toList());
        } else {
            // Chat 1-1: sender + receiver
            participants.add(message.getSenderId());
            if (message.getReceiverId() != null) {
                participants.add(message.getReceiverId());
            }
        }

        return participants;
    }
}
