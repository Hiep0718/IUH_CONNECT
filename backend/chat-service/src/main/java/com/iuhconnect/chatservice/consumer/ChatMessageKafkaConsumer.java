package com.iuhconnect.chatservice.consumer;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.iuhconnect.chatservice.dto.ChatMessageDto;
import com.iuhconnect.chatservice.model.MessageEntity;
import com.iuhconnect.chatservice.repository.MessageRepository;
import com.iuhconnect.chatservice.repository.ConversationRepository;
import com.iuhconnect.chatservice.service.RealtimeEventService;
import com.iuhconnect.chatservice.service.AutoReplyService;
import com.iuhconnect.chatservice.service.ConversationReadModelService;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;
import java.util.Optional;

@Component
public class ChatMessageKafkaConsumer {

    private static final Logger log = LoggerFactory.getLogger(ChatMessageKafkaConsumer.class);

    private final MessageRepository messageRepository;
    private final ConversationRepository conversationRepository;
    private final com.iuhconnect.chatservice.repository.ChatUserRepository chatUserRepository;
    private final RealtimeEventService realtimeEventService;
    private final AutoReplyService autoReplyService;
    private final ConversationReadModelService conversationReadModelService;
    private final StringRedisTemplate redisTemplate;

    private static final String DEDUP_KEY_PREFIX = "msg:dedup:";
    private static final long DEDUP_TTL_MINUTES = 5;

    public ChatMessageKafkaConsumer(
            MessageRepository messageRepository,
            ConversationRepository conversationRepository,
            com.iuhconnect.chatservice.repository.ChatUserRepository chatUserRepository,
            RealtimeEventService realtimeEventService,
            AutoReplyService autoReplyService,
            ConversationReadModelService conversationReadModelService,
            StringRedisTemplate redisTemplate
    ) {
        this.messageRepository = messageRepository;
        this.conversationRepository = conversationRepository;
        this.chatUserRepository = chatUserRepository;
        this.realtimeEventService = realtimeEventService;
        this.autoReplyService = autoReplyService;
        this.conversationReadModelService = conversationReadModelService;
        this.redisTemplate = redisTemplate;
    }

    @KafkaListener(
            topics = "chat-messages",
            groupId = "#{T(java.util.UUID).randomUUID().toString()}"
    )
    public void consumeChatMessage(ChatMessageDto message) {
        if (message == null) {
            log.warn("Received null chat message from Kafka. Skipping.");
            return;
        }

        log.info(
                "Received chat message from Kafka [from={}, to={}, conv={}, type={}]",
                message.getSenderId(),
                message.getReceiverId(),
                message.getConversationId(),
                message.getMessageType()
        );

        try {
            // Deduplication check: Do not process message if it was already processed recently
            String messageId = message.getId() != null ? message.getId() : java.util.UUID.randomUUID().toString();
            String dedupKey = DEDUP_KEY_PREFIX + messageId;
            Boolean isNewMessage = redisTemplate.opsForValue().setIfAbsent(dedupKey, "1", DEDUP_TTL_MINUTES, java.util.concurrent.TimeUnit.MINUTES);

            if (Boolean.FALSE.equals(isNewMessage)) {
                log.debug("Duplicate message received [id={}], skipping DB save.", messageId);
            } else {
                MessageEntity entity = MessageEntity.builder()
                    .senderId(message.getSenderId())
                    .receiverId(message.getReceiverId())
                    .content(message.getContent())
                    .conversationId(message.getConversationId())
                    .timestamp(message.getTimestamp())
                    .messageType(message.getMessageType() != null ? message.getMessageType() : "TEXT")
                    .mediaUrl(message.getMediaUrl())
                    .thumbnailUrl(message.getThumbnailUrl())
                    .fileName(message.getFileName())
                    .fileSize(message.getFileSize())
                    .mimeType(message.getMimeType())
                    .replyToId(message.getReplyToId())
                    .replyToText(message.getReplyToText())
                    .replyToSender(message.getReplyToSender())
                    .mentions(message.getMentions())
                    .build();

                // If message.getId() was null, ensure entity uses the generated one
                if (message.getId() == null) {
                    entity.setId(messageId);
                }

                entity = messageRepository.save(entity);
                message.setId(entity.getId());
                log.info("Message saved to MongoDB [id={}]", entity.getId());

                // CQRS: Cập nhật Read Model (bảng tóm tắt) vào Redis
                conversationReadModelService.updateReadModel(message);
            }

            Optional<com.iuhconnect.chatservice.model.ConversationEntity> convOpt = 
                    conversationRepository.findById(message.getConversationId());

            chatUserRepository.findByUsername(message.getSenderId()).ifPresent(user -> {
                message.setSenderName(user.getUsername());
                message.setSenderAvatar(user.getAvatarUrl());
            });

            if (convOpt.isPresent() && convOpt.get().getType() == com.iuhconnect.chatservice.model.ConversationType.GROUP) {
                for (com.iuhconnect.chatservice.model.GroupMember member : convOpt.get().getMembers()) {
                    if (!member.getUserId().equals(message.getSenderId())) {
                        realtimeEventService.sendToUser(member.getUserId(), message);
                    }
                }
                log.info("Delivered group chat message to members of [{}]", message.getConversationId());
            } else {
                realtimeEventService.sendToUser(message.getReceiverId(), message);
                log.info("Delivered chat message to receiver [{}]", message.getReceiverId());
            }

            // ===== Mention Notifications =====
            if (message.getMentions() != null && !message.getMentions().isEmpty()) {
                String senderDisplayName = message.getSenderName() != null ? message.getSenderName() : message.getSenderId();
                for (String mentionedUserId : message.getMentions()) {
                    if (!mentionedUserId.equals(message.getSenderId())) {
                        java.util.Map<String, Object> mentionPayload = new java.util.HashMap<>();
                        mentionPayload.put("type", "MENTION_NOTIFICATION");
                        mentionPayload.put("conversationId", message.getConversationId());
                        mentionPayload.put("messageId", entity.getId());
                        mentionPayload.put("senderId", message.getSenderId());
                        mentionPayload.put("senderName", senderDisplayName);
                        mentionPayload.put("content", message.getContent());
                        mentionPayload.put("timestamp", message.getTimestamp());
                        realtimeEventService.sendToUser(mentionedUserId, mentionPayload);
                        log.info("📢 Sent MENTION_NOTIFICATION to [{}] from [{}]", mentionedUserId, message.getSenderId());
                    }
                }
            }

            // ===== UC11: Auto-Reply Check =====
            // Only check for non-auto-reply messages to prevent infinite loop
            if (!"AUTO_REPLY".equals(message.getMessageType())) {
                autoReplyService.checkAndSendAutoReply(message);
            }

        } catch (Exception e) {
            log.error("Failed to process chat message: {}", e.getMessage(), e);
        }
    }
}
