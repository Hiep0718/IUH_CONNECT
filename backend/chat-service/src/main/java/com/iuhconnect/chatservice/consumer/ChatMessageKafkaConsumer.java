package com.iuhconnect.chatservice.consumer;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.iuhconnect.chatservice.dto.ChatMessageDto;
import com.iuhconnect.chatservice.model.MessageEntity;
import com.iuhconnect.chatservice.repository.MessageRepository;
import com.iuhconnect.chatservice.repository.ConversationRepository;
import com.iuhconnect.chatservice.service.RealtimeEventService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;
import org.springframework.stereotype.Component;
import java.util.Optional;

@Component
public class ChatMessageKafkaConsumer {

    private static final Logger log = LoggerFactory.getLogger(ChatMessageKafkaConsumer.class);

    private final MessageRepository messageRepository;
    private final ConversationRepository conversationRepository;
    private final RealtimeEventService realtimeEventService;

    public ChatMessageKafkaConsumer(
            MessageRepository messageRepository,
            ConversationRepository conversationRepository,
            RealtimeEventService realtimeEventService
    ) {
        this.messageRepository = messageRepository;
        this.conversationRepository = conversationRepository;
        this.realtimeEventService = realtimeEventService;
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
                "Received chat message from Kafka [from={}, to={}, conv={}]",
                message.getSenderId(),
                message.getReceiverId(),
                message.getConversationId()
        );

        try {
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
                    .build();

            entity = messageRepository.save(entity);
            message.setId(entity.getId());
            log.info("Message saved to MongoDB [id={}]", entity.getId());

            Optional<com.iuhconnect.chatservice.model.ConversationEntity> convOpt = 
                    conversationRepository.findById(message.getConversationId());

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
        } catch (Exception e) {
            log.error("Failed to process chat message: {}", e.getMessage(), e);
        }
    }
}
