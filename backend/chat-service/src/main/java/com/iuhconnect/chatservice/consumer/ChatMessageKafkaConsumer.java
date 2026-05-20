package com.iuhconnect.chatservice.consumer;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.iuhconnect.chatservice.dto.ChatMessageDto;
import com.iuhconnect.chatservice.handler.WebSocketSessionManager;
import com.iuhconnect.chatservice.model.MessageEntity;
import com.iuhconnect.chatservice.repository.MessageRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

@Component
public class ChatMessageKafkaConsumer {

    private static final Logger log = LoggerFactory.getLogger(ChatMessageKafkaConsumer.class);

    private final MessageRepository messageRepository;
    private final WebSocketSessionManager webSocketSessionManager;
    private final ObjectMapper objectMapper;

    public ChatMessageKafkaConsumer(
            MessageRepository messageRepository,
            WebSocketSessionManager webSocketSessionManager,
            ObjectMapper objectMapper
    ) {
        this.messageRepository = messageRepository;
        this.webSocketSessionManager = webSocketSessionManager;
        this.objectMapper = objectMapper;
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

            WebSocketSession receiverSession = webSocketSessionManager.getSession(message.getReceiverId());
            if (receiverSession != null && receiverSession.isOpen()) {
                receiverSession.sendMessage(new TextMessage(objectMapper.writeValueAsString(message)));
                log.info("Delivered chat message to receiver [{}]", message.getReceiverId());
            }
        } catch (Exception e) {
            log.error("Failed to process chat message: {}", e.getMessage(), e);
        }
    }
}
