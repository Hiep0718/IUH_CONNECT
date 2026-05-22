package com.iuhconnect.chatservice.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.iuhconnect.chatservice.dto.ChatMessageDto;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.concurrent.TimeUnit;

/**
 * UC11 — Auto-Reply Service.
 *
 * When a student sends a message to a lecturer who has set their work status to BUSY,
 * this service automatically generates a reply message on behalf of the lecturer.
 *
 * Debounce Policy:
 * - First message from a sender in a BUSY session → immediate auto-reply
 * - Subsequent messages from the same sender → debounced for 30 minutes
 * - When the lecturer clears BUSY status → all debounce keys are cleared by Presence Service
 *
 * This prevents spamming the student with repeated auto-replies while ensuring
 * they are informed once about the lecturer's unavailability.
 */
@Service
public class AutoReplyService {

    private static final Logger log = LoggerFactory.getLogger(AutoReplyService.class);
    private static final String WORK_STATUS_KEY_PREFIX = "workstatus:";
    private static final String AUTO_REPLY_KEY_PREFIX = "autoreply:";
    private static final String DEBOUNCE_KEY_PREFIX = "autoreply:sent:";
    private static final long DEBOUNCE_MINUTES = 30; // Re-send auto-reply after 30 min silence
    private static final String CHAT_TOPIC = "chat-messages";

    private final StringRedisTemplate redisTemplate;
    private final KafkaTemplate<String, ChatMessageDto> kafkaTemplate;
    private final ObjectMapper objectMapper;

    public AutoReplyService(StringRedisTemplate redisTemplate,
                            KafkaTemplate<String, ChatMessageDto> kafkaTemplate,
                            ObjectMapper objectMapper) {
        this.redisTemplate = redisTemplate;
        this.kafkaTemplate = kafkaTemplate;
        this.objectMapper = objectMapper;
    }

    /**
     * Check if the receiver is a BUSY lecturer and send an auto-reply if needed.
     * Only triggers for 1-on-1 (SINGLE) conversations — determined by receiverId being non-null.
     */
    public void checkAndSendAutoReply(ChatMessageDto originalMessage) {
        String receiverId = originalMessage.getReceiverId();
        String senderId = originalMessage.getSenderId();

        // Only for direct messages (receiverId is set)
        if (receiverId == null || receiverId.isBlank()) {
            return;
        }

        // Don't auto-reply to yourself
        if (receiverId.equals(senderId)) {
            return;
        }

        try {
            // 1. Check if receiver has BUSY work status
            String workStatus = redisTemplate.opsForValue().get(WORK_STATUS_KEY_PREFIX + receiverId);
            if (!"BUSY".equals(workStatus)) {
                return;
            }

            // 2. Check debounce — already replied to this sender recently?
            String debounceKey = DEBOUNCE_KEY_PREFIX + receiverId + ":" + senderId;
            Boolean alreadySent = redisTemplate.hasKey(debounceKey);
            if (Boolean.TRUE.equals(alreadySent)) {
                log.debug("⏳ Auto-reply debounced for {} → {}", receiverId, senderId);
                return;
            }

            // 3. Get auto-reply config
            String autoReplyJson = redisTemplate.opsForValue().get(AUTO_REPLY_KEY_PREFIX + receiverId);
            if (autoReplyJson == null) {
                return;
            }

            @SuppressWarnings("unchecked")
            Map<String, Object> config = objectMapper.readValue(autoReplyJson, Map.class);
            Boolean enabled = (Boolean) config.get("enabled");
            String message = (String) config.get("message");

            if (!Boolean.TRUE.equals(enabled) || message == null || message.isBlank()) {
                return;
            }

            // 4. Build auto-reply message
            ChatMessageDto autoReply = ChatMessageDto.builder()
                    .senderId(receiverId)              // The lecturer "sends" the auto-reply
                    .receiverId(senderId)              // To the student who messaged
                    .content(message)
                    .conversationId(originalMessage.getConversationId())
                    .timestamp(System.currentTimeMillis())
                    .messageType("AUTO_REPLY")         // Special type to prevent loop & style differently
                    .build();

            // 5. Produce to Kafka (will be saved to DB and delivered like a normal message)
            kafkaTemplate.send(CHAT_TOPIC, autoReply.getConversationId(), autoReply);

            // 6. Set debounce key
            redisTemplate.opsForValue().set(debounceKey, "1", DEBOUNCE_MINUTES, TimeUnit.MINUTES);

            log.info("🤖 Auto-reply sent: {} → {} (conv={})", receiverId, senderId,
                    originalMessage.getConversationId());

        } catch (Exception e) {
            log.error("❌ Failed to process auto-reply for message from {} to {}: {}",
                    senderId, receiverId, e.getMessage(), e);
        }
    }
}
